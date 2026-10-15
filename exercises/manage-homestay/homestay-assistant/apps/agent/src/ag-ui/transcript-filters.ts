import { getCurrentTurn, isBlockedUserMessage } from "@repo/utils";
import { MESSAGE_ROLE } from "@repo/constants";

import type { AgUiMessage, AgUiMessageContent } from "./types";

export const trailingUserMessageId = (
  messages: AgUiMessage[],
): string | undefined => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === MESSAGE_ROLE.USER && typeof message.id === "string") {
      return message.id;
    }
  }

  return undefined;
};

/**
 * Mastra memory owns completed turns. Send only the latest user turn from the
 * AG-UI transcript so browser-side message ids from older turns cannot be
 * mistaken for new messages. Messages after that user message are retained for
 * frontend-tool continuations that run without adding another user message.
 *
 * Canonical implementation: `@repo/utils` `getCurrentTurn`.
 */
export const selectLatestUserTurn = <T extends AgUiMessage>(
  messages: T[],
): T[] => getCurrentTurn(messages);

const hasText = (content: AgUiMessageContent) =>
  typeof content === "string" ? content.trim().length > 0 : content != null;

/**
 * The AG-UI transcript replays the assistant tool calls of the turn in flight
 * on every frontend-tool continuation. Mastra merges those replayed calls into
 * the turn's stored assistant message, so a tool call memory already resolved
 * gets written again and comes back duplicated on later recalls. Forward only
 * the calls memory does not own yet; the tool result of a resolved call is
 * dropped with it so no result is left orphaned.
 *
 * A second, independent defense against the same invariant —
 * `DedupeToolCallsProcessor` in
 * `apps/agent/src/mastra/processors/dedupe-tool-calls.processor.ts` — dedupes
 * by toolCallId within the *stored* memory prompt sent to the LLM. This one
 * guards the transport-to-memory boundary; that one guards memory-to-LLM.
 * Keep both in sync if the dedupe key or the "resolved" definition changes.
 */
export const excludeResolvedToolCalls = <T extends AgUiMessage>(
  messages: T[],
  resolvedToolCallIds: ReadonlySet<string>,
): T[] => {
  if (resolvedToolCallIds.size === 0) {
    return messages;
  }

  const filtered: T[] = [];

  for (const message of messages) {
    if (message.role === MESSAGE_ROLE.TOOL) {
      if (message.toolCallId && resolvedToolCallIds.has(message.toolCallId)) {
        continue;
      }

      filtered.push(message);
      continue;
    }

    if (message.role !== MESSAGE_ROLE.ASSISTANT || !message.toolCalls?.length) {
      filtered.push(message);
      continue;
    }

    const toolCalls = message.toolCalls.filter(
      (toolCall) => !toolCall.id || !resolvedToolCallIds.has(toolCall.id),
    );

    if (toolCalls.length === message.toolCalls.length) {
      filtered.push(message);
      continue;
    }

    if (toolCalls.length === 0 && !hasText(message.content)) {
      continue;
    }

    filtered.push({ ...message, toolCalls });
  }

  return filtered;
};

/**
 * Drop messages memory already stores. A Stop can land after Mastra persisted
 * part of the in-flight turn that `selectLatestUserTurn` still retains; both
 * copies then reach OpenAI, which rejects "Duplicate item found with id".
 */
export const excludeAlreadyPersistedMessages = <T extends AgUiMessage>(
  messages: T[],
  persistedMessageIds: ReadonlySet<string>,
): T[] => {
  if (persistedMessageIds.size === 0) {
    return messages;
  }

  return messages.filter(
    (message) =>
      typeof message.id !== "string" || !persistedMessageIds.has(message.id),
  );
};

export const findLatestUnblockedUserMessageId = (messages: AgUiMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (
      message?.role === MESSAGE_ROLE.USER &&
      typeof message.id === "string" &&
      !isBlockedUserMessage(message)
    ) {
      return message.id;
    }
  }

  return undefined;
};
