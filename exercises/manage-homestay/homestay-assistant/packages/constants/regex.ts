// -----------------------------------------------------------------------------
// Month patterns
// -----------------------------------------------------------------------------

/** Month names, full or abbreviated. */
export const MONTH_PATTERN =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/** ISO date format: YYYY-MM-DD. */
export const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// -----------------------------------------------------------------------------
// Shared unit-word fragments
//
// A number immediately followed by one of these words is a guest count or a
// stay length, never a day-of-month — kept in one place (instead of duplicated
// inline in GUEST_COUNT_CUE, STAY_LENGTH_CUE and BARE_DAY_CUE's exclusion) so a
// new unit word (another language, "weeks", "months", ...) only needs to be
// added once and every pattern picks it up.
// -----------------------------------------------------------------------------

/** Guest-count units, e.g. "2 guests", "4 khách". */
export const GUEST_COUNT_UNIT_WORDS =
  "guests?|people|persons?|pax|adults?|khách|người";

/** Stay-length units, e.g. "4 nights", "2 weeks", "3 tuần". */
export const STAY_LENGTH_UNIT_WORDS =
  "nights?|days?|weeks?|months?|đêm|ngày|tuần|tháng";

// -----------------------------------------------------------------------------
// Date patterns
// -----------------------------------------------------------------------------

/**
 * Matches an ISO date appearing anywhere in text.
 *
 * Example:
 * - "check in 2026-08-15"
 */
export const YMD_DATE_CUE = /\d{4}-\d{2}-\d{2}/;
/**
 * Matches date expressions introduced by "at", "on", or "for".
 *
 * Examples:
 * - on August 15
 * - for August 15, 2026
 * - on 15 August
 * - at 15th August 2026
 * - on 2026-08-15
 */
export const DATE_CUE = new RegExp(
  `\\b(?:at|on|for)\\s+((?:${MONTH_PATTERN})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_PATTERN})(?:,?\\s*\\d{4})?|\\d{4}-\\d{2}-\\d{2})\\b`,
  "i",
);

/**
 * A month name next to a day number, with NO preposition required — "September
 * 18", "18 September", "starting Sep 18", "from 18th August".
 *
 * {@link DATE_CUE} only recognises a month-day introduced by at/on/for, so
 * "for 4 nights starting September 18" carried no date cue of its own. That gap
 * used to be masked: {@link BARE_DAY_CUE} matched the bare `for <number>` in an
 * unrelated "for 2 people", which vouched for the date by accident. Excluding
 * unit words from BARE_DAY_CUE removed the accident — and would have removed the
 * coverage with it — so the real cue is spelled out here instead.
 *
 * The day may not be followed by a guest-count or stay-length unit, which keeps
 * the month-name-that-is-also-a-word cases out ("may 5 guests stay", "march 2
 * nights").
 */
export const MONTH_DAY_CUE = new RegExp(
  `\\b(?:(?:${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?|(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:${MONTH_PATTERN}))\\b(?!\\s*(?:${GUEST_COUNT_UNIT_WORDS}|${STAY_LENGTH_UNIT_WORDS})\\b)`,
  "i",
);

