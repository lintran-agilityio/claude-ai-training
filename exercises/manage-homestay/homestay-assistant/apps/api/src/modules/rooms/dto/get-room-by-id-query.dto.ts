import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetRoomByIdQueryDto {
  @ApiProperty({
    description: 'User ID',
    example: '123',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
