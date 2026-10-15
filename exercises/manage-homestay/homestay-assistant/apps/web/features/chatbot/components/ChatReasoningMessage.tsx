"use client";

import type { CopilotChatReasoningMessageProps } from "@copilotkit/react-core/v2";

import { ChatLoadingCursor } from "@/features/chatbot/components/ChatLoadingCursor";

/**
 * Replaces CopilotKit's built-in reasoning disclosure — the "Thinking…" row
 * while a model streams its chain of thought and the persistent
 * "Thought for a few seconds ›" toggle it leaves in the transcript afterwards.
 *
 * The homestay chat never surfaces a raw reasoning trace, and every provider we
 * run (OpenAI / OpenRouter / Cerebras) emits `reasoning`-role messages, so this
 * is hidden unconditionally rather than per-provider.
 *
 * While reasoning is still streaming it is the last message, and
 * `CopilotChatMessageView` suppresses its own loading cursor for that case
 * (`lastMessage.role !== "reasoning"`). We stand in the shared typing indicator
 * so the chat doesn't look frozen between the user's turn and the first token
 * of the reply. Once reasoning settles we render nothing — the assistant reply
 * (or its own loading row) takes over.
 */
export const ChatReasoningMessage = ({
  message,
  messages,
  isRunning,
}: CopilotChatReasoningMessageProps) => {
  const isStreamingTail =
    Boolean(isRunning) &&
    messages?.[messages.length - 1]?.id === message.id;

  if (!isStreamingTail) {
    return null;
  }

  return <ChatLoadingCursor />;
};
