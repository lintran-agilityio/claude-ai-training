import { ApiProperty } from '@nestjs/swagger';

import { BookingStatus } from '../../../types/enum';

import { UpcomingPeriod } from '@/modules/booking/dto/upcoming-bookings-query.dto';

export class UpcomingBookingItemDto {
  @ApiProperty({ example: 'bk-1' })
  id: string;

  @ApiProperty({ example: 'Lotus Garden' })
  roomName: string;

  @ApiProperty({ example: 2 })
  guests: number;

  @ApiProperty({ example: 'Nguyen' })
  guestName: string;

  @ApiProperty({
    description:
      'Check-in date for arrivals, check-out date for departures (YYYY-MM-DD)',
    example: '2026-10-29',
  })
  date: string;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.CONFIRMED })
  status: BookingStatus;
}

export class UpcomingBookingsResponseDto {
  @ApiProperty({ enum: UpcomingPeriod })
  period: UpcomingPeriod;

  @ApiProperty({
    description: 'Inclusive start date (YYYY-MM-DD)',
    example: '2026-10-29',
  })
  from: string;

  @ApiProperty({
    description: 'Exclusive end date (YYYY-MM-DD)',
    example: '2026-10-30',
  })
  to: string;

  @ApiProperty({ type: UpcomingBookingItemDto, isArray: true })
  checkIns: UpcomingBookingItemDto[];

  @ApiProperty({ type: UpcomingBookingItemDto, isArray: true })
  checkOuts: UpcomingBookingItemDto[];
}
