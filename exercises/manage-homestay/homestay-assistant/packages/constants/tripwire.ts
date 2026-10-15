/**
 * Tripwire classification for AG-UI bridge handling.
 *
 * Prefer reason-string classification: Mastra combines input processors into
 * `${agentId}-input-processor`, so payload.processorId is not the leaf processor.
 */

export const TRIPWIRE_KIND = {
  SECURITY: "security",
  TOKEN_LIMIT: "token-limit",
  OTHER: "other",
} as const;

export type TripwireKind = (typeof TRIPWIRE_KIND)[keyof typeof TRIPWIRE_KIND];

/** PromptInjectionDetector abort reason prefix (Mastra). */
export const PROMPT_INJECTION_TRIPWIRE_REASON_PREFIX =
  "Prompt injection detected";

/** TokenLimiterProcessor TripWire reason prefix (Mastra). */
export const TOKEN_LIMITER_TRIPWIRE_REASON_PREFIX = "TokenLimiterProcessor:";

/** UserMessageTokenLimitProcessor abort reason prefix (ours). */
export const USER_MESSAGE_TOKEN_LIMIT_REASON_PREFIX =
  "User message exceeds token limit";
