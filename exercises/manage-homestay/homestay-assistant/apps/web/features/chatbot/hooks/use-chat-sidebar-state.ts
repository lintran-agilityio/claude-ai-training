"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CopilotKitCoreErrorCode,
  useAgent,
  useCopilotKit,
} from "@copilotkit/react-core/v2";

import { MESSAGE_ROLE } from "@repo/constants";
import { RUN_START_FAILED_MESSAGE } from "@/features/chatbot/constants";
import { useChatScroll } from "@/features/chatbot/hooks/use-chat-scroll";
import { useChatSuggestions } from "@/features/chatbot/hooks/use-chat-suggestions";
import { useResetConversation } from "@/features/chatbot/hooks/use-reset-conversation";
import { useSilenceStopRunErrors } from "@/features/chatbot/hooks/use-silence-stop-run-errors";
import { useStopGeneration } from "@/features/chatbot/hooks/use-stop-generation";
import { useThreadMessages } from "@/features/chatbot/hooks/use-thread-messages";
import { useChatStore } from "@/features/chatbot/stores/chat-store";
import {
  isExpectedAgentError,
  isRateLimitAgentError,
  isThreadLockedAgentError,
  rejectIfAgentRunning,
  runAgentSafely,
} from "@/features/chatbot/utils";
import { useChatSession } from "@/features/chatbot/threads/hooks/useChatSession";
import { generateId } from "@/utils";

type CopilotKitErrorPayload = {
  error: Error;
  code: CopilotKitCoreErrorCode;
  context: { runtimeErrorCode?: string };
};

const isCopilotKitError = (
  value: unknown,
): value is CopilotKitErrorPayload => {
  return typeof value === "object" && value !== null && "error" in value;
};

type UseChatSidebarStateOptions = {
  agentId: string;
};

/**
 * Owns every piece of chatbot state behind `ChatSidebarContent`: thread session,
 * runtime connection status, pending-message flush on reconnect, run-start /
 * action error notices, and the CopilotChat error routing. The component only
 * renders what this returns.
 */
