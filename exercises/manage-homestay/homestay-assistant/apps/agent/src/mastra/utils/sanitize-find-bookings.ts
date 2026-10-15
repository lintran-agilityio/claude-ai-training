import { TOOL_PURPOSE } from "@repo/constants";
import type { FindBookingsInput } from "@repo/schemas";

/**
 * Deterministic gate, not a prompt trust exercise: `dateFrom`/`dateTo` only
 * ever make sense for CANCEL's stated-date disambiguation. A model can (and
 * reproducibly does — gpt-4o-mini does this for "extend my stay one more
 * day") misread a MODIFY's relative extend/shorten phrasing as a date cue
 * and invent a today→tomorrow range, which would silently exclude the real
 * booking from `find_bookings`' overlap filter. Stripping here means that
 * mistake can never reach the query regardless of what `purpose` the model
 * reports or forgets to report — only an explicit `purpose: "cancel"` lets
 * `dateFrom`/`dateTo` through.
 */
export const applyFindBookingsDateGate = (
  params: FindBookingsInput,
): Omit<FindBookingsInput, "purpose"> => {
  const { purpose, dateFrom, dateTo, ...rest } = params;
  const isCancel = purpose === TOOL_PURPOSE.FIND_BOOKINGS.CANCEL;

  return { ...rest, ...(isCancel ? { dateFrom, dateTo } : {}) };
};
