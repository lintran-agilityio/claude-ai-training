import { RoomResponseDto } from '@/modules/rooms/dto/room-response.dto';
import { RoomEntity } from '@/modules/rooms/entities/room.entity';

export const toRoomResponseDto = (room: RoomEntity): RoomResponseDto => ({
  id: room.id,
  name: room.name,
  level: room.level,
  levelColor: room.levelColor,
  capacity: room.capacity,
  description: room.description,
  imageUrl: room.imageUrl,
  availableSlots: room.availableSlots,
  pricePerNight: room.pricePerNight,
  amenities: room.amenities,
});
