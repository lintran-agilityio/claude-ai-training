"use client";

import { useChatScopeKey } from "@/features/chatbot/hooks/use-chat-scope-key";
import { useThreadStore } from "@/features/chatbot/threads/store/thread-store";

type UseChatSessionOptions = {
  agentId: string;
};

/**
 * Chat session surface driven by ThreadStore.activeThreadId.
 */
export const useChatSession = ({ agentId }: UseChatSessionOptions) => {
  const { scopeKey } = useChatScopeKey(agentId);
  const activeThreadId = useThreadStore((state) =>
    scopeKey ? state.activeThreadIds[scopeKey] ?? null : null,
  );
  const isLoading = useThreadStore((state) => state.loadingState === "loading");
  const loadingState = useThreadStore((state) => state.loadingState);
  const error = useThreadStore((state) => state.loadError);
  const requestReload = useThreadStore((state) => state.requestReload);
  const isDraftThread = useThreadStore((state) => state.isDraftThread);

  return {
    scopeKey,
    activeThreadId,
    isLoading,
    loadingState,
    error,
    requestReload,
    isDraft: activeThreadId ? isDraftThread(activeThreadId) : false,
  };
};
