import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import { UpcomingBookingItemDto } from '@/modules/booking/dto/upcoming-bookings-response.dto';

export const toUpcomingBookingItemDto = (
  booking: BookingEntity,
  date: string,
): UpcomingBookingItemDto => ({
  id: booking.id,
  roomName: booking.room?.name ?? booking.roomId,
  guests: booking.guests,
  guestName: booking.user?.name ?? booking.user?.email ?? booking.userId,
  date,
});
