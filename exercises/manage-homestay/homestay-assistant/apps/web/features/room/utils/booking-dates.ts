import { isCheckOutAfterCheckIn, resolveStayCheckOut } from "@repo/utils";

/**
 * Check-out to show after the guest picks a check-in date.
 *
 * An existing check-out that is still after the new check-in is kept — the
 * guest chose it. Otherwise it is recomputed from the stay length.
 *
 * @param nights - Stated stay length. Defaults to one night, which is what the
 *   MODIFY edit form relies on (it has real dates already and never passes
 *   this). The CREATE booking form passes the length the guest stated, so
 *   "4 nights" + a check-in of Sep 18 resolves to Sep 22, not Sep 19.
 */
export const resolveCheckOutAfterCheckInChange = (
  checkInDateKey: string,
  checkOutDate: string | null,
  nights?: number,
) => {
  const nextCheckOut =
    checkOutDate && isCheckOutAfterCheckIn(checkInDateKey, checkOutDate)
      ? checkOutDate
      : resolveStayCheckOut(checkInDateKey, nights);

  return {
    checkInDate: checkInDateKey,
    checkOutDate: nextCheckOut,
  };
};
