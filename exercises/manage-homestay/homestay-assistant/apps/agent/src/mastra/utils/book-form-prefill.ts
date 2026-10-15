import type { ProcessInputStepArgs } from "@mastra/core/processors";
import type { RequestContext } from "@mastra/core/request-context";
import { MastraDBMessage } from "@mastra/core/memory";

import {
  BARE_DAY_CUE,
  LAST_WEEKEND_CUE,
  DATE_CUE,
  MONTH_DAY_CUE,
  NEXT_WEEKEND_CUE,
  TOOL_KEYS,
  TOOL_PURPOSE,
  WEEKEND_CUE,
  YMD_PATTERN,
  TODAY_TONIGHT_TOMORROW_CUE,
  VI_DATE_CUE,
  WEEKDAY_CUE,
  YMD_DATE_CUE,
  GUEST_COUNT_CUE,
  STAY_LENGTH_CUE,
  ROOM_RANKING_CUE,
  ROOM_PRICE_CEILING_CUE,
} from "@repo/constants";
import { addDaysYmd, getWeekendStay, resolveStayCheckOut } from "@repo/utils";

import { REQUEST_CONTEXT_KEYS } from "@/mastra/middleware/constants";
import { asRecord, JsonValue } from "@/mastra/utils/json-value";
import { extractMessageText, findLatestUserMessage } from "@/mastra/utils/latest-user-message";
import { getMessageParts } from "@/mastra/utils/message-parts";
import { parseFindRoomOutput } from "@/mastra/utils/parse-tool-output";

export type BookingFormStayHint = {
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
  /**
   * Stated stay LENGTH in nights, carried even when the check-in date is still
   * unknown — "book X for 4 nights" must open the Booking Form with empty dates
   * but remember four nights, so picking a check-in resolves check-out
   * correctly instead of defaulting to a single night.
   */
  nights?: number;
};

const isValidYmd = (value: unknown): value is string => {
  return typeof value === "string" && YMD_PATTERN.test(value);
};

const getContinuityStayFromPart = (
  part: JsonValue,
): BookingFormStayHint | null => {
  const record = asRecord(part);

  if (record?.type !== "tool-invocation") {
    return null;
  }

  const invocation = asRecord(record.toolInvocation);

  if (
    invocation?.state !== "result" ||
    invocation.toolName !== TOOL_KEYS.GET.FIND_ROOM
  ) {
    return null;
  }

  const result = parseFindRoomOutput(invocation.result);

  if (!result || result.purpose === TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE) {
    return null;
  }

  const { date, guests, nights, dateStated } = result;
  // An undated "show available rooms" still carries a `date`: the prompt tells
  // the model to default it to CURRENT DATE today (see WORKFLOW — FIND/FILTER).
  // Carrying that forward as an established check-in is what made a later
  // "book X for N nights" probe — and refuse — dates the guest never chose.
  // `dateStated === false` means find_room stamped it as the prompt's default.
  // `undefined` is a pre-stamp transcript: trusted, as before.
  const checkInDate =
    isValidYmd(date) && dateStated !== false ? date : undefined;

  if (!checkInDate && !guests && !nights) {
    return null;
  }

  return {
    ...(checkInDate
      ? {
          checkInDate,
          checkOutDate: resolveStayCheckOut(checkInDate, nights),
        }
      : {}),
    ...(guests ? { guests } : {}),
    ...(nights ? { nights } : {}),
  };
};

/**
 * Scans the full conversation (every turn, not just the current one) for the
 * most recent dated and/or guest-count-bearing FIND/RECOMMEND `find_room`
 * result, so a later named-room BOOK resolution can (a) prefill the Booking
 * Form with that date/guests instead of defaulting to today / asking again,
 * and (b) let the BOOK step machine skip the form entirely when the date and
 * guest count are both already known — even when they came from different
 * earlier turns. `book_resolve` lookups are skipped by this scan (the
 * triggering call's own stated date/guests are read directly from its
 * result, not via continuity).
 */
