export const PROCESSOR_BLOCK_MESSAGE_PREFIX = "@@processor-block@@";

export const PROCESSOR_BLOCK_ASSISTANT_TEXT =
  "Your message couldn't be processed for security reasons. Please rephrase and try again — you can continue booking or asking about rooms normally.";

/** Guest-facing copy for TokenLimiter / per-message token limit tripwires (not security). */
export const PROCESSOR_TOKEN_LIMIT_ASSISTANT_TEXT =
  "Your message couldn't be processed because the conversation context is too large. Please start a new chat or shorten your request and try again.";

/** Guest-facing copy for unclassified processor/runtime tripwires (not security). */
export const PROCESSOR_OTHER_TRIPWIRE_ASSISTANT_TEXT =
  "Your message couldn't be processed right now. Please try again.";

export const formatProcessorBlockAssistantContent = () =>
  `${PROCESSOR_BLOCK_MESSAGE_PREFIX}\n${PROCESSOR_BLOCK_ASSISTANT_TEXT}`;

/** Plain assistant text — no @@processor-block@@ marker (avoids security banner). */
export const formatTokenLimitAssistantContent = () =>
  PROCESSOR_TOKEN_LIMIT_ASSISTANT_TEXT;

/** Plain assistant text — no @@processor-block@@ marker (avoids security banner). */
export const formatOtherTripwireAssistantContent = () =>
  PROCESSOR_OTHER_TRIPWIRE_ASSISTANT_TEXT;

export type BlockedMessageMetadata = {
  blocked?: boolean;
};

export const isBlockedMessageMetadata = (
  metadata: unknown,
): metadata is BlockedMessageMetadata =>
  Boolean(
    metadata &&
      typeof metadata === "object" &&
      (metadata as BlockedMessageMetadata).blocked === true,
  );

export const isProcessorBlockAssistantContent = (content: unknown) =>
  typeof content === "string" &&
  content.startsWith(PROCESSOR_BLOCK_MESSAGE_PREFIX);

export const getProcessorBlockAssistantDisplayText = (content: string) => {
  const newlineIndex = content.indexOf("\n");

  if (newlineIndex === -1) {
    return PROCESSOR_BLOCK_ASSISTANT_TEXT;
  }

  return content.slice(newlineIndex + 1).trim() || PROCESSOR_BLOCK_ASSISTANT_TEXT;
};
