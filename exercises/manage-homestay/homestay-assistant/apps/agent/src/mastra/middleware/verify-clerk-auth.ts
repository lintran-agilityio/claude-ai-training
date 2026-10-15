import { verifyToken } from "@clerk/backend";
import {
  TokenVerificationError,
  TokenVerificationErrorReason,
} from "@clerk/backend/errors";

import type {
  MastraAuthContext,
  VerifyClerkAuthResult,
} from "./authentication/authentication.types";
import { AUTH_ERRORS, CLERK_TOKEN_HEADER } from "./constants";

type VerifyClerkAuthInput = {
  clerkToken?: string | null;
  sessionUserId?: string | null;
  sessionId?: string | null;
};

const stripBearerPrefix = (token: string) =>
  token.startsWith("Bearer ") ? token.slice("Bearer ".length).trim() : token.trim();

const authFailure = (
  error: (typeof AUTH_ERRORS)[keyof typeof AUTH_ERRORS],
): VerifyClerkAuthResult => ({
  ok: false,
  failure: { status: 401, error },
});

const authSuccess = (auth: MastraAuthContext): VerifyClerkAuthResult => ({
  ok: true,
  auth,
});

const withClerkToken = (
  auth: MastraAuthContext,
  clerkToken?: string | null,
): MastraAuthContext => {
  const trimmed = clerkToken?.trim();
  if (!trimmed) {
    return auth;
  }

  return { ...auth, clerkToken: trimmed };
};

export const extractClerkToken = (request: Request): string | null => {
  const headerToken = request.headers.get(CLERK_TOKEN_HEADER);
  if (headerToken?.trim()) {
    return headerToken.trim();
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.trim()) {
    return stripBearerPrefix(authorization);
  }

  return null;
};

const mapTokenVerificationError = (error: TokenVerificationError) => {
  if (error.reason === TokenVerificationErrorReason.TokenExpired) {
    return authFailure(AUTH_ERRORS.TOKEN_EXPIRED);
  }

  return authFailure(AUTH_ERRORS.INVALID_TOKEN);
};

export const verifyClerkAuth = async ({
  clerkToken,
  sessionUserId,
  sessionId,
}: VerifyClerkAuthInput): Promise<VerifyClerkAuthResult> => {
  if (sessionUserId !== undefined && sessionUserId !== null) {
    const trimmedUserId = sessionUserId.trim();
    if (!trimmedUserId) {
      return authFailure(AUTH_ERRORS.INVALID_USER);
    }

    return authSuccess(
      withClerkToken(
        {
          userId: trimmedUserId,
          sessionId: sessionId ?? undefined,
        },
        clerkToken,
      ),
    );
  }

  if (!clerkToken?.trim()) {
    return authFailure(AUTH_ERRORS.REQUIRED);
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required to verify Clerk JWT tokens");
  }

  try {
    const payload = await verifyToken(clerkToken.trim(), { secretKey });
    const userId = typeof payload.sub === "string" ? payload.sub.trim() : "";

    if (!userId) {
      return authFailure(AUTH_ERRORS.INVALID_USER);
    }

    return authSuccess(
      withClerkToken(
        {
          userId,
          sessionId: typeof payload.sid === "string" ? payload.sid : undefined,
        },
        clerkToken,
      ),
    );
  } catch (error) {
    if (error instanceof TokenVerificationError) {
      return mapTokenVerificationError(error);
    }

    throw error;
  }
};
