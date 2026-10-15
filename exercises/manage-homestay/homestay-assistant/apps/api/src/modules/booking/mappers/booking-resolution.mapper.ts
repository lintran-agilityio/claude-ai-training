import type {
  BookingResolution,
  BookingResponseDto,
} from '@/modules/booking/dto';

export const toBookingResolution = (
  bookings: BookingResponseDto[],
): BookingResolution => {
  if (bookings.length === 0) {
    return { status: 'not_found', bookings: [] };
  }

  if (bookings.length === 1) {
    return { status: 'resolved', booking: bookings[0]! };
  }

  return { status: 'ambiguous', bookings };
};
