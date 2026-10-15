"use client";

import { useUser } from "@clerk/nextjs";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { useCallback, useRef, useState } from "react";

import {
  AGENT_KEYS,
  MESSAGE_ROLE,
} from "@repo/constants";
import { getAgentResourceId } from "@repo/utils";

import { useChatStore } from "@/features/chatbot/stores/chat-store";
import { useThreadStore } from "@/features/chatbot/threads/store/thread-store";
import { runAgentSafely, rejectIfAgentRunning } from "@/features/chatbot/utils";
import { generateId } from "@/utils";

export type UseSendAgentMessageOptions = {
  /** Runs before the message is dispatched, e.g. to set UI focus for the flow. */
  onBeforeSend?: (scopeKey: string) => void;
  onError: (error: unknown) => void;
};

/**
  * Shared plumbing behind request/retry booking hooks: resolves the active
 * thread, falls back to a pending outbound message when disconnected, and
 * otherwise appends a user message and runs the agent.
 */
export const useSendAgentMessage = ({
  onBeforeSend,
  onError,
}: UseSendAgentMessageOptions) => {
  const { user, isLoaded } = useUser();
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });
  const requestInFlightRef = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const activeThreadIds = useThreadStore((state) => state.activeThreadIds);
  const createDraftThread = useThreadStore((state) => state.createDraftThread);
  const setPendingOutboundMessage = useChatStore(
    (state) => state.setPendingOutboundMessage,
  );

  const sendMessage = useCallback(
    (message: string) => {
      if (!isLoaded || !user?.id || requestInFlightRef.current) {
        return;
      }

      if (rejectIfAgentRunning(agent.isRunning)) {
        return;
      }

      const scopeKey = getAgentResourceId(
        user.id,
        AGENT_KEYS.HOMESTAY_ASSISTANT,
      );
      const threadId = activeThreadIds[scopeKey] ?? createDraftThread(scopeKey);

      onBeforeSend?.(scopeKey);

      if (copilotkit.runtimeConnectionStatus !== "connected") {
        setPendingOutboundMessage(scopeKey, message);
        return;
      }

      requestInFlightRef.current = true;
      setIsSending(true);
      agent.threadId = threadId;

      agent.addMessage({
        id: generateId(),
        role: MESSAGE_ROLE.USER,
        content: message,
      });

      void runAgentSafely(
        () => copilotkit.runAgent({ agent }),
        onError,
      ).finally(() => {
        requestInFlightRef.current = false;
        setIsSending(false);
      });
    },
    [
      agent,
      activeThreadIds,
      copilotkit,
      createDraftThread,
      isLoaded,
      onBeforeSend,
      onError,
      setPendingOutboundMessage,
      user?.id,
    ],
  );

  return { sendMessage, isSending };
};