export const useChatSidebarState = ({
  agentId,
}: UseChatSidebarStateOptions) => {
  const suggestions = useChatSuggestions({ agentId });
  const { resetConversation } = useResetConversation({ agentId });
  useSilenceStopRunErrors({ agentId });

  const {
    scopeKey,
    activeThreadId,
    loadingState,
    error: loadError,
    requestReload,
  } = useChatSession({ agentId });

  const { stopGeneration } = useStopGeneration({
    agentId,
    threadId: activeThreadId,
  });

  const consumePendingOutboundMessage = useChatStore(
    (state) => state.consumePendingOutboundMessage,
  );
  const actionError = useChatStore((state) => state.actionError);
  const actionErrorRetriable = useChatStore(
    (state) => state.actionErrorRetriable,
  );
  const clearActionError = useChatStore((state) => state.clearActionError);

  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({ agentId });

  const [hasHydrated, setHasHydrated] = useState(false);
  const [runStartError, setRunStartError] = useState<string | null>(null);
  const [isRetryingRun, setIsRetryingRun] = useState(false);

  const isThreadLoading = loadingState === "loading";
  const isThreadError = loadingState === "error";

  const agentRef = useRef(agent);
  const copilotkitRef = useRef(copilotkit);
  const wasRuntimeConnectedRef = useRef(
    copilotkit.runtimeConnectionStatus === "connected",
  );
  agentRef.current = agent;
  copilotkitRef.current = copilotkit;

  const isRuntimeConnected =
    copilotkit.runtimeConnectionStatus === "connected";
  const displayedOnlineStatus = hasHydrated && isRuntimeConnected;

  const contentKey = agent.messages
    .map((message) => {
      const contentLength =
        typeof message.content === "string"
          ? message.content.length
          : Array.isArray(message.content)
            ? message.content.length
            : 0;
      const toolKey =
        "toolCalls" in message && Array.isArray(message.toolCalls)
          ? message.toolCalls
              .map(
                (toolCall) =>
                  `${toolCall.id}:${toolCall.function?.arguments?.length ?? 0}`,
              )
              .join(",")
          : "";
      return `${message.id}:${contentLength}:${toolKey}`;
    })
    .join("|");

  useChatScroll({
    messageCount: agent.messages.length,
    isRunning: agent.isRunning,
    contentKey,
  });
  useThreadMessages({ agent, agentId, threadId: activeThreadId });

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // activeThreadId is the only id CopilotKit / AG-UI / Mastra should see.
  useEffect(() => {
    if (activeThreadId) {
      agent.threadId = activeThreadId;
    }
  }, [agent, activeThreadId]);

  const sendPendingMessageRef = useRef<(() => Promise<void>) | undefined>(
    undefined,
  );

  sendPendingMessageRef.current = async () => {
    if (
      !scopeKey ||
      !activeThreadId ||
      copilotkitRef.current.runtimeConnectionStatus !== "connected"
    ) {
      return;
    }

    const currentAgent = agentRef.current;
    // Keep the queued message until the in-flight run finishes — this is a
    // reconnect flush, not a guest send while busy.
    if (currentAgent.isRunning) {
      return;
    }

    const pendingMessage = consumePendingOutboundMessage(scopeKey);
    if (!pendingMessage) {
      return;
    }

    const currentCopilotkit = copilotkitRef.current;
    currentAgent.threadId = activeThreadId;

    currentAgent.addMessage({
      id: generateId(),
      role: MESSAGE_ROLE.USER,
      content: pendingMessage,
    });

    await runAgentSafely(
      () => currentCopilotkit.runAgent({ agent: currentAgent }),
      (error) => {
        console.error("Failed to send pending message", error);
      },
      activeThreadId,
    );
  };

  useEffect(() => {
    const wasConnected = wasRuntimeConnectedRef.current;
    wasRuntimeConnectedRef.current = isRuntimeConnected;

    if (!isRuntimeConnected || wasConnected) {
      return;
    }

    sendPendingMessageRef.current?.();
  }, [isRuntimeConnected, scopeKey]);

  useEffect(() => {
    if (!isRuntimeConnected || agent.isRunning) {
      return;
    }

    sendPendingMessageRef.current?.();
  }, [agent.isRunning, isRuntimeConnected, scopeKey]);

  // A started run (or a thread switch) makes a previous start failure stale.
  useEffect(() => {
    if (agent.isRunning) {
      setRunStartError(null);
    }
  }, [agent.isRunning]);

  useEffect(() => {
    setRunStartError(null);
    clearActionError();
  }, [activeThreadId, clearActionError]);

  // The failed run never reached the agent, so the triggering user message is
  // still the last message in the thread — re-running is enough to retry it.
  const retryRun = useCallback(async () => {
    if (rejectIfAgentRunning(agentRef.current.isRunning)) {
      return;
    }

    setIsRetryingRun(true);
    setRunStartError(null);
    useChatStore.getState().clearActionError();

    await runAgentSafely(
      () => copilotkitRef.current.runAgent({ agent: agentRef.current }),
      (error) => {
        setRunStartError(RUN_START_FAILED_MESSAGE);
        console.error("Failed to retry agent run", error);
      },
      agentRef.current.threadId,
    );

    setIsRetryingRun(false);
  }, []);

  const dismissRunStartError = useCallback(() => {
    setRunStartError(null);
  }, []);

  // The prop type merges the DOM div onError with CopilotKit's own handler, so
  // narrow to the CopilotKit payload before using it.
  const handleChatError = useCallback(
    (event: unknown) => {
      if (!isCopilotKitError(event)) {
        return;
      }

      const { error, code, context } = event;

      // Stop teardown + post-Stop Intelligence 409 — not user failures.
      if (isExpectedAgentError(error, code, context, activeThreadId)) {
        return;
      }

      // Lock acquisition failed outside a Stop window — offer retry.
      if (isThreadLockedAgentError(error, code)) {
        setRunStartError(RUN_START_FAILED_MESSAGE);
        return;
      }

      // Model-provider rate limit (e.g. Cerebras tokens-per-minute) is owned by
      // `handleCopilotError` → chat-store `actionError`, which renders the
      // retriable footer notice. Don't also log it as a failure here.
      if (isRateLimitAgentError(error, context)) {
        return;
      }

      console.error(error);
    },
    [activeThreadId],
  );

  return {
    agentId,
    suggestions,
    activeThreadId,
    displayedOnlineStatus,
    isThreadLoading,
    isThreadError,
    loadError,
    requestReload,
    resetConversation,
    stopGeneration,
    runStartError,
    isRetryingRun,
    retryRun,
    dismissRunStartError,
    actionError,
    actionErrorRetriable,
    clearActionError,
    handleChatError,
  };
};
