/**
 * Presentation helpers for security-blocked turns.
 *
 * Policy lives in `@repo/utils`. Do not mutate `agent.messages` to stamp
 * blocked metadata — derive UI state at render. Durable blocked ids belong
 * in AG-UI/Mastra (`stream-patch` + thread metadata).
 */

import {
  getProcessorBlockAssistantDisplayText,
  isProcessorBlockAssistantContent,
} from "@repo/constants";
import type { MessageContentLike } from "@/features/chatbot/types";

export { isUserMessageBlockedInTranscript } from "@repo/utils";

/** Strip the durable `@@processor-block@@` marker for assistant bubble text. */
export const getAssistantDisplayContent = (
  content: MessageContentLike,
): string => {
  if (typeof content !== "string") {
    return "";
  }

  if (!isProcessorBlockAssistantContent(content)) {
    return content;
  }

  return getProcessorBlockAssistantDisplayText(content);
};
