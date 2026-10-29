import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import { BookingRepository } from '@/modules/booking/repositories/booking.repository';
import { BookingService } from '@/modules/booking/services/booking.service';
import { RoomEntity } from '@/modules/rooms/entities/room.entity';
import { UsersService } from '@/modules/users/services/users.service';
import { RoomsRepository } from '@/modules/rooms/repositories/rooms.repository';
import { BookingStatus } from '../../../types/enum';

// `@repo/utils` and `@repo/constants` ship as ESM, which jest (CommonJS) cannot
// load; the cancel/update paths under test never use them.
jest.mock('@repo/utils', () => ({ extractRoomNameQuery: jest.fn() }));
jest.mock('@repo/constants', () => ({
  FIND_ROOM_SORT: {},
  FIND_ROOM_SORT_VALUES: [],
}));

/**
 * Unit test (mocked repositories): cancelling must not depend on the room's
 * current capacity or slots, because the homestay can change those after the
 * guest has booked (BUG-HS-005).
 */
describe('BookingService.cancel', () => {
  const userId = 'guest-a';
  const bookingId = 'booking-1';

  let booking: BookingEntity;
  let room: RoomEntity;
  let bookingRepository: { findById: jest.Mock; save: jest.Mock };
  let roomsRepository: { findById: jest.Mock };
  let service: BookingService;

  const buildService = () =>
    new BookingService(
      bookingRepository as unknown as BookingRepository,
      roomsRepository as unknown as RoomsRepository,
      {} as UsersService,
    );

  beforeEach(() => {
    room = {
      id: 'room-1',
      name: 'Room X',
      capacity: 3,
      availableSlots: 1,
      pricePerNight: 100,
    } as RoomEntity;
    booking = {
      id: bookingId,
      userId,
      roomId: room.id,
      room,
      checkInDate: '2030-01-10',
      checkOutDate: '2030-01-12',
      guests: 3,
      totalPrice: 200,
      status: BookingStatus.CONFIRMED,
      cancelledAt: null,
    } as unknown as BookingEntity;

    bookingRepository = {
      findById: jest.fn().mockImplementation(() => Promise.resolve(booking)),
      save: jest.fn().mockImplementation((b: BookingEntity) => {
        booking = b;
        return Promise.resolve(b);
      }),
    };
    roomsRepository = {
      findById: jest.fn().mockImplementation(() => Promise.resolve(room)),
    };
    service = buildService();
  });

  it.each([
    ['room has 0 available slots', { availableSlots: 0 }],
    ['room capacity lowered below booked guests', { capacity: 2 }],
    ['both: 0 slots and lowered capacity', { availableSlots: 0, capacity: 2 }],
    ['room price changed by the homestay', { pricePerNight: 500 }],
  ])('cancels when %s', async (_label, roomChange) => {
    Object.assign(room, roomChange);

    const result = await service.cancel(bookingId, userId);

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(bookingRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BookingStatus.CANCELLED,
        cancelledAt: expect.any(Date) as Date,
        guests: 3,
        totalPrice: 200,
      }),
    );
  });

  it('rejects cancelling an already cancelled booking', async () => {
    booking.status = BookingStatus.CANCELLED;

    await expect(service.cancel(bookingId, userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(bookingRepository.save).not.toHaveBeenCalled();
  });

  it("does not cancel another guest's booking", async () => {
    await expect(service.cancel(bookingId, 'guest-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(bookingRepository.save).not.toHaveBeenCalled();
  });
});

describe('BookingService.update (regression guard for BUG-HS-005)', () => {
  it('still blocks a guest-count change that exceeds room capacity', async () => {
    const room = {
      id: 'room-1',
      capacity: 2,
      availableSlots: 1,
      pricePerNight: 100,
    };
    const booking = {
      id: 'booking-1',
      userId: 'guest-a',
      roomId: room.id,
      room,
      checkInDate: '2030-01-10',
      checkOutDate: '2030-01-12',
      guests: 2,
      totalPrice: 200,
      status: BookingStatus.CONFIRMED,
    };
    const bookingRepository = {
      findById: jest.fn().mockResolvedValue(booking),
      save: jest.fn(),
    };
    const service = new BookingService(
      bookingRepository as unknown as BookingRepository,
      {
        findById: jest.fn().mockResolvedValue(room),
      } as unknown as RoomsRepository,
      {} as UsersService,
    );

    await expect(
      service.update('booking-1', { guests: 5 }, 'guest-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bookingRepository.save).not.toHaveBeenCalled();
  });
});

/**
 * Unit test (mocked repositories) for BookingService.create: overlapping
 * stays, same-day check-in/out and per-night pricing.
 */
describe('BookingService.create', () => {
  const userId = 'guest-a';
  const room = {
    id: 'room-1',
    capacity: 4,
    availableSlots: 1,
    pricePerNight: 100,
  } as RoomEntity;

  let bookingRepository: {
    save: jest.Mock;
    findById: jest.Mock;
    hasOverlappingBooking: jest.Mock;
  };
  let service: BookingService;

  const dto = (checkInDate: string, checkOutDate: string) => ({
    roomId: room.id,
    checkInDate,
    checkOutDate,
    guests: 2,
  });

  beforeEach(() => {
    bookingRepository = {
      save: jest
        .fn()
        .mockImplementation((b: BookingEntity) => Promise.resolve(b)),
      findById: jest.fn().mockResolvedValue(null),
      hasOverlappingBooking: jest.fn().mockResolvedValue(false),
    };
    service = new BookingService(
      bookingRepository as unknown as BookingRepository,
      {
        findById: jest.fn().mockResolvedValue(room),
      } as unknown as RoomsRepository,
      {
        findOrCreate: jest.fn().mockResolvedValue({ id: userId }),
      } as unknown as UsersService,
    );
  });

  it('rejects an overlapping booking (double booking)', async () => {
    bookingRepository.hasOverlappingBooking.mockResolvedValue(true);

    await expect(
      service.create(dto('2030-01-10', '2030-01-12'), userId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(bookingRepository.save).not.toHaveBeenCalled();
  });

  it('allows check-in on the same day another guest checks out', async () => {
    // Repository reports no overlap for a back-to-back stay (checkout == checkin).
    await service.create(dto('2030-01-12', '2030-01-14'), userId);

    expect(bookingRepository.hasOverlappingBooking).toHaveBeenCalledWith(
      room.id,
      new Date('2030-01-12'),
      new Date('2030-01-14'),
      undefined,
    );
    expect(bookingRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects check-in and check-out on the same day', async () => {
    await expect(
      service.create(dto('2030-01-10', '2030-01-10'), userId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bookingRepository.save).not.toHaveBeenCalled();
  });

  it('rejects check-out before check-in', async () => {
    await expect(
      service.create(dto('2030-01-12', '2030-01-10'), userId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['1 night', '2030-01-10', '2030-01-11', 100],
    ['2 nights', '2030-01-10', '2030-01-12', 200],
    ['5 nights across a month end', '2030-01-29', '2030-02-03', 500],
  ])('prices per night: %s', async (_label, checkIn, checkOut, totalPrice) => {
    await service.create(dto(checkIn, checkOut), userId);

    expect(bookingRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ totalPrice }),
    );
  });
});

describe('BookingService.update status transitions', () => {
  const { PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED } =
    BookingStatus;
  const userId = 'guest-a';
  const room = {
    id: 'room-1',
    capacity: 4,
    availableSlots: 1,
    pricePerNight: 100,
  } as RoomEntity;

  const allowed: [BookingStatus, BookingStatus][] = [
    [PENDING, CONFIRMED],
    [PENDING, CANCELLED],
    [CONFIRMED, CHECKED_IN],
    [CONFIRMED, CANCELLED],
    [CHECKED_IN, CHECKED_OUT],
  ];
  const all = Object.values(BookingStatus);
  const rejected = all.flatMap((from) =>
    all
      .filter(
        (to) =>
          from !== to && !allowed.some(([f, t]) => f === from && t === to),
      )
      .map((to): [BookingStatus, BookingStatus] => [from, to]),
  );

  const buildService = (status: BookingStatus) => {
    const booking = {
      id: 'booking-1',
      userId,
      roomId: room.id,
      checkInDate: '2030-01-10',
      checkOutDate: '2030-01-12',
      guests: 2,
      totalPrice: 200,
      status,
      cancelledAt: null,
    } as unknown as BookingEntity;
    const bookingRepository = {
      findById: jest.fn().mockResolvedValue(booking),
      save: jest.fn().mockImplementation((b: BookingEntity) => {
        Object.assign(booking, b);
        return Promise.resolve(booking);
      }),
    };
    const service = new BookingService(
      bookingRepository as unknown as BookingRepository,
      {
        findById: jest.fn().mockResolvedValue(room),
      } as unknown as RoomsRepository,
      {} as UsersService,
    );
    return { service, bookingRepository };
  };

  it.each(allowed)('allows %s -> %s', async (from, to) => {
    const { service, bookingRepository } = buildService(from);

    const result = await service.update('booking-1', { status: to }, userId);

    expect(result.status).toBe(to);
    expect(bookingRepository.save).toHaveBeenCalledTimes(1);
  });

  it.each(rejected)('rejects %s -> %s', async (from, to) => {
    const { service, bookingRepository } = buildService(from);

    await expect(
      service.update('booking-1', { status: to }, userId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bookingRepository.save).not.toHaveBeenCalled();
  });

  it.each(all)('treats %s -> %s as a no-op transition', async (status) => {
    if (status === CANCELLED) return;
    const { service } = buildService(status);

    const result = await service.update('booking-1', { status }, userId);

    expect(result.status).toBe(status);
  });
});

/**
 * Date changes re-check availability against other occupying bookings (incl.
 * CHECKED_IN) but must exclude the booking being modified.
 */
describe('BookingService.update availability re-check', () => {
  const userId = 'guest-a';
  const room = {
    id: 'room-1',
    capacity: 4,
    availableSlots: 1,
    pricePerNight: 100,
  };

  const buildService = (overlaps: boolean) => {
    const booking = {
      id: 'booking-1',
      userId,
      roomId: room.id,
      room,
      checkInDate: '2030-01-10',
      checkOutDate: '2030-01-12',
      guests: 2,
      totalPrice: 200,
      status: BookingStatus.CONFIRMED,
    } as unknown as BookingEntity;
    const bookingRepository = {
      findById: jest.fn().mockResolvedValue(booking),
      hasOverlappingBooking: jest.fn().mockResolvedValue(overlaps),
      save: jest
        .fn()
        .mockImplementation((b: BookingEntity) => Promise.resolve(b)),
    };
    const service = new BookingService(
      bookingRepository as unknown as BookingRepository,
      {
        findById: jest.fn().mockResolvedValue(room),
      } as unknown as RoomsRepository,
      {} as never,
    );
    return { service, bookingRepository };
  };

  it('excludes the booking itself when re-checking new dates', async () => {
    const { service, bookingRepository } = buildService(false);

    await service.update('booking-1', { checkOutDate: '2030-01-13' }, userId);

    expect(bookingRepository.hasOverlappingBooking).toHaveBeenCalledWith(
      room.id,
      new Date('2030-01-10'),
      new Date('2030-01-13'),
      'booking-1',
    );
  });

  it('rejects new dates that overlap another occupying booking', async () => {
    const { service, bookingRepository } = buildService(true);

    await expect(
      service.update('booking-1', { checkOutDate: '2030-01-13' }, userId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(bookingRepository.save).not.toHaveBeenCalled();
  });

  it('does not re-check availability when dates are unchanged', async () => {
    const { service, bookingRepository } = buildService(true);

    await service.update(
      'booking-1',
      { status: BookingStatus.CHECKED_IN },
      userId,
    );

    expect(bookingRepository.hasOverlappingBooking).not.toHaveBeenCalled();
  });
});
