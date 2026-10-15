import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../../types/enum';
import { RoomResponseDto } from '@/modules/rooms/dto/room-response.dto';
import {
  IsDate,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class BookingResponseDto {
  @ApiProperty({
    description: 'Booking ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @ApiProperty({ example: 'guest-user' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'lotus-garden' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  roomId: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  checkInDate: string;

  @ApiProperty({ example: '2026-07-03' })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  checkOutDate: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  guests: number;

  @ApiProperty({ example: 1_500_000 })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  totalPrice: number;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.PENDING })
  @IsEnum(BookingStatus)
  @IsNotEmpty()
  status: BookingStatus;

  @ApiProperty({
    description: 'When the booking was cancelled',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsDate()
  cancelledAt?: Date | null;

  @ApiProperty({ type: RoomResponseDto, required: false })
  @IsOptional()
  @IsObject()
  room?: RoomResponseDto;

  @ApiProperty()
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;

  @ApiProperty()
  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;
}