/** Month-first date, e.g. "August 15" or "August 15, 2026". */
export const MONTH_FIRST_DATE =
  /^(\S+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/i;

/** Day-first date, e.g. "15 August" or "15th August 2026". */
export const DAY_FIRST_DATE =
  /^(\d{1,2})(?:st|nd|rd|th)?\s+(\S+)(?:,?\s*(\d{4}))?$/i;

/**
 * Bare day cue, e.g. "at 15" or "on the 15th".
 *
 * Excludes a number immediately followed by a guest-count or stay-length unit
 * ("for 4 people", "for 4 nights", "for 3 weeks") — those are party size or
 * stay duration, not a day-of-month. Without this exclusion "for 4 people"
 * corroborated a check-in date the guest never gave, which is what let the
 * model turn "in 4 nights" into today + 4 (see `hasStatedCheckInCue` in
 * book-form-prefill.ts).
 */
export const BARE_DAY_CUE = new RegExp(
  `\\b(?:at|on|for)(?:\\s+the)?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:${GUEST_COUNT_UNIT_WORDS}|${STAY_LENGTH_UNIT_WORDS})\\b)`,
  "i",
);

// -----------------------------------------------------------------------------
// Relative date patterns
// -----------------------------------------------------------------------------

/** English relative dates: today, tonight, tomorrow. */
export const TODAY_TONIGHT_TOMORROW_CUE =
  /\b(today|tonight|tomorrow)\b/i;

/** English weekday names. */
export const WEEKDAY_CUE =
  /\b(mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(day)?\b/i;

/**
 * Vietnamese date expressions.
 *
 * Examples:
 * - hôm nay
 * - tối nay
 * - ngày mai
 * - cuối tuần
 * - thứ 2 ... thứ 7
 * - chủ nhật
 * - ngày 15
 */
export const VI_DATE_CUE =
  /\b(hôm\s*nay|tối\s*nay|ngày\s*mai|cuối\s*tuần|th(ứ|u)\s*[2-7]|chủ\s*nhật|ngày\s*\d{1,2})\b/i;

/**
 * Vietnamese-specific letters — enough to tell a VI guest message apart from
 * EN. Shared by the agent (RoomComparison heading language) and the web chat
 * (fixed compare pointer line) so both pick the same language.
 */
export const VIETNAMESE_LETTER =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;


// -----------------------------------------------------------------------------
// Weekend patterns
// -----------------------------------------------------------------------------

/** "weekend" / "weekends", e.g. "at weekend", "this weekend". */
export const WEEKEND_CUE = /\bweekends?\b/i;

/** "next weekend" — check before WEEKEND_CUE. */
export const NEXT_WEEKEND_CUE = /\bnext\s+weekends?\b/i;

/** "last/past/previous weekend" — check before WEEKEND_CUE. */
export const LAST_WEEKEND_CUE =
  /\b(?:last|past|previous)\s+weekends?\b/i;

// -----------------------------------------------------------------------------
// Booking constraint patterns
// -----------------------------------------------------------------------------

/** Guest count expressions, e.g. "2 guests", "3 people", "4 khách". */
export const GUEST_COUNT_CUE = new RegExp(
  `\\d+\\s*(?:${GUEST_COUNT_UNIT_WORDS})\\b`,
  "i",
);

/**
 * Stay LENGTH expressions, e.g. "4 nights", "in 3 days", "2 tuần" — capturing,
 * so the count and its unit can be read out rather than merely detected (see
 * `resolveStatedNights` in book-form-prefill.ts).
 *
 * A stay length says how LONG the stay is, never WHEN it starts: "in 4 nights"
 * must never become a check-in date of today + 4.
 *
 * Not global — a module-level regex reused with `.test()`/`.exec()` would carry
 * `lastIndex` across calls.
 */
export const STAY_LENGTH_CUE = new RegExp(
  `\\b(\\d{1,2})\\s*(${STAY_LENGTH_UNIT_WORDS})\\b`,
  "i",
);

/**
 * Guest phrasing the model often copies into `find_room.date`
 * ("from 15th", "on Aug 15"). Stripped only in FIND sanitize so
 * LIST_MY_BOOKINGS preposition rules stay unchanged.
 */
export const LEADING_DATE_GLUE = /^(?:from|on|at|for)(?:\s+the)?\s+/i;

export const ROOM_LEVEL_CATEGORY_WORD =
  /\b(?:luxury|premium|top[-\s]?floor|penthouse)\b/i;

export const ROOM_LEVEL_CATEGORY_WORD_GLOBAL = new RegExp(
  ROOM_LEVEL_CATEGORY_WORD.source,
  "gi",
);

/**
 * Filler words the model may paste into `name` from the guest message.
 * Include date-phrase glue ("at weekend", "on Monday", "from today") so
 * residual crumbs like "at" do not become a literal room-name LIKE filter
 * (API returns [] for `name=at`).
 */
export const ROOM_NAME_FILLER =
  /\b(?:show|find|search|look|for|your|the|me|a|an|our|available|matching|rooms?|suites?|guests?|at|on|in|from|this|next|by|with|to|st|nd|rd|th)\b/gi;

/**
 * Weekdays, months, and relative date words — date expression parts, never room titles.
 * Keep in sync with soft-book / find_room prompt rules.
 */
export const ROOM_CALENDAR_WORD =
  /\b(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|today|tonight|tomorrow|weekend)\b/i;

export const ROOM_CALENDAR_WORD_GLOBAL = new RegExp(
  ROOM_CALENDAR_WORD.source,
  "gi",
);

// -----------------------------------------------------------------------------
// Room ranking / price-ceiling patterns
// -----------------------------------------------------------------------------

/** English cheap/expensive/amenities wording for find_room sortBy. */
export const ROOM_RANKING_CUE =
  /\b(cheap(?:est)?|afford(?:able)?|budget|best[-\s]?price|lowest[-\s]?price|low[-\s]?price|most\s+expensive|pricey|priciest|highest[-\s]?price|most\s+(?:amenit(?:y|ies)|facilit(?:y|ies))|best[-\s]?equipped)\b/i;

/**
 * Numeric price-ceiling wording for find_room maxPrice, e.g. "under 1,000,000",
 * "below 500k", "max 2 million".
 */
export const ROOM_PRICE_CEILING_CUE =
  /\b(?:under|below|less\s+than|no\s+more\s+than|max(?:imum)?|up\s+to)\s*[\d.,]+\s*(?:k|m|million|vnd)?\b/i;