export const resolveContinuityStayHint = (
  messages: ProcessInputStepArgs["messages"] | undefined,
): BookingFormStayHint | null => {
  if (!messages?.length) {
    return null;
  }

  let hint: BookingFormStayHint = {};

  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    const message = messages[messageIndex];

    if (!message) {
      continue;
    }

    const parts = getMessageParts(message);

    if (!parts) {
      continue;
    }

    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];

      if (part === undefined) {
        continue;
      }

      const candidate = getContinuityStayFromPart(part);

      if (!candidate) {
        continue;
      }

      hint = {
        ...candidate,
        ...hint,
      };

      // Deliberately NOT also waiting for `nights`: most searches state none,
      // so requiring it would scan the whole history and let a stay length from
      // an old turn attach itself to a much newer date. `nights` only ever
      // travels with the same find_room result that supplied its date (see
      // getContinuityStayFromPart).
      if (hint.checkInDate && hint.guests) {
        return hint;
      }
    }
  }

  return hint.checkInDate || hint.guests || hint.nights ? hint : null;
};

/** Pins a resolved stay hint so the forced get_room_by_id call can read it. */
export const stashBookingFormStayHint = (
  requestContext: RequestContext | undefined,
  hint: BookingFormStayHint | null,
) => {
  // `nights` alone is worth stashing: "book X for 4 nights" knows no date and
  // no guest count, but the Booking Form must still open remembering four
  // nights rather than silently falling back to one.
  if (
    !requestContext ||
    !hint ||
    (!hint.checkInDate && !hint.guests && !hint.nights)
  ) {
    return;
  }

  requestContext.set(REQUEST_CONTEXT_KEYS.PENDING_BOOKING_FORM_STAY_HINT, hint);
};

/** Reads the pinned stay hint; malformed/missing values return null. */
export const readBookingFormStayHint = (
  requestContext: RequestContext | undefined,
): BookingFormStayHint | null => {
  const value = requestContext?.get(
    REQUEST_CONTEXT_KEYS.PENDING_BOOKING_FORM_STAY_HINT,
  );

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const hint = value as Partial<BookingFormStayHint>;
  const result: BookingFormStayHint = {};

  if (
    typeof hint.checkInDate === "string" &&
    typeof hint.checkOutDate === "string"
  ) {
    result.checkInDate = hint.checkInDate;
    result.checkOutDate = hint.checkOutDate;
  }

  if (typeof hint.guests === "number" && Number.isFinite(hint.guests)) {
    result.guests = hint.guests;
  }

  if (
    typeof hint.nights === "number" &&
    Number.isInteger(hint.nights) &&
    hint.nights > 0
  ) {
    result.nights = hint.nights;
  }

  if (!result.checkInDate && !result.guests && !result.nights) {
    return null;
  }

  return result;
};

/** Clears the pinned hint once get_room_by_id has consumed it. */
export const clearBookingFormStayHint = (
  requestContext: RequestContext | undefined,
) => {
  requestContext?.set(
    REQUEST_CONTEXT_KEYS.PENDING_BOOKING_FORM_STAY_HINT,
    undefined,
  );
};

/**
 * Deterministically resolves a relative check-in cue (today/tonight/tomorrow/
 * weekend/next weekend/last weekend) found anywhere in raw guest text, the
 * same today/tomorrow/weekend mapping `sanitizeFindRoomDate` applies to an
 * already-isolated cue word — generalized to scan a full message so it can
 * run against the guest's own latest text rather than a tool's echoed `date`.
 *
 * Skipped when the text also carries an explicit absolute-date phrase (an
 * ISO date or a month name + day) — a guest correction ("this weekend,
 * actually August 15") must win over the relative cue, and only the model
 * can parse that phrase's own year. Deliberately NOT guarded on
 * {@link BARE_DAY_CUE} — "for 1 guest" / "for 2 people" false-positives that
 * pattern (a bare `for <number>`), which would silently defeat the override
 * on the exact "book X at weekend for N guests" phrasing this exists to fix.
 *
 * Exists because a model-supplied `find_room.date` can already be a
 * plausible-looking YYYY-MM-DD that is simply wrong (observed: "book X at
 * weekend" resolved to a stray year from training data instead of the real
 * upcoming Saturday) — `sanitizeFindRoomDate` only re-derives a date from an
 * unresolved cue WORD, so a wrong-but-well-formed value sails through
 * unchallenged. This is the authoritative check for that class of cue.
 */
