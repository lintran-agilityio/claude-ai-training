import { Injectable, NotFoundException } from '@nestjs/common';

import { addDays, isEmptyDateValue, resolveDateOrToday } from '@/utils';
import {
  GetRoomByIdQueryDto,
  GetAvailableRoomsQueryDto,
  RoomResponseDto,
} from '@/modules/rooms/dto';
import { toRoomResponseDto } from '@/modules/rooms/mappers/room.mapper';
import { RoomsRepository } from '@/modules/rooms/repositories/rooms.repository';
import { toOptionalNumber } from '@/modules/rooms/utils/rooms';

@Injectable()
export class RoomsService {
  constructor(private readonly roomsRepository: RoomsRepository) {}

  /**
   * Lists rooms, optionally filtered by date availability, name, guests, and level.
   * Guest count matches \`capacity >= guests\` (not exact equality); results prefer
   * the smallest sufficient capacity.
   *
   * @param query - Optional filters; empty returns all rooms
   * @returns Room response DTOs
   */
  async getRooms(
    query: GetAvailableRoomsQueryDto = {},
  ): Promise<RoomResponseDto[]> {
    const { maxPrice = '', sortBy } = query;
    const name = query.name?.trim() || undefined;
    const guests = toOptionalNumber(
      query.guests as number | string | undefined,
    );
    const level = toOptionalNumber(query.level as number | string | undefined);
    const maxPriceValue = maxPrice ? toOptionalNumber(maxPrice) : undefined;
    const hasDate = !isEmptyDateValue(query.date);
    const hasAttributeFilters =
      Boolean(name) || guests !== undefined || level !== undefined;

    // Empty lists are a valid search/browse outcome — return [] (not 404)
    // so agent tools can complete and chat UI can leave the loading state.
    if (!hasDate && !hasAttributeFilters) {
      const rooms = await this.roomsRepository.findAll({
        sortBy,
        maxPrice: maxPriceValue,
      });
      return (rooms ?? []).map(toRoomResponseDto);
    }

    // Date-only browse keeps the dedicated availability path
    if (hasDate && !hasAttributeFilters) {
      const checkInDate = resolveDateOrToday(query.date);
      const checkOutDate = addDays(checkInDate, 1);
      const rooms = await this.roomsRepository.findAvailableBetween(
        checkInDate,
        checkOutDate,
        { sortBy, maxPrice: maxPriceValue },
      );
      return (rooms ?? []).map(toRoomResponseDto);
    }

    let checkInDate: Date | undefined;
    let checkOutDate: Date | undefined;
    if (hasDate) {
      checkInDate = resolveDateOrToday(query.date);
      checkOutDate = addDays(checkInDate, 1);
    }

    const rooms = await this.roomsRepository.findByFilters({
      name,
      guests,
      level,
      checkInDate,
      checkOutDate,
      sortBy,
      maxPrice: maxPriceValue,
    });

    return (rooms ?? []).map(toRoomResponseDto);
  }

  /**
   * Returns a single room by id, optionally including the user's active booking.
   *
   * @param id - Room id
   * @param query - Optional userId for booking context
   * @returns Room response DTO
   * @throws NotFoundException when the room does not exist
   */
  async getRoomById(
    id: string,
    query: GetRoomByIdQueryDto = {},
  ): Promise<RoomResponseDto> {
    const room = await this.roomsRepository.findById(id, query.userId);
    if (!room) {
      throw new NotFoundException(`Room with id "${id}" not found`);
    }

    const response = toRoomResponseDto(room);

    const activeBooking = room.bookings?.[0];
    if (activeBooking) {
      response.bookingStatus = activeBooking.status;
      response.checkInDate = activeBooking.checkInDate;
      response.checkOutDate = activeBooking.checkOutDate;
    }

    return response;
  }
}
