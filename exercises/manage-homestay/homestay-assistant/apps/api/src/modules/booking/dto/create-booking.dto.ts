import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../../types/enum';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsPositive,
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Room ID to book',
    example: 'lotus-garden',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  roomId: string;

  @ApiProperty({
    description: 'Check-in date (YYYY-MM-DD)',
    example: '2026-07-01',
  })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  checkInDate: string;

  @ApiProperty({
    description: 'Check-out date (YYYY-MM-DD)',
    example: '2026-07-03',
  })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  checkOutDate: string;

  @ApiProperty({
    description: 'Number of guests',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  guests: number;

  @ApiProperty({
    description: 'Initial booking status',
    enum: BookingStatus,
    required: false,
    default: BookingStatus.PENDING,
  })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;
}
