"use client";

import { useEffect } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import type {
  AgentStateMutation,
  AgentSubscriber,
  RunAgentResult,
} from "@ag-ui/client";

import {
  isExpectedAgentError,
  isRateLimitAgentError,
  isStopRelatedRunErrorEvent,
} from "@/features/chatbot/utils/agent-run";

type UseSilenceStopRunErrorsOptions = {
  agentId: string;
};

const wrapErrorSubscriber = (
  subscriber: AgentSubscriber | undefined,
): AgentSubscriber | undefined => {
  if (!subscriber?.onRunErrorEvent && !subscriber?.onRunFailed) {
    return subscriber;
  }

  const wrapped: AgentSubscriber = { ...subscriber };

  if (subscriber.onRunErrorEvent) {
    const originalOnRunErrorEvent = subscriber.onRunErrorEvent.bind(subscriber);

    wrapped.onRunErrorEvent = async (params) => {
      // Historical RUNNER_CONNECTION_DROPPED from an earlier Stop is replayed
      // on connect and must not surface as a live agent failure.
      if (isStopRelatedRunErrorEvent(params.event)) {
        return;
      }

      return originalOnRunErrorEvent(params);
    };
  }

  if (subscriber.onRunFailed) {
    const originalOnRunFailed = subscriber.onRunFailed.bind(subscriber);

    wrapped.onRunFailed = async (params) => {
      const result = (await originalOnRunFailed(params)) ?? undefined;

      // Model-provider rate limit (e.g. Cerebras tokens-per-minute) is a fully
      // handled, retriable condition: the delegate call above already routed it
      // through `handleCopilotError` → the chat-footer notice. Stop propagation
      // so `AbstractAgent.onError` does not also `console.error("Agent
      // execution failed:")` and rethrow into CopilotKit's generic failure
      // path. `stopPropagation` is read at runtime but omitted from the
      // `onRunFailed` return type, so widen back to `AgentStateMutation`.
      if (isRateLimitAgentError(params.error)) {
        return { ...result, stopPropagation: true } as AgentStateMutation;
      }

      return result;
    };
  }

  return wrapped;
};

const emptyRunResult = (): RunAgentResult => ({
  result: undefined,
  newMessages: [],
});

/**
 * Filters expected Stop / post-Stop errors out of CopilotKit's agent methods
 * so Stop does not open the red error banner or spam console failures.
 *
 * Also stops an already-handled model-provider rate limit (Cerebras
 * tokens-per-minute etc.) from reaching `AbstractAgent.onError`'s unconditional
 * `console.error("Agent execution failed:")` — `handleCopilotError` has already
 * turned it into the retriable chat-footer notice.
 *
 * Part of the client Stop surface owned by `features/chatbot/utils/agent-run.ts`.
 */
export const useSilenceStopRunErrors = ({
  agentId,
}: UseSilenceStopRunErrorsOptions) => {
  const { agent } = useAgent({ agentId });

  useEffect(() => {
    const originalConnectAgent = agent.connectAgent.bind(agent);
    const originalRunAgent = agent.runAgent.bind(agent);

    agent.connectAgent = (parameters, subscriber) =>
      originalConnectAgent(parameters, wrapErrorSubscriber(subscriber));

    agent.runAgent = async (parameters, subscriber) => {
      try {
        return await originalRunAgent(
          parameters,
          wrapErrorSubscriber(subscriber),
        );
      } catch (error) {
        // Follow-up run after Stop often hits Intelligence 409 while the
        // old lock is still held. Swallow so AbstractAgent's "Agent
        // execution failed" path does not leave a user-facing failure.
        if (
          error instanceof Error &&
          isExpectedAgentError(error, undefined, undefined, agent.threadId)
        ) {
          return emptyRunResult();
        }

        throw error;
      }
    };

    return () => {
      agent.connectAgent = originalConnectAgent;
      agent.runAgent = originalRunAgent;
    };
  }, [agent]);
};
