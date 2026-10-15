"use client";

import { useEffect, useRef } from "react";
import { useCopilotKit } from "@copilotkit/react-core/v2";

import { useThreadStore } from "@/features/chatbot/threads/store/thread-store";

type UseThreadMessagesProps = {
  agent: {
    threadId?: string;
    setMessages?: (messages: []) => void;
  };
  agentId: string;
  threadId?: string | null;
};

/**
 * Aligns agent.threadId with the active thread and loading UI.
 *
 * Message history is loaded by CopilotKit Intelligence connect/replay when
 * <CopilotChat threadId={...} /> mounts — do not fetch /threads/:id/messages.
 */
export const useThreadMessages = ({
  agent,
  agentId: _agentId,
  threadId,
}: UseThreadMessagesProps) => {
  const agentRef = useRef(agent);
  agentRef.current = agent;
  const loadedThreadIdRef = useRef<string | null>(null);
  const { copilotkit } = useCopilotKit();
  const setLoadingState = useThreadStore((state) => state.setLoadingState);
  const setLoadError = useThreadStore((state) => state.setLoadError);
  const reloadToken = useThreadStore((state) => state.reloadToken);
  const isDraftThread = useThreadStore((state) => state.isDraftThread);
  const isRuntimeConnected =
    copilotkit.runtimeConnectionStatus === "connected";

  useEffect(() => {
    if (!threadId) {
      return;
    }

    // Remount starts with ref=null — that is NOT a thread switch. Clearing
    // here would wipe in-memory agent.messages before Intelligence reconnects.
    const previousThreadId = loadedThreadIdRef.current;
    const isThreadSwitch =
      previousThreadId != null && previousThreadId !== threadId;
    loadedThreadIdRef.current = threadId;

    agentRef.current.threadId = threadId;
    setLoadError(null);

    if (isDraftThread(threadId)) {
      setLoadingState("loaded");
      return;
    }

    // Persisted threads: clear only when switching to a different thread.
    // History load still comes from CopilotChat connect/replay on real switches.
    if (isThreadSwitch) {
      agentRef.current.setMessages?.([]);
    }

    if (isRuntimeConnected) {
      setLoadingState("loaded");
      return;
    }

    setLoadingState("loading");
  }, [
    isDraftThread,
    isRuntimeConnected,
    reloadToken,
    setLoadError,
    setLoadingState,
    threadId,
  ]);
};
