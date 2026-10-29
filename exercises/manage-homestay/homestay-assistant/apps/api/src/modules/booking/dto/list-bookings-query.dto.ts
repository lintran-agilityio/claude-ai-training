import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../../types/enum';

export class ListBookingsQueryDto {
  @ApiProperty({
    description: 'Filter by room ID',
    required: false,
    example: 'lotus-garden',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roomId?: string;

  @ApiProperty({
    description: 'Filter by room name (case-insensitive partial match)',
    required: false,
    example: 'Misty Pavilion',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roomName?: string;

  @ApiProperty({
    description: 'Filter by booking status',
    enum: BookingStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiProperty({
    description:
      'Return active bookings whose stay includes this date (checkIn <= onDate < checkOut). YYYY-MM-DD.',
    required: false,
    example: '2026-08-15',
  })
  @IsOptional()
  @IsString()
  @IsDateString()
  onDate?: string;

  @ApiProperty({
    description:
      'Start of a stay-overlap range filter (inclusive), paired with dateTo. Return only active bookings whose stay overlaps [dateFrom, dateTo). YYYY-MM-DD. Mirrors FindBookingsQueryDto — findBookings() casts to this DTO before querying the repository.',
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

  @ApiProperty({
    description:
      'Return only bookings whose check-in date is exactly this day. YYYY-MM-DD. Does not restrict status.',
    required: false,
    example: '2026-11-01',
  })
  @IsOptional()
  @IsString()
  @IsDateString()
  checkInDate?: string;

  @ApiProperty({
    description:
      'When true, also return cancelled bookings and stays already checked out (skips the default active-only restriction). Used by the host bookings search.',
    required: false,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  includeHistory?: boolean;
}
