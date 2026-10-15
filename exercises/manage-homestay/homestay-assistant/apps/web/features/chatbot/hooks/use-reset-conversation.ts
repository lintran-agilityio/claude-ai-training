"use client";

import { useResetThread } from "@/features/chatbot/threads/hooks/useResetThread";

type UseResetConversationOptions = {
  agentId: string;
  startNewThread?: () => void;
};

/**
 * Archives the current conversation and starts an empty one.
 * Prefer `useCreateThread` when the existing conversation must be kept.
 */
export const useResetConversation = ({
  agentId,
  startNewThread,
}: UseResetConversationOptions) => {
  const { resetThread } = useResetThread({ agentId, startNewThread });

  return { resetConversation: resetThread };
};
