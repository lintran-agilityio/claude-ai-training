import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { FIND_ROOM_SORT_VALUES, type FindRoomSort } from '@repo/constants';

export class GetAvailableRoomsQueryDto {
  @ApiProperty({
    description: 'Target date for availability (YYYY-MM-DD)',
    example: '2026-07-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsDateString()
  date?: string;

  @ApiProperty({
    description: 'Partial room name search (case-insensitive)',
    example: 'lotus',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description:
      'Party size — matches rooms where capacity >= guests (not exact equality). Larger rooms are included; results prefer the smallest sufficient capacity.',
    example: 2,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  guests?: number;

  @ApiProperty({
    description: 'Room floor level',
    example: 1,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  level?: number;

  @ApiProperty({
    description:
      'Ranking order for the matched rooms. cheapest = price ascending. most_expensive = price descending. most_amenities = amenity count descending, ties broken by price ascending.',
    enum: FIND_ROOM_SORT_VALUES as unknown as string[],
    required: false,
  })
  @IsOptional()
  @IsIn(FIND_ROOM_SORT_VALUES as readonly string[])
  sortBy?: FindRoomSort;

  @ApiProperty({
    description:
      'Price ceiling in VND — matches rooms with pricePerNight <= maxPrice.',
    example: 1000000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxPrice?: number;
}
