import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { Repository } from 'typeorm';

import { UserRole } from '@/database/entities/enums';
import type { UserEntity } from '@/database/entities/user.entity';
import { ClerkAuthGuard } from './clerk-auth.guard';

jest.mock('@clerk/backend', () => ({ verifyToken: jest.fn() }));
jest.mock('@clerk/backend/errors', () => {
  class TokenVerificationError extends Error {
    reason?: string;
  }
  return {
    TokenVerificationError,
    TokenVerificationErrorReason: { TokenExpired: 'token-expired' },
  };
});

describe('ClerkAuthGuard', () => {
  const originalSecret = process.env.CLERK_SECRET_KEY;
  let findOne: jest.Mock;
  let guard: ClerkAuthGuard;
  let request: { headers: Record<string, string>; user?: unknown };

  const context = () =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test';
    findOne = jest.fn();
    guard = new ClerkAuthGuard({
      findOne,
    } as unknown as Repository<UserEntity>);
    request = { headers: { authorization: 'Bearer token' } };
    (verifyToken as jest.Mock).mockResolvedValue({ sub: 'user_1' });
  });

  afterAll(() => {
    process.env.CLERK_SECRET_KEY = originalSecret;
  });

  it('sets the role loaded from the database', async () => {
    findOne.mockResolvedValue({ id: 'user_1', role: UserRole.MANAGER });

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'user_1', role: UserRole.MANAGER });
  });

  it('defaults to guest when the user has no row', async () => {
    findOne.mockResolvedValue(null);

    await guard.canActivate(context());
    expect(request.user).toEqual({ userId: 'user_1', role: UserRole.GUEST });
  });

  it('defaults to guest when the role lookup fails', async () => {
    findOne.mockRejectedValue(new Error('db down'));

    await guard.canActivate(context());
    expect(request.user).toEqual({ userId: 'user_1', role: UserRole.GUEST });
  });

  it('rejects requests without a token', async () => {
    request = { headers: {} };

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
