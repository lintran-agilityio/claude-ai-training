import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { Amenity } from '@/database/entities/enums';

export class CreateRoomDto {
  @ApiProperty({ description: 'Room name', example: 'Lotus Garden' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Room level', example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  level: number;

  @ApiProperty({ description: 'Room level color', example: '#f0f0f0' })
  @IsHexColor()
  levelColor: string;

  @ApiProperty({ description: 'Room capacity', example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiProperty({ description: 'Room description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Room image URL' })
  @IsUrl()
  imageUrl: string;

  @ApiProperty({ description: 'Available slots', example: 1, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  availableSlots: number;

  @ApiProperty({ description: 'Price per night', example: 100, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerNight: number;

  @ApiProperty({ enum: Amenity, isArray: true })
  @IsArray()
  @IsEnum(Amenity, { each: true })
  amenities: Amenity[];
}