export const resolveStatedRelativeCheckIn = (
  text: string,
  today: string,
): string | undefined => {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  if (
    YMD_DATE_CUE.test(trimmed) ||
    DATE_CUE.test(trimmed) ||
    MONTH_DAY_CUE.test(trimmed)
  ) {
    return undefined;
  }

  const relative = TODAY_TONIGHT_TOMORROW_CUE.exec(trimmed);
  if (relative?.[1]) {
    return relative[1].toLowerCase() === "tomorrow"
      ? addDaysYmd(today, 1)
      : today;
  }

  if (NEXT_WEEKEND_CUE.test(trimmed)) return getWeekendStay(today, 1).checkIn;
  if (LAST_WEEKEND_CUE.test(trimmed)) return getWeekendStay(today, -1).checkIn;
  if (WEEKEND_CUE.test(trimmed)) return getWeekendStay(today).checkIn;

  return undefined;
};

/** Pins the deterministic relative check-in override (see PENDING_RELATIVE_CHECKIN). */
export const stashRelativeCheckInOverride = (
  requestContext: RequestContext | undefined,
  checkInDate: string | undefined,
) => {
  requestContext?.set(
    REQUEST_CONTEXT_KEYS.PENDING_RELATIVE_CHECKIN,
    checkInDate,
  );
};

/** Reads the pinned deterministic relative check-in override, if any. */
export const readRelativeCheckInOverride = (
  requestContext: RequestContext | undefined,
): string | undefined => {
  const value = requestContext?.get(
    REQUEST_CONTEXT_KEYS.PENDING_RELATIVE_CHECKIN,
  );
  return isValidYmd(value) ? value : undefined;
};

/**
 * Whether the guest's own latest message contains SOME recognizable check-in
 * date cue at all (word/phrase, not the resolved value — the model already
 * resolved that into `find_room.date`). Used only to corroborate that a
 * model-supplied book_resolve `date` has textual grounding, never to parse
 * the date itself.
 */
export const hasStatedCheckInCue = (text: string): boolean => {
  if (!text.trim()) return false;

  return (
    TODAY_TONIGHT_TOMORROW_CUE.test(text) ||
    VI_DATE_CUE.test(text) ||
    WEEKEND_CUE.test(text) ||
    NEXT_WEEKEND_CUE.test(text) ||
    LAST_WEEKEND_CUE.test(text) ||
    WEEKDAY_CUE.test(text) ||
    DATE_CUE.test(text) ||
    MONTH_DAY_CUE.test(text) ||
    BARE_DAY_CUE.test(text) ||
    YMD_DATE_CUE.test(text)
  );
};

/**
 * Whether the guest's own latest message states a party size at all. Used
 * only to corroborate a model-supplied book_resolve `guests`, never to parse
 * the count itself (the model already resolved that into `find_room.guests`).
 */
export const hasStatedGuestCue = (text: string): boolean =>
  GUEST_COUNT_CUE.test(text);

/** Whether the guest's own latest message states a stay LENGTH at all. */
export const hasStatedStayLengthCue = (text: string): boolean =>
  STAY_LENGTH_CUE.test(text);

/** Stay-length units that are not already a count of nights. */
const NIGHTS_PER_UNIT: Record<string, number> = {
  week: 7,
  weeks: 7,
  tuần: 7,
};

/**
 * Deterministically reads a stated stay LENGTH in nights out of raw guest text
 * ("4 nights" → 4, "in 3 days" → 3, "2 weeks" → 14, "3 đêm" → 3).
 *
 * Authoritative over whatever the model attached to `find_room.nights`, for the
 * same reason {@link resolveStatedRelativeCheckIn} is authoritative over
 * `find_room.date`: this is the exact phrase class the model gets wrong. The
 * reported failure was a model reading "in 4 nights" as a check-in OFFSET and
 * emitting today + 4 as `date` — the count is right there in the text, so the
 * app reads it rather than trusting the model's interpretation of it.
 *
 * Months are deliberately NOT converted (length varies); a "2 months" stay
 * returns undefined and the guest picks real dates in the Booking Form.
 */
