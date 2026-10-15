import { ApiProperty } from '@nestjs/swagger';
import { Amenity } from '@/database/entities/enums';
import { BookingStatus } from '../../../types/enum';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsPositive,
  IsHexColor,
  IsUrl,
  IsEnum,
  IsOptional,
  IsArray,
  IsDateString,
} from 'class-validator';

export class RoomResponseDto {
  @ApiProperty({
    description: 'Room ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Room name',
    example: 'Room 1',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  name: string;

  @ApiProperty({
    description: 'Room level',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  level: number;

  @ApiProperty({
    description: 'Room level color',
    example: '#f0f0f0',
  })
  @IsString()
  @IsNotEmpty()
  @IsHexColor()
  levelColor: string;

  @ApiProperty({
    description: 'Room capacity',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  capacity: number;

  @ApiProperty({
    description: 'Room description',
    example: 'Room 1 description',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Room image URL',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl: string;

  @ApiProperty({
    description: 'Room available slots',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  availableSlots: number;

  @ApiProperty({
    description: 'Room price per night',
    example: 100,
  })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  pricePerNight: number;

  @ApiProperty({
    description:
      'Active booking status for the requested user on this room, when userId is provided',
    enum: BookingStatus,
    required: false,
    example: BookingStatus.CONFIRMED,
  })
  @IsEnum(BookingStatus)
  @IsOptional()
  bookingStatus?: BookingStatus;

  @ApiProperty({
    description:
      'Deprecated on room responses — use GET /bookings/availability instead',
    required: false,
    example: true,
  })
  @IsOptional()
  available?: boolean;

  @ApiProperty({
    description: 'Room amenities',
    example: [
      Amenity.MONITOR,
      Amenity.COFFEE,
      Amenity.WIFI,
      Amenity.WHITEBOARD,
    ],
    enum: Amenity,
    isArray: true,
  })
  @IsArray()
  @IsNotEmpty()
  @IsEnum(Amenity, { each: true })
  amenities: Amenity[];

  @ApiProperty({
    description: 'Check-in date of the active booking',
    example: '2026-07-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsDateString()
  checkInDate?: string;

  @ApiProperty({
    description: 'Check-out date of the active booking',
    example: '2026-07-03',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsDateString()
  checkOutDate?: string;
}
