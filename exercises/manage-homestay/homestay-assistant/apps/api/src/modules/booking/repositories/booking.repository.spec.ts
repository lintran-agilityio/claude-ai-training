import 'reflect-metadata';
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';

import { databaseEntities } from '@/database/entities';
import { Amenity } from '@/database/entities/enums';
import { UserEntity } from '@/database/entities/user.entity';
import { RoomEntity } from '@/modules/rooms/entities/room.entity';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import { BookingRepository } from '@/modules/booking/repositories/booking.repository';
import { BookingStatus } from '../../../types/enum';
import { toDateKey } from '@/utils';

// `@repo/utils` ships as ESM, which jest (CommonJS) cannot load. The repository
// only uses it in `findAll`, not in the overlap query under test.
jest.mock('@repo/utils', () => ({ extractRoomNameQuery: jest.fn() }));

/**
 * Integration test: the overlap rule lives in a SQL query, so it needs a real
 * PostgreSQL. It builds a throwaway schema from the entities and drops it at
 * the end, so dev data is never touched. Needs DATABASE_URL (see .env.example).
 */
describe('BookingRepository.hasOverlappingBooking', () => {
  const schema = `test_${randomBytes(4).toString('hex')}`;
  const roomId = 'room-overlap';
  let dataSource: DataSource;
  let bookings: Repository<BookingEntity>;
  let repository: BookingRepository;

  const day = (d: number) => new Date(`2030-01-${String(d).padStart(2, '0')}`);

  const addBooking = (
    checkIn: number,
    checkOut: number,
    status = BookingStatus.CONFIRMED,
  ) =>
    bookings.save({
      id: crypto.randomUUID(),
      userId: 'guest-a',
      roomId,
      checkInDate: day(checkIn).toISOString().slice(0, 10),
      checkOutDate: day(checkOut).toISOString().slice(0, 10),
      guests: 1,
      totalPrice: 100,
      status,
    });

  beforeAll(async () => {
    const admin = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
    });
    await admin.initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.destroy();

    dataSource = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      schema,
      entities: databaseEntities,
      synchronize: true,
    });
    await dataSource.initialize();

    await dataSource.getRepository(UserEntity).save({
      id: 'guest-a',
      email: 'a@test.local',
      name: 'Guest A',
      password: 'n/a',
    });
    await dataSource.getRepository(RoomEntity).save({
      id: roomId,
      name: 'Overlap Room',
      level: 1,
      levelColor: '#fff',
      capacity: 2,
      description: 'test',
      imageUrl: 'x',
      availableSlots: 1,
      pricePerNight: 100,
      amenities: [Amenity.WIFI],
    });

    bookings = dataSource.getRepository(BookingEntity);
    repository = new BookingRepository(bookings);
  });

  afterAll(async () => {
    if (!dataSource?.isInitialized) return;
    await dataSource.query(`DROP SCHEMA "${schema}" CASCADE`);
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await bookings.clear();
    await addBooking(10, 12); // existing stay: nights of the 10th and 11th
  });

  // Rule A1: a stay is [check_in, check_out), the check-out day is free.
  it.each([
    ['starts on the existing check-out day (12-14)', 12, 14],
    ['ends on the existing check-in day (8-10)', 8, 10],
    ['starts one day after check-out (13-15)', 13, 15],
  ])('is free when new stay %s', async (_label, checkIn, checkOut) => {
    await expect(
      repository.hasOverlappingBooking(roomId, day(checkIn), day(checkOut)),
    ).resolves.toBe(false);
  });

  it.each([
    ['overlaps the end (11-13)', 11, 13],
    ['overlaps the start (9-11)', 9, 11],
    ['has the same dates (10-12)', 10, 12],
    ['contains the existing stay (9-13)', 9, 13],
  ])('is blocked when new stay %s', async (_label, checkIn, checkOut) => {
    await expect(
      repository.hasOverlappingBooking(roomId, day(checkIn), day(checkOut)),
    ).resolves.toBe(true);
  });

  it.each([BookingStatus.PENDING, BookingStatus.CHECKED_IN])(
    'is blocked by a %s booking (it occupies the room)',
    async (status) => {
      await bookings.clear();
      await addBooking(10, 12, status);

      await expect(
        repository.hasOverlappingBooking(roomId, day(11), day(13)),
      ).resolves.toBe(true);
    },
  );

  it('is free once the guest has checked out', async () => {
    await bookings.clear();
    await addBooking(10, 12, BookingStatus.CHECKED_OUT);

    await expect(
      repository.hasOverlappingBooking(roomId, day(10), day(12)),
    ).resolves.toBe(false);
  });

  it('ignores a cancelled booking', async () => {
    await bookings.clear();
    await addBooking(10, 12, BookingStatus.CANCELLED);

    await expect(
      repository.hasOverlappingBooking(roomId, day(10), day(12)),
    ).resolves.toBe(false);
  });

  it('ignores the booking passed as excludeBookingId (edit flow)', async () => {
    const [existing] = await bookings.find();

    await expect(
      repository.hasOverlappingBooking(roomId, day(10), day(12), existing.id),
    ).resolves.toBe(false);
  });

  describe('findAll upcoming check-in range', () => {
    const offsetDate = (days: number) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return toDateKey(date);
    };

    const addStay = (checkInOffset: number, status = BookingStatus.CONFIRMED) =>
      bookings.save({
        id: crypto.randomUUID(),
        userId: 'guest-a',
        roomId,
        checkInDate: offsetDate(checkInOffset),
        checkOutDate: offsetDate(checkInOffset + 2),
        guests: 1,
        totalPrice: 100,
        status,
      });

    const findUpcoming = () =>
      repository.findAll({
        userId: 'guest-a',
        checkInFrom: offsetDate(0),
        checkInTo: offsetDate(3),
      });

    beforeEach(async () => {
      await bookings.clear();
    });

    it('returns check-ins from today up to, but excluding, checkInTo', async () => {
      await addStay(0);
      await addStay(2);
      await addStay(3); // checkInTo is exclusive
      await addStay(-1); // already started before the range

      const result = await findUpcoming();

      expect(result.map((b) => b.checkInDate).sort()).toEqual([
        offsetDate(0),
        offsetDate(2),
      ]);
    });

    it.each([
      BookingStatus.CHECKED_IN,
      BookingStatus.CHECKED_OUT,
      BookingStatus.CANCELLED,
    ])('excludes a %s booking', async (status) => {
      await addStay(1, status);

      await expect(findUpcoming()).resolves.toHaveLength(0);
    });

    it('includes PENDING and CONFIRMED bookings', async () => {
      await addStay(1, BookingStatus.PENDING);
      await addStay(1, BookingStatus.CONFIRMED);

      await expect(findUpcoming()).resolves.toHaveLength(2);
    });

    it('does not apply the range unless both bounds are present', async () => {
      await addStay(5);

      const result = await repository.findAll({
        userId: 'guest-a',
        checkInFrom: offsetDate(0),
      });

      expect(result).toHaveLength(1);
    });
  });
});
