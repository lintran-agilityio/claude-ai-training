import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ClerkAuthGuard, CurrentUser, type ClerkAuthUser } from '@/auth';
import { UserResponseDto } from '@/modules/users/dto';
import { UsersService } from '@/modules/users/services/users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the signed-in user profile and role' })
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentUser() user: ClerkAuthUser): Promise<UserResponseDto> {
    const entity = await this.usersService.findOrCreate(user.userId);

    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      // The guard-resolved role is authoritative for this request.
      role: user.role,
    };
  }
}
