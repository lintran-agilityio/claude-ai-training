/**
 * Client-side availability check against `/api/bookings/availability` — used by
 * the CREATE Booking Form and the MODIFY edit form (`useRoomAvailability`).
 * The app has no `check_room_availability` agent tool.
 */
export type CheckRoomAvailabilityInput = {
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  guests?: number;
  /** MODIFY only — exclude the booking being edited from overlap detection. */
  excludeBookingId?: string;
};

export type CheckRoomAvailabilityResult = {
  available?: boolean;
  guestsWithinCapacity?: boolean;
  /** Whether the dates alone are free, independent of guest count. */
  datesAvailable?: boolean;
  room?: {
    name?: string;
    capacity?: number;
  };
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
};
