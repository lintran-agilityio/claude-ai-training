import { Injectable } from '@nestjs/common';
import { isEmptyDateValue } from './utils';
import { GetAvailableRoomsQueryDto } from './modules/rooms/dto/get-available-rooms-query.dto';
import { RoomResponseDto } from './modules/rooms/dto/room-response.dto';
import { RoomsService } from './modules/rooms/services/rooms.service';

@Injectable()
export class AppService {
  constructor(private readonly roomsService: RoomsService) {}

  getHello(): string {
    return 'Homestay Assistant API';
  }

  getAvailableRoomsToday(
    query: GetAvailableRoomsQueryDto = {},
  ): Promise<RoomResponseDto[]> {
    const date = isEmptyDateValue(query.date)
      ? new Date().toISOString().slice(0, 10)
      : query.date;

    return this.roomsService.getRooms({ date });
  }
}
