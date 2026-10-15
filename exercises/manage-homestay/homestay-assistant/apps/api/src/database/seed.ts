import 'reflect-metadata';
import 'dotenv/config';
import { In } from 'typeorm';
import { RoomEntity } from '@/modules/rooms/entities/room.entity';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import dataSource from '@/database/data-source';
import { Amenity } from '@/database/entities/enums';
import { UserEntity } from '@/database/entities/user.entity';

/** Pre-homestay catalog IDs left behind by older seeds — remove on every seed. */
const LEGACY_ROOM_IDS = [
  'studio-north',
  'the-loft',
  'meridian',
  'observatory',
] as const;

const guestUser = {
  id: 'guest-user',
  email: 'guest@homestay.local',
  name: 'Guest User',
  password: 'guest-password',
};

const rooms = [
  {
    id: 'lotus-garden',
    name: 'Lotus Garden Room',
    level: 1,
    levelColor: '#86EFAC',
    capacity: 2,
    description:
      'Ground-floor double room opening onto a quiet garden courtyard. Queen bed, ensuite bathroom, and morning light through bamboo shutters.',
    imageUrl:
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80',
    availableSlots: 12,
    pricePerNight: 750_000,
    amenities: [Amenity.WIFI, Amenity.COFFEE, Amenity.MONITOR],
  },
  {
    id: 'bamboo-suite',
    name: 'Bamboo Family Suite',
    level: 2,
    levelColor: '#7DD3FC',
    capacity: 4,
    description:
      'Spacious suite with one king bed and two single beds, ideal for families. Separate sitting area, kitchenette, and shared terrace access.',
    imageUrl:
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    availableSlots: 6,
    pricePerNight: 1_350_000,
    amenities: [
      Amenity.WIFI,
      Amenity.COFFEE,
      Amenity.MONITOR,
      Amenity.VIDEO,
      Amenity.PHONE,
    ],
  },
  {
    id: 'sunrise-balcony',
    name: 'Sunrise Balcony Room',
    level: 3,
    levelColor: '#FDBA74',
    capacity: 2,
    description:
      'Corner room with a private balcony facing the hills. King bed, rainfall shower, and a small desk for slow mornings with tea.',
    imageUrl:
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    availableSlots: 9,
    pricePerNight: 980_000,
    amenities: [Amenity.WIFI, Amenity.COFFEE, Amenity.MONITOR, Amenity.VIDEO],
  },
  {
    id: 'moonlight-loft',
    name: 'Moonlight Loft',
    level: 4,
    levelColor: '#C4B5FD',
    capacity: 3,
    description:
      'Top-floor loft under exposed wooden beams with skylight views. Queen bed plus a daybed, ideal for couples or a small group getaway.',
    imageUrl:
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
    availableSlots: 4,
    pricePerNight: 1_650_000,
    amenities: [
      Amenity.WIFI,
      Amenity.COFFEE,
      Amenity.MONITOR,
      Amenity.VIDEO,
      Amenity.PHONE,
    ],
  },
  {
    id: 'riverside-twin',
    name: 'Riverside Twin Room',
    level: 1,
    levelColor: '#67E8F9',
    capacity: 2,
    description:
      'Cozy twin room steps from the river path. Two single beds, compact ensuite, and a shaded porch perfect for reading after a walk.',
    imageUrl:
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
    availableSlots: 10,
    pricePerNight: 620_000,
    amenities: [Amenity.WIFI, Amenity.COFFEE],
  },
  {
    id: 'tea-house-studio',
    name: 'Tea House Studio',
    level: 2,
    levelColor: '#A3E635',
    capacity: 1,
    description:
      'Intimate studio for solo travelers beside the tea pavilion. Platform bed, soaking tub, and a kettle set for evening herbal tea.',
    imageUrl:
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    availableSlots: 7,
    pricePerNight: 540_000,
    amenities: [Amenity.WIFI, Amenity.COFFEE, Amenity.MONITOR],
  },
  {
    id: 'heritage-master',
    name: 'Heritage Master Suite',
    level: 3,
    levelColor: '#F9A8D4',
    capacity: 2,
    description:
      'Restored heritage suite with carved wooden headboard, clawfoot tub, and antique writing desk. Complimentary breakfast on the veranda.',
    imageUrl:
      'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=800&q=80',
    availableSlots: 3,
    pricePerNight: 1_950_000,
    amenities: [
      Amenity.WIFI,
      Amenity.COFFEE,
      Amenity.MONITOR,
      Amenity.VIDEO,
      Amenity.PHONE,
    ],
  },
  {
    id: 'courtyard-duplex',
    name: 'Courtyard Duplex',
    level: 2,
    levelColor: '#FCD34D',
    capacity: 6,
    description:
      'Two-level duplex wrapping around the central courtyard. Downstairs lounge and kitchenette, upstairs two bedrooms for groups or reunions.',
    imageUrl:
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80',
    availableSlots: 2,
    pricePerNight: 2_200_000,
    amenities: [
      Amenity.WIFI,
      Amenity.COFFEE,
      Amenity.MONITOR,
      Amenity.VIDEO,
      Amenity.WHITEBOARD,
      Amenity.PHONE,
    ],
  },
  {
    id: 'misty-pavilion',
    name: 'Misty Pavilion Room',
    level: 4,
    levelColor: '#93C5FD',
    capacity: 2,
    description:
      'Elevated pavilion room with wraparound windows and misty valley views at dawn. King bed, rain shower, and in-room yoga mats.',
    imageUrl:
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80',
    availableSlots: 5,
    pricePerNight: 1_420_000,
    amenities: [Amenity.WIFI, Amenity.COFFEE, Amenity.MONITOR, Amenity.VIDEO],
  },
  {
    id: 'orchid-twin',
    name: 'Orchid Twin Loft',
    level: 3,
    levelColor: '#F0ABFC',
    capacity: 2,
    description:
      'Bright mezzanine loft with orchid planters on the landing. Twin beds on the upper level, open living nook below with sofa and minibar.',
    imageUrl:
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
    availableSlots: 8,
    pricePerNight: 890_000,
    amenities: [Amenity.WIFI, Amenity.COFFEE, Amenity.MONITOR, Amenity.MIC],
  },
];

async function main(): Promise<void> {
  await dataSource.initialize();

  const roomRepository = dataSource.getRepository(RoomEntity);
  const bookingRepository = dataSource.getRepository(BookingEntity);
  const userRepository = dataSource.getRepository(UserEntity);

  const now = new Date();

  await userRepository.save({
    ...guestUser,
    updatedAt: now,
  });

  // Bookings FK is ON DELETE RESTRICT — clear legacy stays before dropping rooms.
  const legacyBookingResult = await bookingRepository.delete({
    roomId: In([...LEGACY_ROOM_IDS]),
  });
  const legacyRoomResult = await roomRepository.delete({
    id: In([...LEGACY_ROOM_IDS]),
  });

  await roomRepository.save(
    rooms.map((room) => ({
      ...room,
      updatedAt: now,
    })),
  );

  console.log(
    `Seeded guest user and ${rooms.length} rooms.` +
      ` Removed ${legacyRoomResult.affected ?? 0} legacy rooms` +
      ` and ${legacyBookingResult.affected ?? 0} legacy bookings.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });
