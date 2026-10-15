"use client";

import { useCallback } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { useBookingStore } from "@/features/booking/stores/booking-store";
import { useArtifactStore } from "@/features/chatbot/stores/artifact-store";
import { useHomestayAgentUiStore } from "@/features/chatbot/stores/homestay-agent-ui-store";
import { useActiveThread } from "@/features/chatbot/threads/hooks/useActiveThread";
import { useThreadStore } from "@/features/chatbot/threads/store/thread-store";
import { useChatStore } from "@/features/chatbot/stores/chat-store";
import type { Thread } from "@/features/chatbot/threads/types";

type UseArchiveThreadOptions = {
  agentId: string;
  threads: Thread[];
  archiveThreadRemote: (threadId: string) => Promise<void>;
  onCreateThread: () => void;
};

/**
 * Archives on Intelligence (soft-remove from default list), then activates
 * the latest remaining thread or starts a new draft.
 */
export const useArchiveThread = ({
  agentId,
  threads,
  archiveThreadRemote,
  onCreateThread,
}: UseArchiveThreadOptions) => {
  const { agent } = useAgent({ agentId });
  const { scopeKey, activeThreadId, setActiveThread } = useActiveThread({
    agentId,
  });
  const clearPendingOutboundMessage = useChatStore(
    (state) => state.clearPendingOutboundMessage,
  );
  const resetBooking = useBookingStore((state) => state.resetBooking);
  const resetHomestayAgentUi = useHomestayAgentUiStore((state) => state.reset);
  const resetArtifacts = useArtifactStore((state) => state.reset);
  const setLoadingState = useThreadStore((state) => state.setLoadingState);

  const archiveThread = useCallback(
    async (threadId: string) => {
      if (!scopeKey) {
        return;
      }

      await archiveThreadRemote(threadId);

      if (activeThreadId !== threadId) {
        return;
      }

      const nextThread = threads.find((thread) => thread.id !== threadId);

      clearPendingOutboundMessage(scopeKey);
      resetBooking();
      resetHomestayAgentUi();
      resetArtifacts();
      agent.setMessages?.([]);

      if (nextThread) {
        setLoadingState("loaded");
        agent.threadId = nextThread.id;
        setActiveThread(nextThread.id);
        return;
      }

      onCreateThread();
    },
    [
      activeThreadId,
      agent,
      archiveThreadRemote,
      clearPendingOutboundMessage,
      onCreateThread,
      resetArtifacts,
      resetBooking,
      resetHomestayAgentUi,
      scopeKey,
      setActiveThread,
      setLoadingState,
      threads,
    ],
  );

  return { archiveThread };
};
