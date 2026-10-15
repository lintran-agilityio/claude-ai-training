"use client";

import { useCallback } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { useBookingStore } from "@/features/booking/stores/booking-store";
import { useArtifactStore } from "@/features/chatbot/stores/artifact-store";
import { useHomestayAgentUiStore } from "@/features/chatbot/stores/homestay-agent-ui-store";
import { useActiveThread } from "@/features/chatbot/threads/hooks/useActiveThread";
import { useThreadStore } from "@/features/chatbot/threads/store/thread-store";
import { useChatStore } from "@/features/chatbot/stores/chat-store";

type UseSwitchThreadOptions = {
  agentId: string;
};

/**
 * Activate an existing thread. activeThreadId alone switches sidebar + chat.
 */
export const useSwitchThread = ({ agentId }: UseSwitchThreadOptions) => {
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
  const setLoadError = useThreadStore((state) => state.setLoadError);
  const setLoadingState = useThreadStore((state) => state.setLoadingState);

  const switchThread = useCallback(
    (threadId: string) => {
      if (!scopeKey || threadId === activeThreadId) {
        return;
      }

      setLoadError(null);
      setLoadingState("loaded");
      clearPendingOutboundMessage(scopeKey);
      resetBooking();
      resetHomestayAgentUi();
      resetArtifacts();
      agent.setMessages?.([]);
      agent.threadId = threadId;
      setActiveThread(threadId);
    },
    [
      activeThreadId,
      agent,
      clearPendingOutboundMessage,
      resetArtifacts,
      resetBooking,
      resetHomestayAgentUi,
      scopeKey,
      setActiveThread,
      setLoadError,
      setLoadingState,
    ],
  );

  return { switchThread };
};
