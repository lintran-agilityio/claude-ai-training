import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Amenity, UserRole } from '@/database/entities/enums';
import { CreateRoomDto } from '@/modules/rooms/dto/create-room.dto';
import { RoomEntity } from '@/modules/rooms/entities/room.entity';
import { RoomsRepository } from '@/modules/rooms/repositories/rooms.repository';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import { RoomsController } from '@/modules/rooms/controllers/rooms.controller';
import { AvailabilityOverviewQueryDto } from '@/modules/rooms/dto/availability-overview-query.dto';
import { RoomsService } from '@/modules/rooms/services/rooms.service';

// `@repo/utils` and `@repo/constants` ship as ESM, which jest (CommonJS) cannot load.
jest.mock('@repo/utils', () => ({ extractRoomNameQuery: jest.fn() }));
jest.mock('@repo/constants', () => ({
  FIND_ROOM_SORT: {},
  FIND_ROOM_SORT_VALUES: [],
}));

const validInput = {
  name: 'Lotus Garden',
  level: 1,
  levelColor: '#f0f0f0',
  capacity: 4,
  description: 'A quiet room',
  imageUrl: 'https://example.com/a.jpg',
  availableSlots: 2,
  pricePerNight: 100,
  amenities: [Amenity.WIFI],
};

describe('RoomsService CRUD', () => {
  let repo: Record<
    | 'findAll'
    | 'findById'
    | 'findByName'
    | 'create'
    | 'save'
    | 'remove'
    | 'hasActiveBookings',
    jest.Mock
  >;
  let service: RoomsService;
  let room: RoomEntity;

  beforeEach(() => {
    room = { id: 'r1', ...validInput } as RoomEntity;
    repo = {
      findAll: jest.fn().mockResolvedValue([room]),
      findById: jest.fn().mockResolvedValue(room),
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
      remove: jest.fn().mockResolvedValue(undefined),
      hasActiveBookings: jest.fn().mockResolvedValue(false),
    };
    service = new RoomsService(repo as unknown as RoomsRepository);
  });

  describe('create', () => {
    it('creates a room with a generated id and trimmed name', async () => {
      const result = await service.createRoom({
        ...validInput,
        name: '  Lotus Garden ',
      } as CreateRoomDto);
      expect(result.name).toBe('Lotus Garden');
      expect(result.id).toBeTruthy();
    });

    it('rejects a duplicate name', async () => {
      repo.findByName.mockResolvedValue(room);
      await expect(
        service.createRoom(validInput as CreateRoomDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects availableSlots above capacity', async () => {
      await expect(
        service.createRoom({
          ...validInput,
          availableSlots: 9,
        } as CreateRoomDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('DTO validation rejects bad input', async () => {
      const dto = plainToInstance(CreateRoomDto, {
        ...validInput,
        capacity: 0,
        levelColor: 'red',
        amenities: ['nope'],
      });
      const props = (await validate(dto)).map((e) => e.property);
      expect(props).toEqual(
        expect.arrayContaining(['capacity', 'levelColor', 'amenities']),
      );
    });

    it('DTO validation accepts valid input', async () => {
      expect(
        await validate(plainToInstance(CreateRoomDto, validInput)),
      ).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('returns all rooms as DTOs', async () => {
      const result = await service.getRooms();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('r1');
    });

    it('returns an empty list when there are no rooms', async () => {
      repo.findAll.mockResolvedValue([]);
      expect(await service.getRooms()).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates the given fields', async () => {
      const result = await service.updateRoom('r1', { pricePerNight: 150 });
      expect(result.pricePerNight).toBe(150);
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws NotFound for an unknown room', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.updateRoom('x', { pricePerNight: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an empty update', async () => {
      await expect(service.updateRoom('r1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects capacity lowered below availableSlots', async () => {
      await expect(
        service.updateRoom('r1', { capacity: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects renaming to a name already taken', async () => {
      repo.findByName.mockResolvedValue({ id: 'r2' });
      await expect(
        service.updateRoom('r1', { name: 'Other' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('delete', () => {
    it('removes a room without active bookings', async () => {
      await service.deleteRoom('r1');
      expect(repo.remove).toHaveBeenCalledWith(room);
    });

    it('throws NotFound for an unknown room', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.deleteRoom('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses to delete a room with active bookings', async () => {
      repo.hasActiveBookings.mockResolvedValue(true);
      await expect(service.deleteRoom('r1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});

describe('RoomsService.getAvailabilityOverview', () => {
  const lotus = { id: 'r1', ...validInput } as RoomEntity;
  const moon = {
    id: 'r2',
    ...validInput,
    name: 'Moonlight Loft',
  } as RoomEntity;
  const booking = {
    id: 'b1',
    roomId: 'r2',
    room: moon,
    user: { name: 'Jane Doe', email: 'jane@example.com' },
    checkInDate: '2030-01-10',
    checkOutDate: '2030-01-12',
  } as unknown as BookingEntity;

  let repo: Record<
    'findAvailableBetween' | 'findOverlappingBookings' | 'findAll',
    jest.Mock
  >;
  let service: RoomsService;

  beforeEach(() => {
    repo = {
      findAvailableBetween: jest.fn().mockResolvedValue([lotus]),
      findOverlappingBookings: jest.fn().mockResolvedValue([booking]),
      findAll: jest.fn().mockResolvedValue([lotus, moon]),
    };
    service = new RoomsService(repo as unknown as RoomsRepository);
  });

  it('omits the booked key entirely for guests', async () => {
    const result = await service.getAvailabilityOverview(
      { date: '2030-01-10' },
      UserRole.GUEST,
    );

    expect('booked' in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain('Jane');
    expect(result.available.map((r) => r.name)).toEqual(['Lotus Garden']);
    expect(result.summary).toEqual({
      total: 2,
      availableCount: 1,
      bookedCount: 1,
    });
  });

  it('returns booked rooms with guest name for managers', async () => {
    const result = await service.getAvailabilityOverview(
      { date: '2030-01-10' },
      UserRole.MANAGER,
    );

    expect(result.booked).toEqual([
      expect.objectContaining({
        bookingId: 'b1',
        guestName: 'Jane Doe',
        checkInDate: '2030-01-10',
        checkOutDate: '2030-01-12',
      }),
    ]);
  });

  it('falls back to email when the guest has no name', async () => {
    repo.findOverlappingBookings.mockResolvedValue([
      { ...booking, user: { name: null, email: 'jane@example.com' } },
    ]);

    const result = await service.getAvailabilityOverview(
      { date: '2030-01-10' },
      UserRole.MANAGER,
    );

    expect(result.booked?.[0].guestName).toBe('jane@example.com');
  });

  it('defaults checkOutDate to date + 1 and queries [date, checkOut) so the checkout day is free', async () => {
    const result = await service.getAvailabilityOverview(
      { date: '2030-01-12' },
      UserRole.GUEST,
    );

    expect(result.checkOutDate).toBe('2030-01-13');
    const [checkIn, checkOut] = repo.findOverlappingBookings.mock.calls[0] as [
      Date,
      Date,
    ];
    expect(checkIn.toISOString()).toBe('2030-01-12T00:00:00.000Z');
    expect(checkOut.toISOString()).toBe('2030-01-13T00:00:00.000Z');
  });

  it.each([
    [
      'checkOut equals date',
      { date: '2030-01-10', checkOutDate: '2030-01-10' },
    ],
    [
      'checkOut before date',
      { date: '2030-01-10', checkOutDate: '2030-01-09' },
    ],
    ['unparseable date', { date: 'not-a-date' }],
  ])('rejects invalid dates: %s', async (_label, query) => {
    await expect(
      service.getAvailabilityOverview(query, UserRole.GUEST),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.findAvailableBetween).not.toHaveBeenCalled();
  });
});

describe('RoomsController.getAvailabilityOverview', () => {
  it('passes the guard-resolved role to the service', async () => {
    const getAvailabilityOverview = jest.fn().mockResolvedValue({});
    const controller = new RoomsController({
      getAvailabilityOverview,
    } as unknown as RoomsService);
    const query: AvailabilityOverviewQueryDto = { date: '2030-01-10' };

    await controller.getAvailabilityOverview(
      { userId: 'u1', role: UserRole.GUEST },
      query,
    );

    expect(getAvailabilityOverview).toHaveBeenCalledWith(query, UserRole.GUEST);
  });
});
