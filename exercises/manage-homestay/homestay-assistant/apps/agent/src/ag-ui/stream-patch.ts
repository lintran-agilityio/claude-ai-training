import { AsyncLocalStorage } from "node:async_hooks";

import {
  formatOtherTripwireAssistantContent,
  formatProcessorBlockAssistantContent,
  formatTokenLimitAssistantContent,
  THREAD_METADATA_BLOCKED_MESSAGE_IDS,
  TRIPWIRE_KIND,
} from "@repo/constants";
import {
  excludeBlockedUserMessages,
  isAbortError,
  normalizeBlockedMessageIds,
} from "@repo/utils";

import {
  abortControllersForThread,
  ensureMastraStreamAbortInjection,
  evictOldestAbortControllerIfNeeded,
  getAbortControllerForRunId,
  registerRunAbortController,
  takeUntilAborted,
  unregisterRunAbortController,
} from "./abort-controllers";
import {
  clearStopLatch,
  getStopLatch,
  isRunBlockedByStopLatch,
  latchThreadStop,
  noteThreadUserMessage,
} from "./stop-latch";
import {
  excludeAlreadyPersistedMessages,
  excludeResolvedToolCalls,
  findLatestUnblockedUserMessageId,
  selectLatestUserTurn,
  trailingUserMessageId,
} from "./transcript-filters";
import {
  interceptTripwireStream,
  persistBlockedMessageId,
  resolveBlockedMessageIds,
  syncBlockedMessageIdsToRequestContext,
  tripwireHandlingContext,
} from "./tripwire";
import type { AgUiMastraAgent, AgUiMessage, ThreadMemoryPort } from "./types";

const patchedAgents = new WeakSet<object>();

type ActiveRunState = { runId: string | undefined };

/**
 * Scopes the run() invocation's runId to the actual async execution of that
 * run (subscription onward), not just the clone instance. The clone-level
 * `activeRunId` closure var below is reassigned per run() call with nothing
 * enforcing one-run-per-clone — if a second run ever starts on the same clone
 * before the first's processFullStream reads it, the closure read would
 * silently pick up the wrong run's abort signal. processFullStream prefers
 * this context over the closure var.
 */
const activeRunContext = new AsyncLocalStorage<ActiveRunState>();

type SubscribableLike = { subscribe: (...args: unknown[]) => unknown };

const isSubscribable = (value: unknown): value is SubscribableLike =>
  !!value &&
  typeof (value as { subscribe?: unknown }).subscribe === "function";

/** Runs the run() Observable's actual (lazy) execution inside runState's ALS scope. */
const scopeSubscriptionToRunState = <T>(
  observable: T,
  runState: ActiveRunState,
): T => {
  if (!isSubscribable(observable)) {
    return observable;
  }

  const originalSubscribe = observable.subscribe.bind(observable);
  observable.subscribe = (...args: unknown[]) =>
    activeRunContext.run(runState, () => originalSubscribe(...args));

  return observable;
};

/**
 * Installs stop/abort wiring, transcript filters, and tripwire interception
 * on one agent.
 *
 * Stop contract (AbortSignal):
 * - `run()` creates an AbortController per Intelligence runId and registers it
 *   by thread so abortRun can cancel every in-flight controller.
 * - `ensureMastraStreamAbortInjection` passes that signal into Mastra `stream()`.
 * - Mastra then checks the signal between steps and forwards it to tools.
 * - `abortRun` + stop latch abort the signal without detachActiveRun (which
 *   would drop the Phoenix socket and surface RUNNER_CONNECTION_DROPPED).
 *
 * These are instance-level overrides, and CopilotKit's run/connect handlers
 * call `agent.clone()` per request. `MastraAgent.clone()` rebuilds the instance
 * from its config, so it keeps none of them — leaving every request on the
 * unpatched methods. Re-applying on each clone is what actually puts these
 * filters on the request path.
 */
