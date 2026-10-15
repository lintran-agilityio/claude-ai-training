import type { AuthErrorMessage } from "../constants";

export type MastraAuthContext = {
  userId: string;
  sessionId?: string;
  /** Raw Clerk JWT when present — forwarded to Nest as Authorization Bearer. */
  clerkToken?: string;
};

export type AuthenticationFailure = {
  status: 401;
  error: AuthErrorMessage;
};

export type VerifyClerkAuthResult =
  | { ok: true; auth: MastraAuthContext }
  | { ok: false; failure: AuthenticationFailure };
