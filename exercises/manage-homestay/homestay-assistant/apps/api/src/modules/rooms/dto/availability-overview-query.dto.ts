import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class AvailabilityOverviewQueryDto {
  @ApiProperty({
    description: 'First night to check (YYYY-MM-DD)',
    example: '2026-07-01',
  })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    description:
      'Check-out date (YYYY-MM-DD, exclusive — the checkout day itself is free). Defaults to date + 1 day.',
    example: '2026-07-02',
  })
  @IsOptional()
  @IsString()
  @IsDateString()
  checkOutDate?: string;
}
