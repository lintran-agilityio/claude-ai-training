import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { RoomResponseDto } from '@/modules/rooms/dto/room-response.dto';

export class AvailabilitySummaryDto {
  @ApiProperty({ description: 'Total number of rooms', example: 6 })
  total: number;

  @ApiProperty({ description: 'Rooms free for the whole range', example: 4 })
  availableCount: number;

  @ApiProperty({
    description: 'Rooms with an active booking in the range (count only)',
    example: 2,
  })
  bookedCount: number;
}

export class BookedRoomDto {
  @ApiProperty({ type: RoomResponseDto })
  @Type(() => RoomResponseDto)
  room: RoomResponseDto;

  @ApiProperty({ description: 'Booking ID' })
  bookingId: string;

  @ApiProperty({
    description: 'Guest name (user name, falling back to email)',
    example: 'Jane Doe',
  })
  guestName: string;

  @ApiProperty({ example: '2026-07-01' })
  checkInDate: string;

  @ApiProperty({ example: '2026-07-03' })
  checkOutDate: string;
}

export class AvailabilityOverviewResponseDto {
  @ApiProperty({ example: '2026-07-01' })
  date: string;

  @ApiProperty({ example: '2026-07-02' })
  checkOutDate: string;

  @ApiProperty({ type: RoomResponseDto, isArray: true })
  @Type(() => RoomResponseDto)
  available: RoomResponseDto[];

  @ApiProperty({ type: AvailabilitySummaryDto })
  summary: AvailabilitySummaryDto;

  @ApiPropertyOptional({
    type: BookedRoomDto,
    isArray: true,
    description:
      'Booked rooms with guest names. Present for managers only — the key is absent for every other role.',
  })
  @Type(() => BookedRoomDto)
  booked?: BookedRoomDto[];
}
