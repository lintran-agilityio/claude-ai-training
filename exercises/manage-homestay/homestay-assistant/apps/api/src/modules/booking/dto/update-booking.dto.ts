import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../../types/enum';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsNumber,
} from 'class-validator';

export class UpdateBookingDto {
  @ApiProperty({
    description: 'Check-in date (YYYY-MM-DD)',
    example: '2026-07-01',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  @IsOptional()
  checkInDate?: string;

  @ApiProperty({
    description: 'Check-out date (YYYY-MM-DD)',
    example: '2026-07-03',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  @IsOptional()
  checkOutDate?: string;

  @ApiProperty({
    description: 'Number of guests',
    example: 2,
    minimum: 1,
    required: false,
  })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  @IsOptional()
  guests?: number;

  @ApiProperty({
    description: 'Booking status',
    enum: BookingStatus,
    required: false,
  })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;
}
