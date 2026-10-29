import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '@/database/entities/user.entity';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { RolesGuard } from './roles.guard';

// Global + re-exporting the user repository lets any module's
// `@UseGuards(ClerkAuthGuard)` resolve the guard's dependencies.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [ClerkAuthGuard, RolesGuard],
  exports: [ClerkAuthGuard, RolesGuard, TypeOrmModule],
})
export class AuthModule {}
