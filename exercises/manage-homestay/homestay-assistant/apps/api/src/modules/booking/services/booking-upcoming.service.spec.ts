import { BookingStatus } from '../../../types/enum';
import { UserRole } from '@/database/entities/enums';
import { UpcomingPeriod } from '@/modules/booking/dto';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import { BookingRepository } from '@/modules/booking/repositories/booking.repository';
import { BookingService } from '@/modules/booking/services/booking.service';
import { RoomsRepository } from '@/modules/rooms/repositories/rooms.repository';

// `@repo/utils` and `@repo/constants` ship as ESM, which jest (CommonJS) cannot
// load; findUpcoming never uses them.
jest.mock('@repo/utils', () => ({ extractRoomNameQuery: jest.fn() }));
jest.mock('@repo/constants', () => ({
  FIND_ROOM_SORT: {},
  FIND_ROOM_SORT_VALUES: [],
}));

describe('BookingService.findUpcoming', () => {
  const userId = 'host-1';
  const NOW = new Date('2026-10-29T10:00:00.000Z');

  const booking = (overrides: Partial<BookingEntity>): BookingEntity =>
    ({
      id: 'b1',
      userId,
      roomId: 'r1',
      room: { name: 'A101' },
      user: { name: 'Nguyen', email: 'n@example.com' },
      guests: 2,
      status: BookingStatus.CONFIRMED,
      checkInDate: '2026-10-29',
      checkOutDate: '2026-10-31',
      ...overrides,
    }) as BookingEntity;

  const build = (
    result = {
      checkIns: [] as BookingEntity[],
      checkOuts: [] as BookingEntity[],
    },
  ) => {
    const bookingRepository = {
      findUpcoming: jest.fn().mockResolvedValue(result),
    };
    const service = new BookingService(
      bookingRepository as unknown as BookingRepository,
      {} as unknown as RoomsRepository,
      {} as never,
    );
    return { service, bookingRepository };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    [undefined, UpcomingPeriod.TODAY, '2026-10-29', '2026-10-30'],
    [UpcomingPeriod.TODAY, UpcomingPeriod.TODAY, '2026-10-29', '2026-10-30'],
    [
      UpcomingPeriod.TOMORROW,
      UpcomingPeriod.TOMORROW,
      '2026-10-30',
      '2026-10-31',
    ],
    [
      UpcomingPeriod.NEXT_3_DAYS,
      UpcomingPeriod.NEXT_3_DAYS,
      '2026-10-29',
      '2026-11-01',
    ],
  ])('period %s -> [%s..%s)', async (input, period, from, to) => {
    const { service, bookingRepository } = build();

    const result = await service.findUpcoming({ period: input }, userId);

    expect(bookingRepository.findUpcoming).toHaveBeenCalledWith(
      userId,
      from,
      to,
    );
    expect(result).toMatchObject({
      period,
      from,
      to,
      checkIns: [],
      checkOuts: [],
    });
  });

  it('maps check-ins by check-in date and check-outs by check-out date', async () => {
    const { service } = build({
      checkIns: [booking({ id: 'in-1' })],
      checkOuts: [booking({ id: 'out-1', checkOutDate: '2026-10-29' })],
    });

    const result = await service.findUpcoming({}, userId);

    expect(result.checkIns).toEqual([
      {
        id: 'in-1',
        roomName: 'A101',
        guests: 2,
        guestName: 'Nguyen',
        date: '2026-10-29',
        status: BookingStatus.CONFIRMED,
      },
    ]);
    expect(result.checkOuts[0]).toMatchObject({
      id: 'out-1',
      date: '2026-10-29',
    });
  });

  it('falls back to email when the guest has no name', async () => {
    const { service } = build({
      checkIns: [
        booking({ user: { name: null, email: 'n@example.com' } as never }),
      ],
      checkOuts: [],
    });

    const result = await service.findUpcoming({}, userId);

    expect(result.checkIns[0].guestName).toBe('n@example.com');
  });
});

describe('BookingService.findUpcoming scoping and timezone', () => {
  const build = () => {
    const bookingRepository = {
      findUpcoming: jest
        .fn()
        .mockResolvedValue({ checkIns: [], checkOuts: [] }),
    };
    const service = new BookingService(
      bookingRepository as unknown as BookingRepository,
      {} as unknown as RoomsRepository,
      {} as never,
    );
    return { service, bookingRepository };
  };

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.PROPERTY_TIMEZONE;
  });

  it('scopes guests to their own bookings and managers to all', async () => {
    const { service, bookingRepository } = build();

    await service.findUpcoming({}, 'guest-1', UserRole.GUEST);
    await service.findUpcoming({}, 'host-1', UserRole.MANAGER);

    expect(bookingRepository.findUpcoming).toHaveBeenNthCalledWith(
      1,
      'guest-1',
      expect.any(String),
      expect.any(String),
    );
    expect(bookingRepository.findUpcoming).toHaveBeenNthCalledWith(
      2,
      null,
      expect.any(String),
      expect.any(String),
    );
  });

  it('uses the property timezone for "today" (default Asia/Ho_Chi_Minh)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-29T18:00:00.000Z'));
    const { service } = build();

    const result = await service.findUpcoming({}, 'host-1');

    // 18:00Z is already 01:00 on the 30th in UTC+7.
    expect(result).toMatchObject({ from: '2026-10-30', to: '2026-10-31' });
  });

  it('honours PROPERTY_TIMEZONE and falls back when it is invalid', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-29T18:00:00.000Z'));
    const { service } = build();

    process.env.PROPERTY_TIMEZONE = 'UTC';
    expect(await service.findUpcoming({}, 'h')).toMatchObject({
      from: '2026-10-29',
    });

    process.env.PROPERTY_TIMEZONE = 'Not/AZone';
    expect(await service.findUpcoming({}, 'h')).toMatchObject({
      from: '2026-10-30',
    });
  });
});
