import {
  getCurrentTurnStartIndex,
  type TranscriptMessage,
} from "@repo/utils";

import {
  GENERIC_UI_INTERACTION,
  type GenericUiInteraction,
} from "@/features/chatbot/constants/generic-ui-interaction";

type ToolCallLike = {
  id?: string;
};

type MessageWithToolCalls = TranscriptMessage & {
  id?: string;
  toolCalls?: ToolCallLike[];
};

/**
 * Index of the assistant message that hosts this tool call, or -1 if absent.
 *
 * Scans backward (latest match) rather than forward: AG-UI replays tool
 * calls from earlier turns into later transcript continuations (see
 * transcript-filters.ts), so a toolCallId can appear more than once. Anchoring
 * to the first occurrence would resolve to the stale, earlier-turn copy.
 */
export const findToolCallHostMessageIndex = <T extends MessageWithToolCalls>(
  messages: T[] | undefined,
  toolCallId: string | undefined,
): number => {
  if (!messages?.length || !toolCallId) {
    return -1;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const toolCalls = messages[index]?.toolCalls;
    if (!toolCalls?.length) {
      continue;
    }

    if (toolCalls.some((toolCall) => toolCall.id === toolCallId)) {
      return index;
    }
  }

  return -1;
};

/**
 * True when the tool call's host message is in the current user turn.
 * Missing / not-yet-linked toolCallIds stay actionable (streaming / remount).
 */
export const isToolCallInCurrentInteraction = <T extends MessageWithToolCalls>(
  messages: T[] | undefined,
  toolCallId: string | undefined,
): boolean => {
  if (!toolCallId) {
    return true;
  }

  const hostIndex = findToolCallHostMessageIndex(messages, toolCallId);
  if (hostIndex < 0) {
    return true;
  }

  const turnStartIndex = getCurrentTurnStartIndex(messages ?? []);

  return hostIndex >= turnStartIndex;
};

export const resolveGenericUiInteraction = <T extends MessageWithToolCalls>(
  messages: T[] | undefined,
  toolCallId: string | undefined,
): GenericUiInteraction =>
  isToolCallInCurrentInteraction(messages, toolCallId)
    ? GENERIC_UI_INTERACTION.ACTIVE
    : GENERIC_UI_INTERACTION.SUPERSEDED;

export const isGenericUiActionable = <T extends MessageWithToolCalls>(
  messages: T[] | undefined,
  toolCallId: string | undefined,
): boolean =>
  resolveGenericUiInteraction(messages, toolCallId) ===
  GENERIC_UI_INTERACTION.ACTIVE;
