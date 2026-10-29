import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@/database/entities/enums';

export class UserResponseDto {
  @ApiProperty({ example: 'user_2abcDEF123' })
  id: string;

  @ApiProperty({ example: 'guest@example.com' })
  email: string;

  @ApiProperty({ example: 'Jane Doe', nullable: true, type: String })
  name: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.GUEST })
  role: UserRole;
}
