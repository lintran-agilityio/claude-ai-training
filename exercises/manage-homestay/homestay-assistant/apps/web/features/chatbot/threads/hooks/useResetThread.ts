"use client";

import { useCallback } from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";

import { AGENT_URLS } from "@repo/constants";
import { useChatScopeKey } from "@/features/chatbot/hooks/use-chat-scope-key";
import {
  requestRuntimeAgentStop,
  stopGeneration,
} from "@/features/chatbot/utils/agent-run";
import { useCreateThread } from "@/features/chatbot/threads/hooks/useCreateThread";
import { useThreadStore } from "@/features/chatbot/threads/store/thread-store";

type UseResetThreadOptions = {
  agentId: string;
  startNewThread?: () => void;
};

/**
 * Clears the conversation: archives the active Intelligence thread and starts
 * an empty draft thread.
 *
 * Clearing only `agent.messages` is not enough — the same thread id stays
 * active in the thread store, so a later CopilotChat connect/replay (or a
 * full reload) would bring the archived conversation back.
 */
export const useResetThread = ({
  agentId,
  startNewThread,
}: UseResetThreadOptions) => {
  const { scopeKey } = useChatScopeKey(agentId);
  const { agent } = useAgent({ agentId });
  const { copilotkit } = useCopilotKit();
  const { createThread } = useCreateThread({ agentId, startNewThread });
  const removeThread = useThreadStore((state) => state.deleteThread);

  const resetThread = useCallback(async () => {
    if (!scopeKey) {
      return;
    }

    const { getActiveThreadId, isDraftThread } = useThreadStore.getState();
    const previousThreadId = getActiveThreadId(scopeKey);

    // An in-flight run would keep writing to (and so re-create) the thread.
    if (agent.isRunning) {
      // Store id first: `agent.threadId` can be unset on this hook's instance,
      // which would skip the runtime stop and leave the run rewriting the thread.
      const threadId = previousThreadId ?? agent.threadId;

      stopGeneration({
        stop: () => copilotkit.stopAgent({ agent }),
        fallbackAbort: () => agent.abortRun(),
        runtimeStop: threadId
          ? () =>
              requestRuntimeAgentStop({
                runtimeUrl: AGENT_URLS.HOMESTAY_ASSISTANT,
                agentId,
                threadId,
                headers: copilotkit.headers,
              })
          : undefined,
        threadId,
      });
    }

    createThread();

    // Drafts have no storage row yet, so there is nothing to archive.
    if (!previousThreadId || isDraftThread(previousThreadId)) {
      return;
    }

    removeThread(previousThreadId);

    try {
      const response = await fetch(
        `${AGENT_URLS.HOMESTAY_ASSISTANT}/threads/${encodeURIComponent(previousThreadId)}/archive`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...copilotkit.headers,
          },
          body: JSON.stringify({ agentId }),
        },
      );

      // 404 means the thread never reached storage — already gone.
      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to archive thread: ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to archive conversation on reset", error);
    }
  }, [
    agent,
    agentId,
    copilotkit,
    createThread,
    removeThread,
    scopeKey,
  ]);

  return { resetThread };
};
