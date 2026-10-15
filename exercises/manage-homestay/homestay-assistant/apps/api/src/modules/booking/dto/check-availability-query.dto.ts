import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CheckAvailabilityQueryDto {
  @ApiProperty({
    description: 'Room ID to check',
    example: 'lotus-garden',
  })
  @IsString()
  @IsNotEmpty()
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

  @ApiPropertyOptional({
    description:
      'Guest count to validate against room.capacity (not availableSlots)',
    example: 2,
    minimum: 1,
  })
  @IsOptional()
  guests?: number | string;

  @ApiPropertyOptional({
    description:
      'When modifying an existing booking, exclude this booking ID from overlap detection so the stay does not conflict with itself',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  excludeBookingId?: string;
}
