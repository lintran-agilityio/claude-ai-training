import { z } from "zod";

/**
 * Reason codes for booking-unavailable generative UI / HITL.
 *
 * `capacity_and_dates_unavailable` covers a party that exceeds room.capacity
 * AND a stay whose dates are separately taken — both facts are real and must
 * both be told to the guest, not collapsed into whichever one is checked
 * first. See {@link resolveBookingUnavailableReason}.
 */
export const bookingUnavailableReasonSchema = z.enum([
  "dates_unavailable",
  "capacity_exceeded",
  "capacity_and_dates_unavailable",
]);

export type BookingUnavailableReason = z.infer<
  typeof bookingUnavailableReasonSchema
>;

/**
 * The facts an availability probe/check can carry, in the shape shared by the
 * CREATE probe ({@link import("./find-room-output").findRoomAvailabilitySchema}
 * once wired), the MODIFY probe, and the booking-forms' client-side check —
 * whichever fields a given caller has.
 */
type AvailabilityFacts = {
  /** False when the party exceeds room.capacity. */
  guestsWithinCapacity?: boolean;
  /**
   * False when the requested dates are actually taken. `undefined` means
   * dates were never evaluated (no check-in date was known yet — see the
   * CREATE probe's dateless over-capacity check) and must NOT be read as
   * "unavailable": a guest over capacity with no stated dates yet gets
   * `capacity_exceeded`, never the combined reason.
   */
  datesAvailable?: boolean;
};

/**
 * Single source of truth for turning raw availability flags into the reason
 * code the `BookingUnavailable` card renders — shared by the CREATE
 * (`find_room(book_resolve)`) and MODIFY (`find_booking_by_id`) probes and the
 * booking forms' own client-side check, so the three call sites can never
 * disagree about which reason a given combination of flags means.
 *
 * Deliberately keys off `datesAvailable`, not the combined `available` flag —
 * `available` is `datesAvailable && guestsWithinCapacity`, so it is ALWAYS
 * false once capacity fails even when the dates themselves are perfectly
 * free, which would wrongly claim "these dates are taken" for a guest whose
 * only real problem is party size.
 */
export const resolveBookingUnavailableReason = (
  availability: AvailabilityFacts | null | undefined,
): BookingUnavailableReason | null => {
  if (!availability) {
    return null;
  }

  const capacityOk = availability.guestsWithinCapacity !== false;
  const datesOk = availability.datesAvailable !== false;

  if (capacityOk && datesOk) {
    return null;
  }

  if (!capacityOk && !datesOk) {
    return "capacity_and_dates_unavailable";
  }

  return capacityOk ? "dates_unavailable" : "capacity_exceeded";
};

/**
 * Short inline validation text for the booking forms (the CREATE Booking Form
 * and the MODIFY edit form) when `useRoomAvailability` reports a blocking
 * `reason` next to the date/guest pickers. Distinct from the richer
 * `BookingUnavailable` chat-card copy — this is a one-line "why is the button
 * disabled" hint, shared so the two forms can never drift out of sync on
 * what each reason means (they previously duplicated a 2-way ternary each,
 * neither of which had a case for `capacity_and_dates_unavailable`).
 */
export const describeBookingUnavailableIssue = (
  reason: BookingUnavailableReason,
  capacity: number,
): string => {
  const capacityText = `This room sleeps at most ${capacity} guest${capacity === 1 ? "" : "s"}.`;
  const datesText = "These dates are already booked.";

  if (reason === "capacity_exceeded") {
    return `${capacityText} Reduce the guest count to continue.`;
  }

  if (reason === "dates_unavailable") {
    return `${datesText} Pick different dates to continue.`;
  }

  return `${capacityText} ${datesText} Reduce the guest count and pick different dates to continue.`;
};