const patchAgUiAgent = (
  aguiAgent: AgUiMastraAgent,
  memoryPort: ThreadMemoryPort,
) => {
  if (patchedAgents.has(aguiAgent)) {
    return;
  }

  patchedAgents.add(aguiAgent);

  const originalClone = aguiAgent.clone?.bind(aguiAgent);
  const originalAbortRun = aguiAgent.abortRun?.bind(aguiAgent);
  const originalRun = aguiAgent.run?.bind(aguiAgent);
  let activeRunId: string | undefined;
  let activeThreadId: string | undefined;
  let activeUserMessageId: string | undefined;

  ensureMastraStreamAbortInjection(aguiAgent.agent);

  if (originalClone) {
    aguiAgent.clone = () => {
      const cloned = originalClone();
      patchAgUiAgent(cloned, memoryPort);

      return cloned;
    };
  } else {
    console.warn(
      "[ProcessorTripwire] MastraAgent has no clone(); per-request agent clones may bypass transcript filtering.",
    );
  }

  if (originalRun) {
    aguiAgent.run = (input) => {
      const runId =
        typeof input.runId === "string" && input.runId.length > 0
          ? input.runId
          : undefined;
      const threadId =
        typeof input.threadId === "string" ? input.threadId : undefined;
      const messages = Array.isArray(input.messages)
        ? (input.messages as AgUiMessage[])
        : [];

      if (activeRunId && activeRunId !== runId) {
        unregisterRunAbortController(activeThreadId, activeRunId);
      }

      activeRunId = runId;
      activeThreadId = threadId;
      activeUserMessageId = trailingUserMessageId(messages);

      if (threadId && activeUserMessageId) {
        noteThreadUserMessage(threadId, activeUserMessageId);
      }

      const controller = new AbortController();

      if (runId) {
        registerRunAbortController(threadId, runId, controller);
      }

      // A run starting while the thread is latched is part of the chain the
      // user just stopped — unless it is an explicit new user action (new user
      // message, or a HITL resume). Abort before the model streams anything.
      // FE-tool continuations keep the same trailing user message id, so they
      // stay blocked while the latch is live (do not treat them as a new turn).
      const latch = threadId ? getStopLatch(threadId) : undefined;
      const isResume =
        (Array.isArray(input.resume) && input.resume.length > 0) ||
        !!(input.forwardedProps as { command?: unknown } | undefined)?.command;
      const blockedByStop = isRunBlockedByStopLatch({
        latch,
        isResume,
        activeUserMessageId,
      });

      // An expired latch, a resume, or a new user turn all release the thread.
      if (threadId && !blockedByStop) {
        clearStopLatch(threadId);
      }

      if (blockedByStop) {
        controller.abort();
      }

      evictOldestAbortControllerIfNeeded(runId);

      return scopeSubscriptionToRunState(originalRun(input), { runId });
    };
  }

  // CopilotKit Intelligence `runner.stop()` calls `agent.abortRun()`.
  // Abort the Mastra stream via abortSignal so the runner can finalize with
  // stopRequested. Do NOT call detachActiveRun — that leaves the Phoenix
  // ingestion socket (`{:shutdown, :left}`) and the gateway emits
  // RUNNER_CONNECTION_DROPPED as a user-facing agent error.
  aguiAgent.abortRun = () => {
    const runId = activeRunId;
    const threadId = activeThreadId;

    // Latch the thread so the follow-up run the client starts right after this
    // abort does not keep the generation alive (the reason Stop needed a
    // second click).
    if (threadId) {
      latchThreadStop(threadId);
    }

    // Abort every live controller for this thread — not only this clone's
    // activeRunId. Intelligence may call abort on a clone that never saw run().
    const { runIds, controllers } = abortControllersForThread(threadId, runId);

    for (const controller of controllers) {
      controller.abort();
    }

    try {
      if (typeof aguiAgent.agent?.abortRunStream === "function") {
        for (const id of runIds) {
          aguiAgent.agent.abortRunStream(id);
        }
      }
    } catch (error) {
      console.error(
        "[ProcessorTripwire] abortRunStream failed during abortRun",
        error,
      );
    }

    try {
      originalAbortRun?.();
    } catch (error) {
      console.error("[ProcessorTripwire] original abortRun failed", error);
    }
  };

  if (!aguiAgent.streamMastraAgent || !aguiAgent.processFullStream) {
    // Loud on purpose: these hooks are internals of @ag-ui/mastra. If a version
    // bump renames them, the transcript filters stop running and history
    // silently duplicates instead of failing.
    console.warn(
      "[ProcessorTripwire] MastraAgent is missing streamMastraAgent/processFullStream; transcript filtering and tripwire handling are disabled.",
    );

    return;
  }

  const originalProcessFullStream = aguiAgent.processFullStream.bind(aguiAgent);
  const originalStreamMastraAgent = aguiAgent.streamMastraAgent.bind(aguiAgent);

  aguiAgent.processFullStream = async (stream, callbacks, ...rest) => {
    const runId = activeRunContext.getStore()?.runId ?? activeRunId;
    const signal = getAbortControllerForRunId(runId)?.signal;

    let effectiveStream: AsyncIterable<unknown> = takeUntilAborted(
      stream,
      signal,
    );

    const tripwireContext = tripwireHandlingContext.getStore();

    if (tripwireContext) {
      effectiveStream = interceptTripwireStream(
        effectiveStream,
        async (chunk, kind) => {
          const onTextPart = callbacks.onTextPart;
          const onFinishMessagePart = callbacks.onFinishMessagePart;

          const reason = chunk.payload?.reason ?? "(no reason)";
          const userMessageId =
            tripwireContext.blockedUserMessageId ?? "unknown";

          if (kind === TRIPWIRE_KIND.SECURITY) {
            onTextPart?.(formatProcessorBlockAssistantContent());
            onFinishMessagePart?.();

            if (tripwireContext.blockedUserMessageId) {
              await persistBlockedMessageId({
                mastraAgent: aguiAgent.agent,
                threadId: tripwireContext.threadId,
                messageId: tripwireContext.blockedUserMessageId,
                requestContext: aguiAgent.requestContext,
              });

              const currentBlocked = aguiAgent.requestContext?.get<
                string,
                string[] | undefined
              >(THREAD_METADATA_BLOCKED_MESSAGE_IDS);
              const blockedSet = new Set<string>(
                normalizeBlockedMessageIds(currentBlocked),
              );
              blockedSet.add(tripwireContext.blockedUserMessageId);
              await syncBlockedMessageIdsToRequestContext({
                requestContext: aguiAgent.requestContext,
                blockedMessageIds: [...blockedSet],
              });
            }

            console.info(
              `[ProcessorTripwire] Security block for message ${userMessageId}: ${reason}`,
            );
            return;
          }

          // Token-limit and other tripwires: guest-facing copy, no security
          // marker, and do NOT persist blocked-message security state.
          if (kind === TRIPWIRE_KIND.TOKEN_LIMIT) {
            onTextPart?.(formatTokenLimitAssistantContent());
            onFinishMessagePart?.();
            console.info(
              `[ProcessorTripwire] Token-limit tripwire (not security) for message ${userMessageId}: ${reason}`,
              {
                metadata: chunk.payload?.metadata,
                processorId: chunk.payload?.processorId,
              },
            );
            return;
          }

          onTextPart?.(formatOtherTripwireAssistantContent());
          onFinishMessagePart?.();
          console.info(
            `[ProcessorTripwire] Other tripwire (not security) for message ${userMessageId}: ${reason}`,
            {
              metadata: chunk.payload?.metadata,
              processorId: chunk.payload?.processorId,
            },
          );
        },
      );
    }

    try {
      return await originalProcessFullStream(
        effectiveStream,
        callbacks,
        ...rest,
      );
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        return false;
      }

      throw error;
    }
    // AbortController lifetime is owned by run() — do not delete here.
    // Multi-step / tool loops can call processFullStream more than once per
    // runId; deleting early made later abortRun() a no-op (needed 2nd Stop).
  };

  aguiAgent.streamMastraAgent = async (input, callbacks) => {
    const blockedMessageIds = await resolveBlockedMessageIds({
      memoryPort,
      mastraAgent: aguiAgent.agent,
      threadId: input.threadId,
      requestContext: aguiAgent.requestContext,
      messages: input.messages,
    });

    await syncBlockedMessageIdsToRequestContext({
      requestContext: aguiAgent.requestContext,
      blockedMessageIds: blockedMessageIds as string[],
    });

    const blockedUserMessageId = findLatestUnblockedUserMessageId(
      input.messages,
    );
    const unblockedMessages = excludeBlockedUserMessages(input.messages);
    const latestTurn = selectLatestUserTurn(unblockedMessages);
    const { resolvedToolCallIds, persistedMessageIds } =
      await memoryPort.loadRecalledMessageIds({
        mastraAgent: aguiAgent.agent,
        threadId: input.threadId,
        resourceId: aguiAgent.resourceId,
        requestContext: aguiAgent.requestContext,
      });

    // Track open client-tool envelopes. @ag-ui/mastra emits TOOL_CALL_START on
    // streaming-start for FE tools but does not close them on finish/flush —
    // only on streaming-end. When END is missing, AG-UI rejects RUN_FINISHED.
    // Only auto-END when accumulated args are valid JSON — ending mid-stream
    // with truncated args causes tool_argument_parse_failed.
    const openClientToolCallIds = new Set<string>();
    const argsTextByToolCallId = new Map<string, string>();

    const originalOnToolCallStart = callbacks.onToolCallStart;
    const originalOnToolCallArgs = callbacks.onToolCallArgs;
    const originalOnToolCallEnd = callbacks.onToolCallEnd;
    const originalOnRunFinished = callbacks.onRunFinished;

    const isCompleteJsonArgs = (raw: string) => {
      try {
        JSON.parse(raw);
        return true;
      } catch {
        return false;
      }
    };

    const patchedCallbacks = {
      ...callbacks,
      onToolCallStart: (payload: { toolCallId: string; toolName: string }) => {
        openClientToolCallIds.add(payload.toolCallId);
        argsTextByToolCallId.set(payload.toolCallId, "");
        originalOnToolCallStart?.(payload);
      },
      onToolCallArgs: (payload: {
        toolCallId: string;
        argsTextDelta: string;
      }) => {
        const previous = argsTextByToolCallId.get(payload.toolCallId) ?? "";
        argsTextByToolCallId.set(
          payload.toolCallId,
          previous + (payload.argsTextDelta ?? ""),
        );
        originalOnToolCallArgs?.(payload);
      },
      onToolCallEnd: (payload: { toolCallId: string }) => {
        openClientToolCallIds.delete(payload.toolCallId);
        argsTextByToolCallId.delete(payload.toolCallId);
        originalOnToolCallEnd?.(payload);
      },
      onRunFinished: async (traceId?: string) => {
        if (openClientToolCallIds.size > 0 && originalOnToolCallEnd) {
          for (const toolCallId of [...openClientToolCallIds]) {
            const raw = argsTextByToolCallId.get(toolCallId) ?? "";
            if (!isCompleteJsonArgs(raw)) {
              console.warn(
                `[stream-patch] Skipping TOOL_CALL_END for incomplete client tool args (${toolCallId})`,
              );
              continue;
            }
            originalOnToolCallEnd({ toolCallId });
            openClientToolCallIds.delete(toolCallId);
            argsTextByToolCallId.delete(toolCallId);
          }
        }

        try {
          await originalOnRunFinished?.(traceId);
        } finally {
          // RUN_FINISHED is the terminal event for the whole run (unlike
          // processFullStream, which multi-step/tool loops can invoke more
          // than once per runId) — safe to release the controller here so
          // completed runs don't sit in the maps until the count-based
          // eviction happens to pick them.
          const finishedRunId = activeRunContext.getStore()?.runId ?? activeRunId;
          if (finishedRunId) {
            unregisterRunAbortController(input.threadId, finishedRunId);
          }
        }
      },
    };

    return tripwireHandlingContext.run(
      {
        threadId: input.threadId,
        blockedUserMessageId,
      },
      () =>
        originalStreamMastraAgent(
          {
            ...input,
            messages: excludeAlreadyPersistedMessages(
              excludeResolvedToolCalls(latestTurn, resolvedToolCallIds),
              persistedMessageIds,
            ),
          },
          patchedCallbacks,
        ),
    );
  };
};
export const enableProcessorTripwireHandling = <
  T extends Record<string, object>,
>(
  agents: T,
  memoryPort: ThreadMemoryPort,
): T => {
  for (const value of Object.values(agents)) {
    patchAgUiAgent(value as AgUiMastraAgent, memoryPort);
  }

  return agents;
};

export {
  excludeResolvedToolCalls,
  selectLatestUserTurn,
} from "./transcript-filters";
