import { TOOL_PURPOSE, DEFAULT_SORT_LIMIT } from "@repo/constants";
import type { FindRoomInput } from "@repo/schemas";
import type { FindRoomOutput } from "@/mastra/schemas/rooms";
import { buildFindRoomReplyHint } from "./generic-ui";
import {
  isCalendarOnlyRoomName,
  isRoomLevelCategoryName,
  sanitizeFindRoomName,
  sanitizeFindRoomDate
} from "./sanitize-find-room";
import {
  clearBookingFormStayHint,
  readBookingFormStayHint,
} from "./book-form-prefill";
import { resolveStayCheckOut } from "@repo/utils";

/** Top-floor / luxury category → floor level in seed catalog. */
export const LUXURY_ROOM_LEVEL = 4;

/**
 * `book_resolve` / `resolve` are name-only room lookups (a specific room was
 * named) — the matched room comes from `name` alone. `guests`/`date`/`level`
 * must never gate this match: the model can attach any of them to a named-room
 * call (e.g. inferring `level: 4` from "Loft" the way it would from "penthouse"),
 * and an inferred value narrower than the real room silently zeroes the result.
 * Relying on prompt wording or a category-word regex to catch every such
 * inference is unbounded — enforcing it here, in the schema transform every
 * find_room call passes through, is the only deterministic guarantee.
 */
const NAME_ONLY_FIND_ROOM_PURPOSES: ReadonlySet<FindRoomInput["purpose"]> =
  new Set([TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE, TOOL_PURPOSE.FIND_ROOM.RESOLVE]);

/**
 * Remaps mistaken `name` / relative `date` values so search hits the rooms API.
 *
 * @param input - Raw find_room tool args from the model
 * @param options.today - Optional YYYY-MM-DD for deterministic date resolution in tests
 * @returns Filters safe to send to the rooms API
 */
export const normalizeFindRoomInput = (
  input: FindRoomInput,
  options?: { today?: string },
): FindRoomInput => {
  if (NAME_ONLY_FIND_ROOM_PURPOSES.has(input.purpose)) {
    const rawName = input.name?.trim();
    let statedDate = sanitizeFindRoomDate(input.date, options?.today);
    if (!statedDate && rawName) {
      statedDate = sanitizeFindRoomDate(rawName, options?.today);
    }

    return {
      purpose: input.purpose,
      name: sanitizeFindRoomName(rawName),
      // Stated hints only — the tool never sends these to findRooms/the rooms
      // API as filters for a named-room lookup (see NAME_ONLY_FIND_ROOM_PURPOSES
      // above). Echoed on the output so the BOOK step machine can deterministically
      // decide whether check-in + guests are already known, instead of trusting
      // the model to re-read the latest message correctly a step later — and
      // (book_resolve + 1 match) they seed findRoomTool's own availability probe,
      // a separate /bookings/availability call, so the CREATE flow no longer
      // needs a check_room_availability tool call.
      ...(statedDate ? { date: statedDate } : {}),
      ...(input.guests ? { guests: input.guests } : {}),
      // Stay LENGTH, kept independently of `date`: "book X for 4 nights"
      // states one without the other, and dropping it here is what made a
      // four-night request silently become a one-night booking.
      ...(input.nights ? { nights: input.nights } : {}),
    };
  }

  const rawName = input.name?.trim();
  // Recover date cues the model stuffed into `name` before filler stripping
  // removes ordinals ("show available room at 16th" → date=YYYY-MM-DD).
  let date = sanitizeFindRoomDate(input.date, options?.today);
  if (!date && rawName) {
    date = sanitizeFindRoomDate(rawName, options?.today);
  }

  // Deterministic backstop for a ranking request with no explicit count
  // ("the most affordable rooms", "cheapest rooms") — mirrors the
  // wasCategory → LUXURY_ROOM_LEVEL backstop below. Singular ("the cheapest
  // room") and explicit-count ("the 3 cheapest rooms") phrasing must still
  // set `limit` themselves via the prompt; this only fills the gap when the
  // model correctly omits it for a plural, uncounted ranking request.
  const limit =
    input.sortBy && !input.limit ? DEFAULT_SORT_LIMIT : input.limit;

  if (!rawName) {
    return date === input.date && limit === input.limit
      ? input
      : { ...input, date, limit };
  }

  const wasCategory = isRoomLevelCategoryName(rawName);
  const name = sanitizeFindRoomName(rawName);

  if (
    name === rawName &&
    date === input.date &&
    limit === input.limit &&
    !wasCategory &&
    !isCalendarOnlyRoomName(rawName)
  ) {
    return input;
  }

  return {
    ...input,
    name,
    date,
    limit,
    ...(wasCategory ? { level: input.level ?? LUXURY_ROOM_LEVEL } : {}),
  };
};

/**
 * FIND / RECOMMEND results — the Room List cards the guest sees, and so the
 * only rooms `compare_rooms` may compare (see `resolveCompareCandidates`).
 * `book_resolve` / `resolve` lookups are never compared and must stay ID-only
 * during a booking flow.
 */
export const COMPARE_ELIGIBLE_PURPOSES: ReadonlySet<FindRoomOutput["purpose"]> =
  new Set([
    TOOL_PURPOSE.FIND_ROOM.SEARCH,
    TOOL_PURPOSE.FIND_ROOM.RECOMMEND,
    undefined,
  ]);

