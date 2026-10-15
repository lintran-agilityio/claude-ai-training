/** Homestay business calendar — keep "today"/"tomorrow" aligned with guest TZ. */
export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
});

const SATURDAY = 6;
const SUNDAY = 0;

export const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (value: string) =>
  startOfDay(new Date(`${value}T00:00:00`));

export const isCheckOutAfterCheckIn = (checkIn: string, checkOut: string) =>
  parseDateKey(checkOut).getTime() > parseDateKey(checkIn).getTime();

export const formatShortDateForDisplay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });


/** Format a Date as YYYY-MM-DD in the business timezone. */
export const formatYmd = (date: Date): string => {
  const parts = ymdFormatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format date as YYYY-MM-DD");
  }

  return `${year}-${month}-${day}`;
};

/** Today's calendar date as YYYY-MM-DD in the business timezone. */
export const formatTodayYmd = (now = new Date()): string => formatYmd(now);

/** True when `ymd` (YYYY-MM-DD) is today or later in the business timezone. */
export const isTimeTodayOrLater = (ymd: string, now = new Date()): boolean =>
  ymd >= formatTodayYmd(now);

/** True when `ymd` (YYYY-MM-DD) is strictly after today in the business timezone. */
export const isTimeInFuture = (ymd: string, now = new Date()): boolean =>
  ymd > formatTodayYmd(now);

