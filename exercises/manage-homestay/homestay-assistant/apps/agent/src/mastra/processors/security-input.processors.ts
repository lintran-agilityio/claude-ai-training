import {
  TokenLimiterProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";

import { AGENT_INPUT_TOKEN_LIMIT } from "@repo/constants";
import { AI_SECURITY_MODEL } from "@/mastra/constants";
import { DedupeToolCallsProcessor } from "./dedupe-tool-calls.processor";
import { ExcludeBlockedMessagesProcessor } from "./exclude-blocked-messages.processor";
import { GuestPromptInjectionProcessor } from "./guest-prompt-injection.processor";
import { UserMessageTokenLimitProcessor } from "./user-message-token-limit.processor";

// Screens genuine guest free-text; skips first-party UI-action prompts
// ([book-form] / [book-stay] / [booking-cancel] …) the web app builds itself —
// see GuestPromptInjectionProcessor.
const promptInjectionProcessor = new GuestPromptInjectionProcessor({
  model: AI_SECURITY_MODEL,
  threshold: 0.8,
  strategy: "block",
  lastMessageOnly: true,
  detectionTypes: ["injection", "jailbreak", "system-override"],
});

const tokenLimitProcessor = new TokenLimiterProcessor({
  limit: AGENT_INPUT_TOKEN_LIMIT,
  trimMode: "contiguous",
});
/** Unicode → blocked-history filter → request size → prompt injection → context window → prompt dedupe */
export const securityInputProcessor = [
  new UnicodeNormalizer({
    stripControlChars: true,
    collapseWhitespace: true,
  }),
  new ExcludeBlockedMessagesProcessor(),
  new UserMessageTokenLimitProcessor(),
  promptInjectionProcessor,
  tokenLimitProcessor,
  new DedupeToolCallsProcessor(),
];
