import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum UpcomingPeriod {
  TODAY = 'today',
  TOMORROW = 'tomorrow',
  NEXT_3_DAYS = 'next3days',
}

export class UpcomingBookingsQueryDto {
  @ApiPropertyOptional({
    description:
      'Period to list arrivals and departures for. next3days = today plus the following 2 days.',
    enum: UpcomingPeriod,
    default: UpcomingPeriod.TODAY,
  })
  @IsOptional()
  @IsEnum(UpcomingPeriod)
  period?: UpcomingPeriod;
}
