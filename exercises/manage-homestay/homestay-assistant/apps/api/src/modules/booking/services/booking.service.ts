import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { BookingStatus } from '../../../types/enum';
import { UsersService } from '@/modules/users/services/users.service';
import { addDays, parseDateRange, todayInTimeZone, toDateKey } from '@/utils';
import { UserRole } from '@/database/entities/enums';
import { RoomsRepository } from '@/modules/rooms/repositories/rooms.repository';
import { RoomEntity } from '@/modules/rooms/entities/room.entity';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import {
  AvailabilityResponseDto,
  BookingResponseDto,
  CheckAvailabilityQueryDto,
  CreateBookingDto,
  FindBookingsQueryDto,
  ListBookingsQueryDto,
  UpdateBookingDto,
  UpcomingBookingsQueryDto,
  UpcomingBookingsResponseDto,
  UpcomingPeriod,
  type BookingResolution,
} from '@/modules/booking/dto';
import { toBookingResponseDto } from '@/modules/booking/mappers/booking.mapper';
import { toUpcomingBookingItemDto } from '@/modules/booking/mappers/upcoming-booking.mapper';
import { toBookingResolution } from '@/modules/booking/mappers/booking-resolution.mapper';
import { BookingRepository } from '@/modules/booking/repositories/booking.repository';
import { toRoomResponseDto } from '@/modules/rooms/mappers/room.mapper';

const ALLOWED_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.CHECKED_IN,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
  [BookingStatus.CHECKED_OUT]: [],
  [BookingStatus.CANCELLED]: [],
};

