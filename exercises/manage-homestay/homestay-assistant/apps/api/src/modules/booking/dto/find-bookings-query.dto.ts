import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class FindBookingsQueryDto {
  @ApiProperty({
    description: 'Case-insensitive partial room-name match',
    required: false,
    example: 'Misty Pavilion',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roomName?: string;

  @ApiProperty({
    description:
      'Start of a stay-overlap range filter (inclusive), paired with dateTo. Return only active bookings whose stay overlaps [dateFrom, dateTo). YYYY-MM-DD.',
    required: false,
    example: '2026-09-19',
  })
  @IsOptional()
  @IsString()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description:
      'End of a stay-overlap range filter (exclusive), paired with dateFrom. YYYY-MM-DD.',
    required: false,
    example: '2026-09-21',
  })
  @IsOptional()
  @IsString()
  @IsDateString()
  dateTo?: string;
}
