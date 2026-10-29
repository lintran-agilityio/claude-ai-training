import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { UserRole } from '@/database/entities/enums';
import {
  addDays,
  isEmptyDateValue,
  parseDateRange,
  parseRequiredDate,
  resolveDateOrToday,
  toDateKey,
} from '@/utils';
import {
  AvailabilityOverviewQueryDto,
  AvailabilityOverviewResponseDto,
  GetRoomByIdQueryDto,
  GetAvailableRoomsQueryDto,
  CreateRoomDto,
  UpdateRoomDto,
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
   * Read-only availability overview for a date range. Everyone gets the free
   * rooms and counts; only managers get the `booked` list with guest names —
   * for any other role the key is omitted entirely.
   *
   * @param query - Start date and optional exclusive check-out date (default date + 1)
   * @param role - Role of the caller, resolved by ClerkAuthGuard
   * @throws BadRequestException when a date is invalid or checkOutDate <= date
   */
  async getAvailabilityOverview(
    query: AvailabilityOverviewQueryDto,
    role: UserRole,
  ): Promise<AvailabilityOverviewResponseDto> {
    const start = parseRequiredDate(query.date, 'date');
    const end = isEmptyDateValue(query.checkOutDate)
      ? addDays(start, 1)
      : parseRequiredDate(query.checkOutDate, 'checkOutDate');
    const { checkInDate, checkOutDate } = parseDateRange(
      toDateKey(start),
      toDateKey(end),
    );

    const [available, bookings, allRooms] = await Promise.all([
      this.roomsRepository.findAvailableBetween(checkInDate, checkOutDate),
      this.roomsRepository.findOverlappingBookings(checkInDate, checkOutDate),
      this.roomsRepository.findAll(),
    ]);

    const response: AvailabilityOverviewResponseDto = {
      date: toDateKey(checkInDate),
      checkOutDate: toDateKey(checkOutDate),
      available: available.map(toRoomResponseDto),
      summary: {
        total: allRooms.length,
        availableCount: available.length,
        bookedCount: new Set(bookings.map((booking) => booking.roomId)).size,
      },
    };

    if (role === UserRole.MANAGER) {
      response.booked = bookings.map((booking) => ({
        room: toRoomResponseDto(booking.room),
        bookingId: booking.id,
        guestName: booking.user.name?.trim() || booking.user.email,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
      }));
    }

    return response;
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

  /**
   * Creates a room.
   *
   * @throws BadRequestException when the name is blank or slots exceed capacity
   * @throws ConflictException when a room with the same name exists
   */
  async createRoom(dto: CreateRoomDto): Promise<RoomResponseDto> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Room name must not be blank');
    }
    this.assertSlotsWithinCapacity(dto.availableSlots, dto.capacity);
    await this.assertNameFree(name);

    const room = await this.roomsRepository.create({
      ...dto,
      name,
      id: randomUUID(),
    });
    return toRoomResponseDto(room);
  }

  /**
   * Updates the given fields of a room.
   *
   * @throws NotFoundException when the room does not exist
   * @throws BadRequestException on an empty update or slots above capacity
   * @throws ConflictException when the new name is already taken
   */
  async updateRoom(id: string, dto: UpdateRoomDto): Promise<RoomResponseDto> {
    const room = await this.roomsRepository.findById(id);
    if (!room) {
      throw new NotFoundException(`Room with id "${id}" not found`);
    }
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Room name must not be blank');
      }
      dto = { ...dto, name };
      if (name.toLowerCase() !== room.name.toLowerCase()) {
        await this.assertNameFree(name);
      }
    }

    this.assertSlotsWithinCapacity(
      dto.availableSlots ?? room.availableSlots,
      dto.capacity ?? room.capacity,
    );

    Object.assign(room, dto);
    return toRoomResponseDto(await this.roomsRepository.save(room));
  }

  /**
   * Deletes a room.
   *
   * @throws NotFoundException when the room does not exist
   * @throws ConflictException when the room has active bookings
   */
  async deleteRoom(id: string): Promise<void> {
    const room = await this.roomsRepository.findById(id);
    if (!room) {
      throw new NotFoundException(`Room with id "${id}" not found`);
    }
    if (await this.roomsRepository.hasActiveBookings(id)) {
      throw new ConflictException(
        'Room has active bookings and cannot be deleted',
      );
    }
    await this.roomsRepository.remove(room);
  }

  private assertSlotsWithinCapacity(slots: number, capacity: number): void {
    if (slots > capacity) {
      throw new BadRequestException('availableSlots must not exceed capacity');
    }
  }

  private async assertNameFree(name: string): Promise<void> {
    if (await this.roomsRepository.findByName(name)) {
      throw new ConflictException(`Room named "${name}" already exists`);
    }
  }
}
