import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import {
  TokenVerificationError,
  TokenVerificationErrorReason,
} from '@clerk/backend/errors';
import type { Request } from 'express';

import type { ClerkAuthUser } from './clerk-auth.types';

const CLERK_TOKEN_HEADER = 'x-clerk-token';

type AuthenticatedRequest = Request & { user?: ClerkAuthUser };

const stripBearerPrefix = (token: string) =>
  token.startsWith('Bearer ') ? token.slice('Bearer '.length).trim() : token.trim();

const extractClerkToken = (request: Request): string | null => {
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.trim()) {
    return stripBearerPrefix(authorization);
  }

  const headerToken = request.headers[CLERK_TOKEN_HEADER];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  if (Array.isArray(headerToken) && headerToken[0]?.trim()) {
    return headerToken[0].trim();
  }

  return null;
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const clerkToken = extractClerkToken(request);

    if (!clerkToken) {
      throw new UnauthorizedException('Authentication required');
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new UnauthorizedException('Authentication is not configured');
    }

    try {
      const payload = await verifyToken(clerkToken, { secretKey });
      const userId = typeof payload.sub === 'string' ? payload.sub.trim() : '';

      if (!userId) {
        throw new UnauthorizedException('Invalid authentication token');
      }

      request.user = { userId };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof TokenVerificationError) {
        if (error.reason === TokenVerificationErrorReason.TokenExpired) {
          throw new UnauthorizedException('Authentication token expired');
        }

        throw new UnauthorizedException('Invalid authentication token');
      }

      throw new UnauthorizedException('Invalid authentication token');
    }
  }
}