/**
 * Hard reply hint when the book_resolve availability probe came back
 * unavailable — mirrors `toCheckRoomAvailabilityModelOutput`'s
 * BookingUnavailable branch. The card (rendered from the raw result) owns every
 * detail, so the model gets no dates/guests/room facts to leak into chat.
 */
const BOOK_RESOLVE_UNAVAILABLE_REPLY_HINT =
  'BookingUnavailable Generic UI is already rendered and the turn is stopping. Reply with exactly ONE very short sentence in the guest\'s language offering to help — fewer guests, different dates, or another room, whichever fits. Do NOT repeat the room name, reason, capacity, dates, guests, or any availability value — the card shows them. English example: "I can help with a different guest count, other dates, or another room."';

/**
 * Model payload for find_room.
 *
 * FIND / RECOMMEND: `{ id, name }` per room — just enough to map "compare
 * Moonlight and Bamboo" / "the first two" onto `compare_rooms.roomIds`. No
 * prices, capacities or amenities: `compare_rooms` reads those from the raw
 * result itself, and the UI renders full cards from it, so the model never
 * holds a room fact it could leak into chat text.
 *
 * book_resolve / resolve: IDs only, so an internal lookup can never surface
 * names mid-booking.
 */
export const toFindRoomModelOutput = (output: FindRoomOutput) => {
  const matchCount = output.rooms.length;
  const includeRoomNames = COMPARE_ELIGIBLE_PURPOSES.has(output.purpose);

  const probe = output.availability;
  const probeUnavailable =
    probe && (probe.available === false || probe.guestsWithinCapacity === false);

  // book_resolve probe says taken / over capacity: the step machine stops the
  // turn and FindRoomNotice renders BookingUnavailable. Give the model a slim
  // payload + strict hint so it emits one minimal sentence, not a re-statement.
  if (probeUnavailable) {
    return {
      type: "json" as const,
      value: {
        matchCount,
        purpose: output.purpose,
        availability: {
          available: probe.available,
          guestsWithinCapacity: probe.guestsWithinCapacity,
        },
        replyHint: BOOK_RESOLVE_UNAVAILABLE_REPLY_HINT,
      },
    };
  }

  return {
    type: "json" as const,
    value: {
      matchCount,
      name: output.name,
      date: output.date,
      guests: output.guests,
      // Stated guest facts, same class as date/guests — no room fact leaks.
      // Echoed so a partial-info turn can pass `nights` straight on to
      // get_room_by_id; the form also gets it deterministically from the
      // stashed stay hint, so this is a convenience, not the mechanism.
      nights: output.nights,
      level: output.level,
      // Echoed (never maxPrice, never actual prices) so the model knows
      // these results are pre-ranked — e.g. it can say "these are the
      // cheapest options" — without learning any pricePerNight it could
      // leak into chat text.
      sortBy: output.sortBy,
      purpose: output.purpose,
      rooms: output.rooms.map((room) =>
        includeRoomNames ? { id: room.id, name: room.name } : { id: room.id },
      ),
      // book_resolve + 1 match, room free: the CREATE flow reads these
      // dates/guests into confirm_booking instead of calling
      // check_room_availability.
      ...(probe
        ? {
            availability: {
              available: probe.available,
              guestsWithinCapacity: probe.guestsWithinCapacity,
              checkInDate: probe.checkInDate,
              checkOutDate: probe.checkOutDate,
              guests: probe.guests,
            },
          }
        : {}),
      replyHint: buildFindRoomReplyHint(matchCount, output.purpose),
    },
  };
};

type GetRoomByIdInput = {
  roomId: string;
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
  nights?: number;
};

type RoomStay = {
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
  nights?: number;
};

/**
 * Resolve booking-form stay values from the current tool input
 * and the previous booking-form continuity hint.
 *
 * Explicit values from the current input always take precedence.
 */
export const resolveRoomStay = (
  input: GetRoomByIdInput,
  requestContext: Parameters<typeof readBookingFormStayHint>[0],
): RoomStay => {
  const {
    checkInDate,
    checkOutDate,
    guests: statedGuests,
    nights: statedNights,
  } = input;

  // Always read the hint and let the current input win field by field. This
  // used to be skipped entirely whenever `checkInDate` was present, which would
  // now throw away a stay length the hint carries and the input does not
  // ("book X for 4 nights" pins only `nights`). A hint date can never override
  // a stated one — `checkInDate` is applied first below, and the check-out is
  // recomputed from it rather than taken from the hint.
  const continuityHint = readBookingFormStayHint(requestContext);

  clearBookingFormStayHint(requestContext);

  const resolvedCheckIn = checkInDate ?? continuityHint?.checkInDate;
  const nights = statedNights ?? continuityHint?.nights;

  const resolvedCheckOut = checkInDate
    ? checkOutDate ?? resolveStayCheckOut(checkInDate, nights)
    : continuityHint?.checkOutDate;

  // Deliberately NOT clamped to room.capacity. Clamping turned "4 people" into
  // a silent 3 on a capacity-3 room, so the guest was never told the party did
  // not fit — they just saw a number they had not typed. Pass the stated count
  // through and let the form's own capacity check state the mismatch.
  const guests =
    statedGuests ?? continuityHint?.guests;

  return {
    ...(resolvedCheckIn && resolvedCheckOut
      ? {
          checkInDate: resolvedCheckIn,
          checkOutDate: resolvedCheckOut,
        }
      : {}),

    ...(guests && guests > 0
      ? {
          guests,
        }
      : {}),

    ...(nights ? { nights } : {}),
  };
};
