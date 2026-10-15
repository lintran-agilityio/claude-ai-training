"use client";

import { useCallback } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { useChatScopeKey } from "@/features/chatbot/hooks/use-chat-scope-key";
import { useChatStore } from "@/features/chatbot/stores/chat-store";
import { useArtifactStore } from "@/features/chatbot/stores/artifact-store";
import { useHomestayAgentUiStore } from "@/features/chatbot/stores/homestay-agent-ui-store";
import { useBookingStore } from "@/features/booking/stores/booking-store";
import { useThreadStore } from "@/features/chatbot/threads/store/thread-store";

type UseCreateThreadOptions = {
  agentId: string;
  /**
   * From the shared CopilotKit useThreads instance (MainLayout).
   * Clears Intelligence thread-list errors; required for the official new-thread flow.
   */
  startNewThread?: () => void;
};

/**
 * New thread workflow (controlled threadId, CopilotKit Intelligence):
 * 1. CopilotKit startNewThread() — clears thread-list error state
 * 2. Mint/activate local draft UUID (CopilotChat threadId is controlled)
 * 3. Reset chat + domain UI; Intelligence persists on first run
 */
export const useCreateThread = ({
  agentId,
  startNewThread,
}: UseCreateThreadOptions) => {
  const { scopeKey } = useChatScopeKey(agentId);
  const { agent } = useAgent({ agentId });
  const createDraftThread = useThreadStore((state) => state.createDraftThread);
  const clearPendingOutboundMessage = useChatStore(
    (state) => state.clearPendingOutboundMessage,
  );
  const resetBooking = useBookingStore((state) => state.resetBooking);
  const resetHomestayAgentUi = useHomestayAgentUiStore((state) => state.reset);
  const resetArtifacts = useArtifactStore((state) => state.reset);

  const createThread = useCallback(() => {
    if (!scopeKey) {
      return null;
    }

    // Same sequence as CopilotThreadsDrawer.handleNewThread for controlled ids.
    startNewThread?.();

    const threadId = createDraftThread(scopeKey);
    clearPendingOutboundMessage(scopeKey);

    agent.threadId = threadId;
    agent.setMessages?.([]);
    resetBooking();
    resetHomestayAgentUi();
    resetArtifacts();

    return threadId;
  }, [
    agent,
    clearPendingOutboundMessage,
    createDraftThread,
    resetArtifacts,
    resetBooking,
    resetHomestayAgentUi,
    scopeKey,
    startNewThread,
  ]);

  return { createThread };
};
