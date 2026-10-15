import { toRoomResponseDto } from '@/modules/rooms/mappers/room.mapper';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import { BookingResponseDto } from '@/modules/booking/dto/booking-response.dto';

export const toBookingResponseDto = (
  booking: BookingEntity,
): BookingResponseDto => {
  const response: BookingResponseDto = {
    id: booking.id,
    userId: booking.userId,
    roomId: booking.roomId,
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    guests: booking.guests,
    totalPrice: booking.totalPrice,
    status: booking.status,
    cancelledAt: booking.cancelledAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };

  if (booking.room) {
    response.room = toRoomResponseDto(booking.room);
  }

  return response;
};