export const resolveStatedNights = (text: string): number | undefined => {
  const match = STAY_LENGTH_CUE.exec(text.trim());
  if (!match?.[1] || !match[2]) return undefined;

  const count = Number(match[1]);
  if (!Number.isInteger(count) || count <= 0) return undefined;

  const unit = match[2].toLowerCase();
  if (unit.startsWith("month") || unit === "tháng") return undefined;

  return count * (NIGHTS_PER_UNIT[unit] ?? 1);
};

/**
 * Whether the guest's own latest message states ANY cheap/expensive/amenities
 * ranking wording or a numeric price ceiling at all — never the actual
 * ranking the model resolved into `find_room.sortBy` / `maxPrice`. See
 * PENDING_RANKING_CUE for why a model-supplied sortBy/maxPrice needs this
 * corroboration. English wording only (unlike the date/guest-count cues
 * above, deliberately not translated).
 */
export const hasStatedRoomRankingCue = (text: string): boolean =>
  ROOM_RANKING_CUE.test(text) || ROOM_PRICE_CEILING_CUE.test(text);

/** Pins whether the guest's latest message stated a date cue (see PENDING_CHECKIN_CUE). */
export const stashCheckInCueOverride = (
  requestContext: RequestContext | undefined,
  hasCue: boolean,
) => {
  requestContext?.set(REQUEST_CONTEXT_KEYS.PENDING_CHECKIN_CUE, hasCue);
};

/** Reads the pinned date-cue flag; missing/malformed → false (treat as unstated). */
export const readCheckInCueOverride = (
  requestContext: RequestContext | undefined,
): boolean =>
  requestContext?.get(REQUEST_CONTEXT_KEYS.PENDING_CHECKIN_CUE) === true;

/** Pins the ranking/price cue flag (see PENDING_RANKING_CUE). */
export const stashRankingCueOverride = (
  requestContext: RequestContext | undefined,
  hasCue: boolean,
) => {
  requestContext?.set(REQUEST_CONTEXT_KEYS.PENDING_RANKING_CUE, hasCue);
};

/** Reads the pinned ranking/price cue flag; missing/malformed → false (no corroboration). */
export const readRankingCueOverride = (
  requestContext: RequestContext | undefined,
): boolean =>
  requestContext?.get(REQUEST_CONTEXT_KEYS.PENDING_RANKING_CUE) === true;

/**
 * Cross-checks the check-in date / guest count `find_room(book_resolve)`
 * echoed back against the guest's own latest message text. A value the
 * model attached without any corroborating cue in that text is treated as
 * unstated — so the BOOK step machine falls back to opening the Booking
 * Form instead of trusting an invented default.
 */
export const resolveCorroboratedBookFacts = (args: {
  messages: MastraDBMessage[] | undefined;
  statedCheckIn: string | undefined;
  statedGuests: number | undefined;
  statedNights?: number | undefined;
}): { checkInDate?: string; guests?: number; nights?: number } => {
  const { messages, statedCheckIn, statedGuests, statedNights } = args;

  const latestUserMessage = messages?.length
    ? findLatestUserMessage(messages)
    : undefined;
  const latestText = latestUserMessage
    ? extractMessageText(latestUserMessage)
    : "";

  // Read straight out of the guest's own words first — a stay length is plain
  // enough to parse, so the model's interpretation of it is never needed. Only
  // fall back to the echoed value when the text has a stay-length cue the
  // parser could not turn into a night count ("a week", "a couple of nights").
  const nights =
    resolveStatedNights(latestText) ??
    (statedNights && hasStatedStayLengthCue(latestText)
      ? statedNights
      : undefined);

  return {
    ...(statedCheckIn && hasStatedCheckInCue(latestText)
      ? { checkInDate: statedCheckIn }
      : {}),
    ...(statedGuests && hasStatedGuestCue(latestText)
      ? { guests: statedGuests }
      : {}),
    ...(nights ? { nights } : {}),
  };
};
