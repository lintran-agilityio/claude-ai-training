import { BookingStatus } from '../types/enum';

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

export const BOOKING_OVERLAP_JOIN_CONDITION =
  'booking.status IN (:...activeStatuses) AND booking.checkInDate < :checkOutDate AND booking.checkOutDate > :checkInDate';
