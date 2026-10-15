export type ModifyStayFields = {
  checkInDate: string;
  checkOutDate: string;
  guests: number;
};

/**
 * True when two stay snapshots share the same check-in, check-out, and guests.
 * Used to detect a no-op MODIFY (the merged stated change equals the booking's
 * current stay) inside `find_booking_by_id(purpose:"modify")`.
 */
export const isSameModifyStay = (
  currentValue: ModifyStayFields,
  newValue: ModifyStayFields,
): boolean =>
  currentValue.checkInDate === newValue.checkInDate &&
  currentValue.checkOutDate === newValue.checkOutDate &&
  currentValue.guests === newValue.guests;
