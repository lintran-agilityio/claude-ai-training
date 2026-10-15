import {
  addDaysYmd,
  getBusinessDates,
  getWeekendStay,
  parseListMyBookingsOnDate,
} from "@repo/utils";
import {
  LAST_WEEKEND_CUE,
  LEADING_DATE_GLUE,
  NEXT_WEEKEND_CUE,
  WEEKEND_CUE,
  YMD_PATTERN,
} from "@repo/constants";
import {
  ROOM_CALENDAR_WORD,
  ROOM_CALENDAR_WORD_GLOBAL,
  ROOM_LEVEL_CATEGORY_WORD,
  ROOM_LEVEL_CATEGORY_WORD_GLOBAL,
  ROOM_NAME_FILLER,
} from "@repo/constants";

const businessDatesFor = (todayOverride?: string) => {
  if (!todayOverride) {
    return getBusinessDates();
  }

  return { today: todayOverride, tomorrow: addDaysYmd(todayOverride, 1) };
};

/**
 * Resolve relative / guest date tokens the model often puts in `find_room.date`.
 * API requires absolute YYYY-MM-DD — `date=today` or `date=16th` is a 400 / empty search.
 *
 * Reuses shared guest-date parsing for ordinal / month-day tokens. FIND-only:
 * strip leading `from|on|at|for` before parsing so "from 15th" resolves without
 * widening LIST_MY_BOOKINGS preposition matching.
 *
 * @param date - Raw find_room.date from the model
 * @param todayOverride - Optional YYYY-MM-DD for deterministic tests
 */
export const sanitizeFindRoomDate = (
  date: string | undefined,
  todayOverride?: string,
): string | undefined => {
  const trimmed = date?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (YMD_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const { today, tomorrow } = businessDatesFor(todayOverride);
  const lower = trimmed.toLowerCase();

  if (lower === "today" || lower === "tonight") {
    return today;
  }

  if (lower === "tomorrow") {
    return tomorrow;
  }

  // "next weekend" / "last weekend" must be checked before the bare cue —
  // both also match WEEKEND_CUE, so checking it first would collapse them
  // all onto the current weekend (same ordering as parseListMyBookingsDateRange).
  if (NEXT_WEEKEND_CUE.test(lower)) {
    return getWeekendStay(today, 1).checkIn;
  }

  if (LAST_WEEKEND_CUE.test(lower)) {
    return getWeekendStay(today, -1).checkIn;
  }

  if (WEEKEND_CUE.test(lower)) {
    return getWeekendStay(today).checkIn;
  }

  const withoutGlue = trimmed.replace(LEADING_DATE_GLUE, "").trim() || trimmed;
  const resolved = parseListMyBookingsOnDate(`on ${withoutGlue}`, today);
  if (resolved) {
    return resolved;
  }

  // Unrecognized non-YMD — drop so we do not 400 the rooms API.
  return undefined;
};


/** Strip calendar / category / filler / digits so only a plausible room title remains. */
export const residualRoomName = (name: string): string =>
  name
    .replace(ROOM_CALENDAR_WORD_GLOBAL, " ")
    .replace(ROOM_LEVEL_CATEGORY_WORD_GLOBAL, " ")
    .replace(ROOM_NAME_FILLER, " ")
    .replace(/\d+/g, " ")
    // Ordinal crumbs left after digit strip ("16th" → "th") must not become LIKE filters.
    .replace(/\b(?:st|nd|rd|th)\b/gi, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True when `name` is only calendar language (e.g. "Mon", "Aug 10", "this weekend"). */
export const isCalendarOnlyRoomName = (name: string): boolean =>
  ROOM_CALENDAR_WORD.test(name) && residualRoomName(name).length === 0;

/**
 * True when `name` is category language (luxury/top-floor), not a room title.
 * LLMs often put these in `name`, which returns zero API matches.
 */
export const isRoomLevelCategoryName = (name: string): boolean =>
  ROOM_LEVEL_CATEGORY_WORD.test(name) && residualRoomName(name).length === 0;

/**
 * Drop inferred non-titles from `find_room.name`.
 * Calendar-only → undefined; category-only → undefined (caller may set level).
 * Mixed ("Mon Courtyard") → residual title only.
 */
export const sanitizeFindRoomName = (
  name: string | undefined,
): string | undefined => {
  const trimmed = name?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (isCalendarOnlyRoomName(trimmed) || isRoomLevelCategoryName(trimmed)) {
    return undefined;
  }

  const residual = residualRoomName(trimmed);
  if (!residual) {
    return undefined;
  }

  // Only rewrite when calendar/category tokens were present; keep original casing otherwise.
  if (residual.toLowerCase() === trimmed.toLowerCase()) {
    return trimmed;
  }

  return residual;
};
