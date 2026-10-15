import {
  parseMonthName,
  resolveCalendarDate,
  resolveDayOfMonthDate,
  toYmd,
} from "./date.js";
import {
  DATE_CUE,
  MONTH_FIRST_DATE,
  DAY_FIRST_DATE,
  BARE_DAY_CUE,
} from "@repo/constants";

const parseMonthDayPhrase = (value: string, today: string): string | null => {
  const input = value.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);

  if (iso) {
    return toYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const monthFirst = MONTH_FIRST_DATE.exec(value);

  if (monthFirst) {
    const month = parseMonthName(monthFirst[1] ?? "");

    if (!month) return null;

    return resolveCalendarDate(
      today,
      month,
      Number(monthFirst[2]),
      monthFirst[3] ? Number(monthFirst[3]) : undefined,
    );
  }

  const dayFirst = DAY_FIRST_DATE.exec(value);

  if (dayFirst) {
    const month = parseMonthName(dayFirst[2] ?? "");

    if (!month) return null;

    return resolveCalendarDate(
      today,
      month,
      Number(dayFirst[1]),
      dayFirst[3] ? Number(dayFirst[3]) : undefined,
    );
  }

  return null;
};

/**
 * Parses an optional date cue from a "my bookings" request.
 *
 * Supported:
 * - "on August 15"
 * - "on 15 August"
 * - "on August 15, 2026"
 * - "on 15 August 2026"
 * - "on 2026-08-15"
 * - "on the 15th"
 * - "at 15"
 *
 * Bare day values use today's month.
 */
export const parseListMyBookingsOnDate = (
  message: string,
  today: string,
): string | null => {
  const text = message.trim();

  if (!text) return null;

  const monthDayMatch = DATE_CUE.exec(text);

  if (monthDayMatch?.[1]) {
    const parsed = parseMonthDayPhrase(monthDayMatch[1], today);

    if (parsed) return parsed;
  }

  const bareDayMatch = BARE_DAY_CUE.exec(text);

  if (bareDayMatch?.[1]) {
    return resolveDayOfMonthDate(today, Number(bareDayMatch[1]));
  }

  return null;
};
