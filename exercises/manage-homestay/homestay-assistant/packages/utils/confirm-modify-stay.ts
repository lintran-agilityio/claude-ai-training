/**
 * MODIFY stated-change path: derive the authoritative confirm_modify_booking
 * stay straight from a resolved `find_booking_by_id` result, instead of
 * trusting the values the model re-transcribes into the forced
 * `confirm_modify_booking` HITL call.
 *
 * Why this exists: after `find_booking_by_id(purpose:"modify")` resolves the
 * relative check-out delta and probes availability, the booking step machine
 * forces `confirm_modify_booking`. That HITL call's args are model-authored,
 * and a weak model routinely copies the booking's ORIGINAL check-out into
 * `checkOutDate` (both the original and the probed date sit in the result),
 * or drops the `room` object. The confirm card then sees `original === next`,
 * `buildModifyChangeRows()` returns `[]`, and it hides itself as a no-op — the
 * guest gets the companion sentence ("Please review and confirm the changes.")
 * and no card. Reading the merged stay off `result.availability` (and the
 * original off the booking row) makes the card deterministic.
 *
 * Which result a card may read is decided by `modify-episode.ts` — never scan
 * the whole transcript for "the latest" lookup.
 */

export type ConfirmModifyStaySnapshot = {
  checkInDate: string;
  checkOutDate: string;
  guests: number;
};

export type ConfirmModifyStayResolution<TRoom> = {
  /** Resolved booking id, echoed off the result (not the model's args). */
  bookingId?: string;
  room?: TRoom;
  /** Merged stay the availability probe cleared (current stay + stated overrides). */
  proposed: ConfirmModifyStaySnapshot;
  /** Current booking stay, for the before → after diff. */
  original: ConfirmModifyStaySnapshot;
};

export type FindBookingByIdRowLike = {
  bookingId?: string;
  roomId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
};

export type FindBookingByIdResultLike<TRoom> = {
  bookings?: FindBookingByIdRowLike[];
  room?: TRoom;
  requestedCheckInDate?: string;
  requestedCheckOutDate?: string;
  requestedGuests?: number;
  availability?: {
    available?: boolean;
    guestsWithinCapacity?: boolean;
    checkInDate?: string;
    checkOutDate?: string;
    guests?: number;
  };
  stayUnchanged?: boolean;
};

/** A booking row whose current stay is complete enough to diff against. */
export type FindBookingByIdRow = FindBookingByIdRowLike &
  ConfirmModifyStaySnapshot;

/**
 * The booking row a `find_booking_by_id` result describes.
 *
 * With a `bookingId` the match is strict. Falling back to `bookings[0]` let
 * booking A's lookup answer a confirm card for booking B: B's card rendered
 * A's room and stay, and its Confirm sent B's `bookingId` with A's dates, which
 * `update_booking` then wrote to B.
 */
export const selectFindBookingRow = (
  result: Pick<FindBookingByIdResultLike<unknown>, "bookings"> | null | undefined,
  bookingId?: string,
): FindBookingByIdRow | null => {
  const wanted = bookingId?.trim();
  const row = wanted
    ? result?.bookings?.find((candidate) => candidate?.bookingId?.trim() === wanted)
    : result?.bookings?.[0];

  if (
    !row?.checkInDate?.trim() ||
    !row.checkOutDate?.trim() ||
    typeof row.guests !== "number"
  ) {
    return null;
  }

  return row as FindBookingByIdRow;
};

export const toConfirmModifyStaySnapshot = (
  stay: ConfirmModifyStaySnapshot,
): ConfirmModifyStaySnapshot => ({
  checkInDate: stay.checkInDate,
  checkOutDate: stay.checkOutDate,
  guests: stay.guests,
});

/** True when the probe ran and reported the merged stay taken / over capacity. */
export const isModifyProbeUnavailable = (
  result: Pick<FindBookingByIdResultLike<unknown>, "availability">,
): boolean =>
  result.availability?.available === false ||
  result.availability?.guestsWithinCapacity === false;

/** The merged stay a free availability probe cleared, or null without a free probe. */
export const selectProbedModifyStay = (
  result: Pick<FindBookingByIdResultLike<unknown>, "availability">,
  booking: ConfirmModifyStaySnapshot,
): ConfirmModifyStaySnapshot | null => {
  const availability = result.availability;
  if (!availability || isModifyProbeUnavailable(result)) {
    return null;
  }

  return {
    checkInDate: availability.checkInDate?.trim() || booking.checkInDate,
    checkOutDate: availability.checkOutDate?.trim() || booking.checkOutDate,
    guests:
      typeof availability.guests === "number"
        ? availability.guests
        : booking.guests,
  };
};

/**
 * Authoritative confirm_modify_booking stay for the MODIFY *stated-change*
 * path, read off one resolved `find_booking_by_id` result.
 *
 * Returns `null` when the result is not a free stated-change probe for the
 * requested booking:
 *   - no `availability` block → no stated change (the edit form owns the turn), or
 *   - `available: false` / `guestsWithinCapacity: false` → the step machine
 *     stops the turn and BookingUnavailable renders — there is no confirm card, or
 *   - `bookingId` is not a row of this result → it describes another booking.
 */
export const selectConfirmModifyStayFromResult = <TRoom>(
  result: FindBookingByIdResultLike<TRoom> | null | undefined,
  bookingId?: string,
): ConfirmModifyStayResolution<TRoom> | null => {
  if (!result) {
    return null;
  }

  const booking = selectFindBookingRow(result, bookingId);
  if (!booking) {
    return null;
  }

  const proposed = selectProbedModifyStay(result, booking);
  if (!proposed) {
    return null;
  }

  return {
    bookingId: booking.bookingId?.trim() || undefined,
    room: result.room,
    proposed,
    original: toConfirmModifyStaySnapshot(booking),
  };
};
