import { ApiProperty } from '@nestjs/swagger';

import { BookingResponseDto } from './booking-response.dto';

export class BookingNotFoundResolutionDto {
  @ApiProperty({ enum: ['not_found'], example: 'not_found' })
  status: 'not_found';

  @ApiProperty({ type: BookingResponseDto, isArray: true, maxItems: 0 })
  bookings: [];
}

export class BookingResolvedResolutionDto {
  @ApiProperty({ enum: ['resolved'], example: 'resolved' })
  status: 'resolved';

  @ApiProperty({ type: BookingResponseDto })
  booking: BookingResponseDto;
}

export class BookingAmbiguousResolutionDto {
  @ApiProperty({ enum: ['ambiguous'], example: 'ambiguous' })
  status: 'ambiguous';

  @ApiProperty({ type: BookingResponseDto, isArray: true, minItems: 2 })
  bookings: BookingResponseDto[];
}

export type BookingResolution =
  | BookingNotFoundResolutionDto
  | BookingResolvedResolutionDto
  | BookingAmbiguousResolutionDto;
