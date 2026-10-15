"use client";

import { useChatScopeKey } from "@/features/chatbot/hooks/use-chat-scope-key";
import { useThreadStore } from "@/features/chatbot/threads/store/thread-store";

type UseActiveThreadOptions = {
  agentId: string;
};

/**
 * activeThreadId is the single control plane for sidebar + CopilotChat.
 * Never mint an id on render — only via createDraftThread.
 */
export const useActiveThread = ({ agentId }: UseActiveThreadOptions) => {
  const { scopeKey } = useChatScopeKey(agentId);
  const activeThreadId = useThreadStore((state) =>
    scopeKey ? state.activeThreadIds[scopeKey] ?? null : null,
  );
  const activateThread = useThreadStore((state) => state.activateThread);

  const setActiveThread = (threadId: string) => {
    if (!scopeKey) {
      return;
    }

    activateThread(scopeKey, threadId);
  };

  return {
    scopeKey,
    activeThreadId,
    setActiveThread,
  };
};