/** Split YYYY-MM-DD into numeric parts, rejecting anything malformed. */
const splitYmd = (ymd: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) {
    throw new Error(`Invalid YYYY-MM-DD date: ${ymd}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

/** Add calendar days in the business timezone, return YYYY-MM-DD. */
export const addDaysYmd = (ymd: string, days: number): string => {
  const { year, month, day } = splitYmd(ymd);
  // Noon UTC avoids DST edge cases when shifting calendar days.
  const utc = Date.UTC(year, month - 1, day + days, 12, 0, 0);
  return formatYmd(new Date(utc));
};

/** Stay length assumed when the guest stated a check-in but no duration. */
export const DEFAULT_STAY_NIGHTS = 1;

/**
 * Check-out for a stay of `nights` starting at `checkInDate` — the single owner
 * of booking check-out arithmetic.
 *
 * Every CREATE-flow caller goes through this instead of an inline
 * `addDaysYmd(checkIn, 1)`, so a stated stay length ("4 nights") survives to the
 * booking instead of silently collapsing to one night. The model never does this
 * arithmetic; it only ever states the COUNT (mirroring how MODIFY handles
 * `requestedCheckOutDeltaDays`).
 *
 * A missing or nonsensical count (0, negative, fractional) falls back to one
 * night rather than throwing — `nights` reaches here from model output, and a
 * bad value must not break a booking the guest can still fix in the form. The
 * schema rejects those values first; this is defence in depth.
 */
export const resolveStayCheckOut = (
  checkInDate: string,
  nights?: number,
): string =>
  addDaysYmd(
    checkInDate,
    typeof nights === "number" && Number.isInteger(nights) && nights > 0
      ? nights
      : DEFAULT_STAY_NIGHTS,
  );

export type StayWindow = {
  checkInDate: string;
  checkOutDate: string;
};

/**
 * The bookable stay window for a CREATE flow, or `null` when the check-in date
 * is not yet known.
 *
 * Single owner of the "is there enough to probe/book" rule, so the
 * availability probe and the step machine that routes on its result can never
 * disagree about which dates were checked:
 *
 *   check-in given (stated, or a real earlier dated search) → that date + nights
 *   only a stay length, no check-in                         → null
 *   neither                                                 → null
 *
 * A stay length ("4 nights") on its own is deliberately NOT enough to form a
 * window — the platform never guesses a check-in date, even a plausible one
 * like today. When the check-in is unknown the caller opens the Booking Form
 * instead; `nights` still travels there as a hint so picking a check-in snaps
 * check-out to check-in + nights rather than a single night.
 */
export const resolveStayWindow = (args: {
  checkInDate?: string;
  nights?: number;
}): StayWindow | null => {
  const { checkInDate, nights } = args;

  if (!checkInDate) {
    return null;
  }

  return {
    checkInDate,
    checkOutDate: resolveStayCheckOut(checkInDate, nights),
  };
};

/**
 * Business calendar date read back as a UTC Date, so it can be inspected
 * (weekday, formatting) without a second timezone shift.
 */
const ymdToUtcDate = (ymd: string): Date => {
  const { year, month, day } = splitYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day));
};

/** Weekday of a business calendar date, 0 = Sunday. */
const getYmdWeekday = (ymd: string): number => ymdToUtcDate(ymd).getUTCDay();

export const formatYmdWeekday = (ymd: string): string =>
  weekdayFormatter.format(ymdToUtcDate(ymd));

/**
 * Resolves "this/next/last weekend" to a concrete Saturday-night stay. Models
 * cannot derive a weekday from a date reliably, so this must be computed here.
 *
 * `weekOffset` shifts by whole weeks: 0 (default) = this weekend, 1 = next
 * weekend, -1 = last weekend — mirrors {@link getWeekendRange}'s offset.
 *
 * A same-day check-in is fine on Saturday (a guest booking "the weekend"
 * that morning is booking a normal same-day stay). On Sunday the Saturday
 * night has already passed, so booking "this weekend" (offset 0) would
 * check the guest in for the last few hours of today — instead it rolls
 * forward to the next Saturday, same as "next weekend". Offset navigation
 * (explicit next/last) always anchors to Saturday untouched.
 */
export const getWeekendStay = (today: string, weekOffset = 0) => {
  const isCurrentWeekendAlreadyOver =
    weekOffset === 0 && getYmdWeekday(today) === SUNDAY;
  const effectiveOffset = isCurrentWeekendAlreadyOver ? 1 : weekOffset;

  const checkIn = getWeekendRange(today, effectiveOffset).from;
  return { checkIn, checkOut: addDaysYmd(checkIn, 1) };
};

/**
 * Saturday of the weekend spanning or next following `today`. Anchors to
 * Saturday regardless of weekday so offsetting by whole weeks lands on the
 * right Saturday–Sunday pair; callers needing "roll forward on Sunday"
 * semantics (e.g. {@link getWeekendStay}) apply that on top via `weekOffset`.
 */
const anchorWeekendSaturday = (today: string): string => {
  const weekday = getYmdWeekday(today);
  return weekday === SUNDAY
    ? addDaysYmd(today, -1)
    : addDaysYmd(today, (SATURDAY - weekday) % 7);
};

/**
 * Full Saturday+Sunday span for "my bookings at the weekend" range filtering —
 * distinct from {@link getWeekendStay}'s single Saturday-night stay (used for
 * new-booking search/create, where a 1-night default is correct).
 *
 * `weekOffset` shifts by whole weeks: 0 (default) = this/current weekend,
 * 1 = next weekend, -1 = last weekend.
 */
export const getWeekendRange = (today: string, weekOffset = 0) => {
  const from = addDaysYmd(anchorWeekendSaturday(today), weekOffset * 7);
  return { from, to: addDaysYmd(from, 2) };
};

/**
 * True when an active stay [checkInDate, checkOutDate) overlaps calendar
 * range [from, to) — same inclusive-checkin/exclusive-checkout convention as
 * {@link bookingStayIncludesDate}, generalized from a single date to a span.
 */
export const bookingStayOverlapsRange = (
  checkInDate: string,
  checkOutDate: string,
  from: string,
  to: string,
): boolean => checkInDate < to && checkOutDate > from;

export const getBusinessDates = (now = new Date()) => {
  const today = formatTodayYmd(now);
  const weekend = getWeekendStay(today);
  const nextWeekend = getWeekendStay(today, 1);

  return {
    today,
    todayWeekday: formatYmdWeekday(today),
    tomorrow: addDaysYmd(today, 1),
    weekendCheckIn: weekend.checkIn,
    weekendCheckOut: weekend.checkOut,
    nextWeekendCheckIn: nextWeekend.checkIn,
    nextWeekendCheckOut: nextWeekend.checkOut,
    timezone: BUSINESS_TIME_ZONE,
  };
};

const pad2 = (value: number) => String(value).padStart(2, "0");

export const toYmd = (year: number, month: number, day: number): string | null => {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const ymd = `${year}-${pad2(month)}-${pad2(day)}`;
  const parsed = new Date(`${ymd}T00:00:00`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return ymd;
};

/**
 * Resolves a month/day (optional year) to the next on-or-after `today` (YYYY-MM-DD).
 * Shared by create-booking draft extraction and modify stated-change parsing.
 */
export const resolveCalendarDate = (
  today: string,
  month: number,
  day: number,
  year?: number,
): string | null => {
  if (year != null) {
    return toYmd(year, month, day);
  }

  const todayYear = Number(today.slice(0, 4));
  const candidate = toYmd(todayYear, month, day);

  if (!candidate) {
    return null;
  }

  if (candidate >= today) {
    return candidate;
  }

  return toYmd(todayYear + 1, month, day);
};

/**
 * True when an active stay covers `onDate` (inclusive check-in, exclusive check-out).
 * Example: Aug 15→17 includes Aug 15 and Aug 16, not Aug 17.
 */
export const bookingStayIncludesDate = (
  checkInDate: string,
  checkOutDate: string,
  onDate: string,
): boolean => checkInDate <= onDate && checkOutDate > onDate;

/**
 * Resolves a bare day-of-month (e.g. "15", "15th") against `today`'s month/year
 * using {@link resolveCalendarDate} (next on-or-after today in business TZ).
 */
export const resolveDayOfMonthDate = (
  today: string,
  day: number,
): string | null => {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return null;
  }

  const month = Number(today.slice(5, 7));
  return resolveCalendarDate(today, month, day);
};

const MONTH_ALIASES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export const parseMonthName = (value: string): number | null =>
  MONTH_ALIASES[value.trim().toLowerCase()] ?? null;
