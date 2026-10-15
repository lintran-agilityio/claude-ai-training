import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { RoomResponseDto } from '@/modules/rooms/dto/room-response.dto';

export class AvailabilityResponseDto {
  @ApiProperty({
    description:
      'Whether the room is free for the dates and fits the guest count when guests were provided',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  available: boolean;

  @ApiProperty({
    description:
      'Whether the guest count fits room.capacity. True when guests were omitted.',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  guestsWithinCapacity: boolean;

  @ApiProperty({
    description:
      'Whether the room is free for the dates alone, independent of guest count. `available` is `datesAvailable && guestsWithinCapacity`, so it stays false once capacity fails even when the dates themselves are free — this field lets a caller tell those two cases apart.',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  datesAvailable: boolean;

  @ApiProperty({
    description: 'Full room object that was checked',
    type: RoomResponseDto,
  })
  @ValidateNested()
  @Type(() => RoomResponseDto)
  room: RoomResponseDto;

  @ApiProperty({
    description: 'Requested check-in date',
    example: '2026-07-01',
  })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  checkInDate: string;

  @ApiProperty({
    description: 'Requested check-out date',
    example: '2026-07-03',
  })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  checkOutDate: string;

  @ApiPropertyOptional({
    description: 'Guest count that was validated, when provided',
    example: 2,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  guests?: number;
}
