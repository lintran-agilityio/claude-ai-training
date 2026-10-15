"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";

import { AGENT_URLS } from "@repo/constants";
import {
  discardInFlightAssistantTurn,
  getTrailingAssistantMessageId,
  requestRuntimeAgentStop,
  stopGeneration,
} from "@/features/chatbot/utils/agent-run";

type UseStopGenerationOptions = {
  agentId: string;
  /**
   * The thread the chat renders. Not `agent.threadId`: it can be unset on this
   * hook's agent instance, which silently skipped the HTTP stop — the only call
   * that aborts the Mastra run.
   */
  threadId: string | null;
};

/** How long to keep re-trimming a stopped turn if Intelligence reconnect replays it. */
const STOPPED_TURN_SUPPRESS_MS = 5_000;

/**
 * Stop the current agent generation (Square button in CopilotChat input).
 * Cancels only this thread's in-flight run and drops the incomplete assistant
 * turn so the chat is not left with a mid-stream fragment.
 *
 * Discarding/dimming the in-flight bubble on Stop is presentation state (UI-
 * owned). The brief re-trim after Intelligence reconnect replay is temporary
 * compatibility — remove when upstream stops replaying stopped turns.
 */
export const useStopGeneration = ({
  agentId,
  threadId,
}: UseStopGenerationOptions) => {
  const { agent } = useAgent({ agentId });
  const { copilotkit } = useCopilotKit();
  const suppressedAssistantIdsRef = useRef<Set<string>>(new Set());
  const suppressTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const suppressAssistantTurn = useCallback(
    (assistantMessageId: string | undefined) => {
      if (!assistantMessageId) {
        return;
      }

      suppressedAssistantIdsRef.current.add(assistantMessageId);
      discardInFlightAssistantTurn(agent, assistantMessageId);

      const existingTimeout = suppressTimeoutsRef.current.get(assistantMessageId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        suppressedAssistantIdsRef.current.delete(assistantMessageId);
        suppressTimeoutsRef.current.delete(assistantMessageId);
      }, STOPPED_TURN_SUPPRESS_MS);

      suppressTimeoutsRef.current.set(assistantMessageId, timeout);
    },
    [agent],
  );

  // Intelligence run-activity reconnect can replay the stopped turn after we
  // trim locally. Keep discarding that message id briefly so the fragment
  // cannot stick.
  useEffect(() => {
    for (const assistantMessageId of suppressedAssistantIdsRef.current) {
      if (agent.messages.some((message) => message.id === assistantMessageId)) {
        discardInFlightAssistantTurn(agent, assistantMessageId);
      }
    }
  }, [agent, agent.messages]);

  useEffect(() => {
    const timeouts = suppressTimeoutsRef.current;

    return () => {
      for (const timeout of timeouts.values()) {
        clearTimeout(timeout);
      }
      timeouts.clear();
    };
  }, []);

  const handleStopGeneration = useCallback(() => {
    const inFlightAssistantId = getTrailingAssistantMessageId(agent.messages);

    // Do not gate on agent.isRunning: CopilotChat can keep the Stop affordance
    // visible across brief isRunning flickers (tool gaps / reconnect). An
    // early return made the first click a no-op and required a second click.
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
      onStopped: () => suppressAssistantTurn(inFlightAssistantId),
      threadId: threadId ?? undefined,
    });
  }, [agent, agentId, copilotkit, suppressAssistantTurn, threadId]);

  return {
    stopGeneration: handleStopGeneration,
    isGenerating: agent.isRunning,
  };
};
