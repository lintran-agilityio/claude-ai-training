import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '@/database/entities/enums';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class Handlers {
  @Roles(UserRole.MANAGER)
  managerOnly(this: void) {}

  open(this: void) {}
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const handlers = new Handlers();

  const context = (handler: () => void, role?: UserRole) =>
    ({
      getHandler: () => handler,
      getClass: () => Handlers,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { userId: 'u', role } : undefined }),
      }),
    }) as unknown as ExecutionContext;

  it('allows a user holding a required role', () => {
    expect(
      guard.canActivate(context(handlers.managerOnly, UserRole.MANAGER)),
    ).toBe(true);
  });

  it('denies a user without the required role', () => {
    expect(() =>
      guard.canActivate(context(handlers.managerOnly, UserRole.GUEST)),
    ).toThrow(ForbiddenException);
  });

  it('denies when no user is attached', () => {
    expect(() => guard.canActivate(context(handlers.managerOnly))).toThrow(
      ForbiddenException,
    );
  });

  it('allows routes without role metadata', () => {
    expect(guard.canActivate(context(handlers.open, UserRole.GUEST))).toBe(
      true,
    );
  });
});