@Injectable()
export class BookingService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly roomsRepository: RoomsRepository,
    private readonly usersService: UsersService,
  ) {}

  async create(
    dto: CreateBookingDto,
    userId: string,
  ): Promise<BookingResponseDto> {
    this.assertRequiredFields(dto, [
      'roomId',
      'checkInDate',
      'checkOutDate',
      'guests',
    ]);
    this.assertPositiveGuests(dto.guests);

    await this.usersService.findOrCreate(userId);

    const room = await this.getRoomOrThrow(dto.roomId);
    this.assertGuestCapacity(room, dto.guests);
    this.assertRoomHasSlots(room);

    const { checkInDate, checkOutDate, nights } = parseDateRange(
      dto.checkInDate,
      dto.checkOutDate,
    );

    await this.assertRoomAvailable(room.id, checkInDate, checkOutDate);

    const status = dto.status ?? BookingStatus.PENDING;
    this.assertValidStatus(status);

    const now = new Date();
    const booking = await this.bookingRepository.save({
      id: crypto.randomUUID(),
      userId,
      roomId: dto.roomId,
      checkInDate: toDateKey(checkInDate),
      checkOutDate: toDateKey(checkOutDate),
      guests: dto.guests,
      totalPrice: nights * room.pricePerNight,
      status,
      updatedAt: now,
    });

    const created = await this.bookingRepository.findById(booking.id);
    return toBookingResponseDto(created ?? booking);
  }

  async findAll(
    query: ListBookingsQueryDto = {},
    userId: string,
  ): Promise<BookingResponseDto[]> {
    const bookings = await this.bookingRepository.findAll({ ...query, userId });
    return bookings.map(toBookingResponseDto);
  }

  async findBookings(
    query: FindBookingsQueryDto,
    userId: string,
  ): Promise<BookingResolution> {
    const bookings = await this.findAll(query as ListBookingsQueryDto, userId);
    return toBookingResolution(bookings);
  }

  async findUpcoming(
    query: UpcomingBookingsQueryDto,
    userId: string,
    role: UserRole = UserRole.GUEST,
  ): Promise<UpcomingBookingsResponseDto> {
    const period = query.period ?? UpcomingPeriod.TODAY;
    const today = todayInTimeZone(process.env.PROPERTY_TIMEZONE);
    const start =
      period === UpcomingPeriod.TOMORROW ? addDays(today, 1) : today;
    const days = period === UpcomingPeriod.NEXT_3_DAYS ? 3 : 1;
    const from = toDateKey(start);
    const to = toDateKey(addDays(start, days));

    const { checkIns, checkOuts } = await this.bookingRepository.findUpcoming(
      // Managers (hosts) see every guest's arrivals/departures; guests only their own.
      role === UserRole.MANAGER ? null : userId,
      from,
      to,
    );

    return {
      period,
      from,
      to,
      checkIns: checkIns.map((b) => toUpcomingBookingItemDto(b, b.checkInDate)),
      checkOuts: checkOuts.map((b) =>
        toUpcomingBookingItemDto(b, b.checkOutDate),
      ),
    };
  }

  async findById(id: string, userId: string): Promise<BookingResponseDto> {
    const booking = await this.getOwnedBookingOrThrow(id, userId);
    return toBookingResponseDto(booking);
  }

  async checkAvailability(
    query: CheckAvailabilityQueryDto,
  ): Promise<AvailabilityResponseDto> {
    this.assertRequiredFields(query, ['roomId', 'checkInDate', 'checkOutDate']);

    const room = await this.getRoomOrThrow(query.roomId);
    const { checkInDate, checkOutDate } = parseDateRange(
      query.checkInDate,
      query.checkOutDate,
    );

    const datesAvailable = await this.isRoomAvailable(
      room,
      checkInDate,
      checkOutDate,
      query.excludeBookingId,
    );

    const guests = this.parseOptionalGuests(query.guests);

    let guestsWithinCapacity = true;
    if (guests != null) {
      this.assertPositiveGuests(guests);
      guestsWithinCapacity = guests <= room.capacity;
    }

    return {
      available: datesAvailable && guestsWithinCapacity,
      guestsWithinCapacity,
      datesAvailable,
      room: toRoomResponseDto(room),
      checkInDate: query.checkInDate,
      checkOutDate: query.checkOutDate,
      ...(guests != null ? { guests } : {}),
    };
  }

  async update(
    id: string,
    dto: UpdateBookingDto,
    userId: string,
  ): Promise<BookingResponseDto> {
    if (dto.status === BookingStatus.CANCELLED) {
      return this.cancel(id, userId);
    }

    const booking = await this.getOwnedBookingOrThrow(id, userId);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Cancelled bookings cannot be updated');
    }

    if (dto.status) {
      this.assertValidStatusTransition(booking.status, dto.status);
    }

    const nextCheckInDate = dto.checkInDate ?? booking.checkInDate;
    const nextCheckOutDate = dto.checkOutDate ?? booking.checkOutDate;
    const nextGuests = dto.guests ?? booking.guests;

    this.assertPositiveGuests(nextGuests);

    const { checkInDate, checkOutDate, nights } = parseDateRange(
      nextCheckInDate,
      nextCheckOutDate,
    );

    const room = await this.getRoomOrThrow(booking.roomId);
    this.assertGuestCapacity(room, nextGuests);
    this.assertRoomHasSlots(room);

    const nextStatus = dto.status ?? booking.status;

    const isStayChange =
      dto.checkInDate !== undefined ||
      dto.checkOutDate !== undefined ||
      dto.guests !== undefined;

    if (isStayChange) {
      this.assertModifiable(booking);
    }

    const shouldRecheckAvailability =
      dto.checkInDate !== undefined || dto.checkOutDate !== undefined;

    if (shouldRecheckAvailability) {
      await this.assertRoomAvailable(
        booking.roomId,
        checkInDate,
        checkOutDate,
        booking.id,
      );
    }

    const now = new Date();
    const updated = await this.bookingRepository.save({
      ...booking,
      checkInDate: toDateKey(checkInDate),
      checkOutDate: toDateKey(checkOutDate),
      guests: nextGuests,
      totalPrice: nights * room.pricePerNight,
      status: nextStatus,
      updatedAt: now,
    });
    const refreshed = await this.bookingRepository.findById(updated.id);
    return toBookingResponseDto(refreshed ?? updated);
  }

  /**
   * Cancelling only flips the status. It must not re-validate the room's
   * current capacity/slots or re-price the stay: the homestay can change the
   * room after the guest booked, and the guest must still be able to leave.
   */
  async cancel(id: string, userId: string): Promise<BookingResponseDto> {
    const booking = await this.getOwnedBookingOrThrow(id, userId);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Cancelled bookings cannot be updated');
    }

    this.assertValidStatusTransition(booking.status, BookingStatus.CANCELLED);

    const now = new Date();
    const updated = await this.bookingRepository.save({
      ...booking,
      status: BookingStatus.CANCELLED,
      cancelledAt: now,
      updatedAt: now,
    });
    const refreshed = await this.bookingRepository.findById(updated.id);
    return toBookingResponseDto(refreshed ?? updated);
  }

  /**
   * Mirrors the Mastra agent's isModifiableBooking gate at the API boundary —
   * a direct PATCH caller (bypassing the agent) must not be able to change
   * dates/guests on a booking whose stay has already started. Cancellation is
   * exempt (checked by callers via nextStatus before invoking this).
   */
  private assertModifiable(booking: BookingEntity): void {
    if (booking.checkInDate <= toDateKey(new Date())) {
      throw new BadRequestException(
        'Booking can no longer be modified — the stay has already started',
      );
    }
  }

  private async getOwnedBookingOrThrow(id: string, userId: string) {
    const booking = await this.bookingRepository.findById(id);

    if (!booking || booking.userId !== userId) {
      throw new NotFoundException(`Booking with id "${id}" not found`);
    }

    return booking;
  }

  private async getRoomOrThrow(roomId: string): Promise<RoomEntity> {
    const room = await this.roomsRepository.findById(roomId);

    if (!room) {
      throw new NotFoundException(`Room with id "${roomId}" not found`);
    }

    return room;
  }

  private async isRoomAvailable(
    room: RoomEntity,
    checkInDate: Date,
    checkOutDate: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    if (room.availableSlots <= 0) {
      return false;
    }

    const hasOverlap = await this.bookingRepository.hasOverlappingBooking(
      room.id,
      checkInDate,
      checkOutDate,
      excludeBookingId,
    );

    return !hasOverlap;
  }

  private async assertRoomAvailable(
    roomId: string,
    checkInDate: Date,
    checkOutDate: Date,
    excludeBookingId?: string,
  ): Promise<void> {
    const room = await this.getRoomOrThrow(roomId);
    this.assertRoomHasSlots(room);

    const hasOverlap = await this.bookingRepository.hasOverlappingBooking(
      roomId,
      checkInDate,
      checkOutDate,
      excludeBookingId,
    );

    if (hasOverlap) {
      throw new ConflictException(
        `Room "${roomId}" is not available for the selected dates`,
      );
    }
  }

  private parseOptionalGuests(guests?: number | string): number | undefined {
    if (guests == null || guests === '') {
      return undefined;
    }

    const parsed = typeof guests === 'number' ? guests : Number(guests);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException('guests must be a positive integer');
    }

    return parsed;
  }

  private assertGuestCapacity(room: RoomEntity, guests: number): void {
    if (guests > room.capacity) {
      throw new BadRequestException(
        `Guest count (${guests}) exceeds room capacity (${room.capacity})`,
      );
    }
  }

  private assertRoomHasSlots(room: RoomEntity): void {
    if (room.availableSlots <= 0) {
      throw new ConflictException(`Room "${room.id}" has no available slots`);
    }
  }

  private assertPositiveGuests(guests: number): void {
    if (!Number.isInteger(guests) || guests < 1) {
      throw new BadRequestException('guests must be a positive integer');
    }
  }

  private assertRequiredFields<T extends object>(
    dto: T,
    fields: (keyof T)[],
  ): void {
    for (const field of fields) {
      const value = dto[field];

      if (value == null || (typeof value === 'string' && value.trim() === '')) {
        throw new BadRequestException(`${String(field)} is required`);
      }
    }
  }

  private assertValidStatus(status: BookingStatus): void {
    if (!Object.values(BookingStatus).includes(status)) {
      throw new BadRequestException(`Invalid booking status "${status}"`);
    }
  }

  private assertValidStatusTransition(
    current: BookingStatus,
    next: BookingStatus,
  ): void {
    if (current === next) {
      return;
    }

    if (!ALLOWED_STATUS_TRANSITIONS[current].includes(next)) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${next}`,
      );
    }
  }
}
