import { BookingStatus } from '../../../types/enum';
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
