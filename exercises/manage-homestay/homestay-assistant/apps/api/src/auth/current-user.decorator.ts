import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { ClerkAuthUser } from './clerk-auth.types';

type AuthenticatedRequest = Request & { user?: ClerkAuthUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClerkAuthUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.userId) {
      throw new Error('CurrentUser used without ClerkAuthGuard');
    }

    return user;
  },
);
