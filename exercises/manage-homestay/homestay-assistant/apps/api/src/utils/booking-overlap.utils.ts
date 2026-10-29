import { BookingStatus } from '../types/enum';

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

/**
 * Statuses whose date range holds a room: used for overlap, occupancy and
 * availability checks. Includes CHECKED_IN (guest currently staying).
 */
export const OCCUPYING_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];

export const BOOKING_OVERLAP_JOIN_CONDITION =
  'booking.status IN (:...activeStatuses) AND booking.checkInDate < :checkOutDate AND booking.checkOutDate > :checkInDate';
