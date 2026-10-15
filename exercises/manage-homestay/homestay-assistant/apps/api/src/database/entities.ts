import { BookingEntity } from '../modules/booking/entities/booking.entity';
import { RoomEntity } from '../modules/rooms/entities/room.entity';
import { UserEntity } from '../database/entities/user.entity';

export const databaseEntities = [RoomEntity, BookingEntity, UserEntity];
