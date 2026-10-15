import {
  PROMPT_INJECTION_TRIPWIRE_REASON_PREFIX,
  TOKEN_LIMITER_TRIPWIRE_REASON_PREFIX,
  TRIPWIRE_KIND,
  USER_MESSAGE_TOKEN_LIMIT_REASON_PREFIX,
  type TripwireKind,
} from "@repo/constants";

export type TripwirePayloadLike = {
  reason?: string;
};

/**
 * Classify a Mastra tripwire for AG-UI handling.
 *
 * Do not rely on leaf processor ids for input processors — Mastra wraps them as
 * `${agentId}-input-processor`. The abort reason prefix is the stable signal.
 */
export const classifyTripwire = (
  payload?: TripwirePayloadLike | null,
): TripwireKind => {
  const reason = typeof payload?.reason === "string" ? payload.reason : "";

  if (reason.startsWith(PROMPT_INJECTION_TRIPWIRE_REASON_PREFIX)) {
    return TRIPWIRE_KIND.SECURITY;
  }

  if (
    reason.startsWith(TOKEN_LIMITER_TRIPWIRE_REASON_PREFIX) ||
    reason.startsWith(USER_MESSAGE_TOKEN_LIMIT_REASON_PREFIX)
  ) {
    return TRIPWIRE_KIND.TOKEN_LIMIT;
  }

  return TRIPWIRE_KIND.OTHER;
};
