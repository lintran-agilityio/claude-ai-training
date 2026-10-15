/**
 * Client Stop surface for CopilotKit v2 + Intelligence.
 *
 * Ideal AbortSignal flow (this app's mapping):
 * 1. UI Stop → stopAgent + abortRun + HTTP /stop → chat idle / no new tokens
 * 2. Runtime (AG-UI bridge) → AbortController.abort() on the Mastra run signal
 *    (not merely closing the browser socket)
 * 3. Mastra → abortSignal between steps / tools
 * 4. Tools → honor abortSignal before Nest side effects
 *
 * Owns:
 * - Stop orchestration (client stop → discard turn → HTTP /stop)
 * - Error classification (abort, STOPPED, post-Stop thread lock)
 * - Recent-stop window (Intelligence lock TTL can keep follow-up runs at 409)
 *
 * Does not own: AG-UI abortSignal injection / server latch (apps/agent/ag-ui).
 * Stop TTLs: client uses `STOP_RECENT_TTL_MS` (20s); server latch is
 * `STOP_LATCH_TTL_MS` (10s) — one contract in `@repo/constants` `stop-timing`.
 */

import { MESSAGE_ROLE, STOP_RECENT_TTL_MS } from "@repo/constants";
import {
  getCurrentTurnStartIndex,
  isAbortError,
  isAbortLikeErrorMessage,
  isAgUiStopErrorCode,
} from "@repo/utils";
import { AGENT_BUSY_MESSAGE } from "../constants";
import { useChatStore } from "../stores/chat-store";

export { isAbortError } from "@repo/utils";

type RuntimeAgentStopRequest = {
  runtimeUrl: string;
  agentId: string;
  threadId: string;
  headers?: Record<string, string>;
};

type AgentMessageLike = {
  id?: string;
  role?: string;
};

/**
 * Structural view of a CopilotKit agent. Generic over the concrete message
 * type because `setMessages` is contravariant: an agent that only accepts its
 * own message union is not assignable to one accepting `AgentMessageLike[]`.
 */
type StoppableAgent<TMessage extends AgentMessageLike> = {
  messages: TMessage[];
  setMessages: (messages: TMessage[]) => void;
};

const recentlyStoppedAtByThreadId = new Map<string, number>();

const THREAD_LOCKED_ID_RE =
  /Thread\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+is\s+locked/i;

/** Record that the user stopped this thread (call at Stop click time). */
export const markThreadRecentlyStopped = (threadId: string): void => {
  if (!threadId) {
    return;
  }

  recentlyStoppedAtByThreadId.set(threadId, Date.now());
};

/** True while post-Stop follow-up runs may still hit Intelligence 409. */
export const wasThreadRecentlyStopped = (
  threadId: string | null | undefined,
): boolean => {
  if (!threadId) {
    return false;
  }

  const stoppedAt = recentlyStoppedAtByThreadId.get(threadId);

  if (stoppedAt == null) {
    return false;
  }

  if (Date.now() - stoppedAt >= STOP_RECENT_TTL_MS) {
    recentlyStoppedAtByThreadId.delete(threadId);
    return false;
  }

  return true;
};

/** Parse thread id from `AgentThreadLockedError` message when callers omit it. */
export const threadIdFromLockedError = (
  error: Error | null | undefined,
): string | undefined => {
  if (!error) {
    return undefined;
  }

  return error.message.match(THREAD_LOCKED_ID_RE)?.[1];
};

/** True for Intelligence RUN_ERROR events that mean Stop / runner teardown. */
export const isStopRelatedRunErrorEvent = (
  event: { code?: string; message?: string } | null | undefined,
): boolean => {
  if (!event) {
    return false;
  }

  if (isAgUiStopErrorCode(event.code)) {
    return true;
  }

  // Same message contract as `isAbortError` — classify by shape, not a second list.
  return isAbortLikeErrorMessage(event.message);
};

/**
 * True when a CopilotKit onError payload is stop-related (not a real failure).
 * Prefer `isExpectedAgentError` at UI boundaries — that also covers post-Stop 409.
 */
export const isStopRelatedAgentError = (
  error: Error,
  code?: string,
  context?: { runtimeErrorCode?: string } | null,
): boolean => {
  if (code === "agent_run_error_event") {
    if (isAgUiStopErrorCode(context?.runtimeErrorCode)) {
      return true;
    }
  }

  return isAbortError(error);
};

/**
 * True when the run never started because the runtime could not acquire the
 * Intelligence thread lock.
 *
 * `handleIntelligenceRun` maps every `acquireThreadLock` rejection to HTTP 409,
 * and `@copilotkit/core` turns any 409 on a run into `AgentThreadLockedError`.
 * So this covers a genuine concurrent run *and* connectivity failures to the
 * Intelligence platform (observed: UND_ERR_CONNECT_TIMEOUT after 10s). Retry is
 * the right response outside a recent Stop window — see
 * `INTELLIGENCE_THREAD_LOCK_TTL_MS` / `STOP_RECENT_TTL_MS` in `@repo/constants`.
 *
 * CopilotKit emits the same failure twice, once as `agent_thread_locked` from
 * `onRunFailed` and once as `agent_run_failed`, so match on the error name too.
 */
export const isThreadLockedAgentError = (
  error: Error,
  code?: string,
): boolean => {
  return (
    code === "agent_thread_locked" || error.name === "AgentThreadLockedError"
  );
};

/**
 * Model-provider rate-limit / quota rejection (HTTP 429).
 *
 * Cerebras enforces a tokens-per-minute cap: a burst of turns — each carrying
 * the homestay agent's large system prompt + recalled history — exhausts the
 * minute budget and the model call is rejected with
 * `AI_APICallError: Tokens per minute limit exceeded`.
 *
 * This is NOT a Mastra tripwire (those come from an input processor calling
 * `abort()` and are classified by `classifyTripwire` in the AG-UI bridge). It
 * is a raw provider rejection that streams back as a `RUN_ERROR`, so the two
 * token-size guards (`UserMessageTokenLimitProcessor`,`TokenLimiterProcessor`)
 * never see it — a single request stays within their per-message / per-request
 * limits; it is the cumulative per-minute rate that trips. The chat surface
 * classifies it here and offers Retry once the window resets.
 */
const RATE_LIMIT_ERROR_RE =
  /\b(rate[ -]?limit(?:ed|ing)?|too many requests|quota (?:exceeded|reached))\b|tokens? per (?:minute|day)|requests? per (?:minute|day)/i;

/** Bare "429" is ambiguous (ports, ids) — only trust it alongside limit wording. */
const HTTP_429_ERROR_RE =
  /\b429\b[\s\S]{0,40}(?:too many|rate|limit|quota|retry)|(?:too many|rate|limit|quota|retry)[\s\S]{0,40}\b429\b/i;

export const isRateLimitAgentError = (
  error: Error,
  context?: { runtimeErrorCode?: string } | null,
): boolean => {
  const statusCode = (error as { statusCode?: unknown }).statusCode;

  if (statusCode === 429 || context?.runtimeErrorCode === "429") {
    return true;
  }

  return (
    RATE_LIMIT_ERROR_RE.test(error.message) ||
    HTTP_429_ERROR_RE.test(error.message)
  );
};

/**
 * Single UI/provider gate: Stop teardown noise + post-Stop thread-lock races.
 * Genuine concurrent-run locks (no recent Stop) return false so Retry can show.
 */
export const isExpectedAgentError = (
  error: Error,
  code?: string,
  context?: { runtimeErrorCode?: string } | null,
  threadId?: string | null,
): boolean => {
  if (isStopRelatedAgentError(error, code, context)) {
    return true;
  }

  if (!isThreadLockedAgentError(error, code)) {
    return false;
  }

  const lockedThreadId = threadId ?? threadIdFromLockedError(error);

  return wasThreadRecentlyStopped(lockedThreadId);
};

/**
 * Stop the local CopilotRuntime / Intelligence runner for a thread.
 *
 * Needed because Intelligence-mode `agent.abortRun()` only pushes Phoenix
 * `stop_run` and returns early — it skips this HTTP stop. Without it, the
 * server keeps generating and the client reconnects ~1s later.
 */
const postRuntimeAgentStop = async ({
  runtimeUrl,
  agentId,
  threadId,
  headers,
}: RuntimeAgentStopRequest): Promise<boolean> => {
  const stopUrl = `${runtimeUrl}/agent/${encodeURIComponent(agentId)}/stop/${encodeURIComponent(threadId)}`;

  const response = await fetch(stopUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Runtime stop failed: ${response.status}`);
  }

  try {
    const body = (await response.json()) as { stopped?: boolean };
    return body.stopped === true;
  } catch {
    // Non-JSON 200 — treat as best-effort success.
    return true;
  }
};

export const requestRuntimeAgentStop = async (
  request: RuntimeAgentStopRequest,
): Promise<void> => {
  // Runner registers the thread when the run Observable subscribes; a Stop
  // that races channel join can get stopped:false. Retry once briefly.
  if (await postRuntimeAgentStop(request)) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 250));
  await postRuntimeAgentStop(request);
};

/**
 * Id of the in-flight assistant message — the turn Stop should discard so the
 * chat is not left with a mid-stream fragment (e.g. "Check").
 *
 * Only searches the current turn: a Stop before the agent replied must find
 * nothing, not the previous turn's reply — discarding from there would delete
 * completed history.
 */
export const getTrailingAssistantMessageId = (
  messages: AgentMessageLike[],
): string | undefined => {
  const turnStartIndex = getCurrentTurnStartIndex(messages);

  for (let index = messages.length - 1; index > turnStartIndex; index -= 1) {
    const message = messages[index];
    if (
      message?.role === MESSAGE_ROLE.ASSISTANT &&
      typeof message.id === "string"
    ) {
      return message.id;
    }
  }

  return undefined;
};

/**
 * Drop the in-flight assistant message and anything after it (tool error
 * stubs from aborting HITL, partial follow-up text, etc.). Prior turns and
 * the triggering user message stay intact.
 *
 * Presentation: clears the incomplete Stop'd bubble from the chat surface.
 * Not a transcript/memory authority — durable history belongs upstream.
 */
export const discardInFlightAssistantTurn = <TMessage extends AgentMessageLike>(
  agent: StoppableAgent<TMessage>,
  assistantMessageId: string | undefined,
): void => {
  if (!assistantMessageId) {
    return;
  }

  const assistantIndex = agent.messages.findIndex(
    (message) => message.id === assistantMessageId,
  );

  if (assistantIndex < 0) {
    return;
  }

  // Re-run for seconds after a Stop, so a new turn may have started since —
  // never trim into completed history.
  if (assistantIndex <= getCurrentTurnStartIndex(agent.messages)) {
    return;
  }

  agent.setMessages(agent.messages.slice(0, assistantIndex));
};

type StopGenerationOptions = {
  stop: () => void;
  fallbackAbort?: () => void;
  runtimeStop?: () => void | Promise<void>;
  onStopped?: () => void;
  /** Marks the recent-stop window so post-Stop 409 lock errors stay silent. */
  threadId?: string;
};

/**
 * Abort the in-flight agent run (HTTP stream + frontend tool follow-ups).
 * Conversation messages already received are preserved unless `onStopped`
 * discards the in-flight assistant turn.
 *
 * Stops the client immediately, then fires the runtime stop endpoint in
 * parallel when `runtimeStop` is provided (Intelligence skips HTTP stop in
 * `agent.abortRun`).
 */
export const stopGeneration = ({
  stop,
  fallbackAbort,
  runtimeStop,
  onStopped,
  threadId,
}: StopGenerationOptions): void => {
  if (threadId) {
    markThreadRecentlyStopped(threadId);
  }

  // Stop the client immediately so the first click clears isRunning / the
  // Stop button. Await-server-first made the UI keep streaming until a
  // second click. Server stop runs in parallel; abortSignal + takeUntilAborted
  // must end the backend run so Intelligence reconnect cannot resume it.
  try {
    stop();
  } catch (error) {
    console.error("Failed to stop generation", error);
    try {
      fallbackAbort?.();
    } catch (abortError) {
      console.error("abortRun fallback failed", abortError);
    }
  }

  try {
    onStopped?.();
  } catch (error) {
    console.error("Failed to clean up after stop", error);
  }

  if (!runtimeStop) {
    return;
  }

  void Promise.resolve(runtimeStop()).catch((error) => {
    console.error("Runtime stop request failed", error);
  });
};

/**
 * Run an agent and treat expected Stop / post-Stop lock errors as normal.
 */
export const runAgentSafely = async <TResult>(
  run: () => Promise<TResult>,
  onUnexpectedError?: (error: Error) => void,
  threadId?: string | null,
): Promise<void> => {
  try {
    await run();
  } catch (error) {
    const runError = error instanceof Error ? error : new Error(String(error));

    if (isExpectedAgentError(runError, undefined, undefined, threadId)) {
      return;
    }

    if (onUnexpectedError) {
      onUnexpectedError(runError);
      return;
    }

    console.error("Agent run failed", runError);
  }
};

type ChatSendKeyDown = {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  isRunning: boolean;
};

export const resolveAgentBusyMessage = (isRunning: boolean): string | null =>
  isRunning ? AGENT_BUSY_MESSAGE : null;

/** True when Enter would submit chat while the agent is already running. */
export const shouldBlockChatSendKeyDown = ({
  key,
  shiftKey,
  isComposing,
  isRunning,
}: ChatSendKeyDown): boolean => {
  if (!isRunning || isComposing || shiftKey) {
    return false;
  }

  return key === "Enter";
};

/**
 * Blocks a new agent request while a run is in flight and records the
 * guest-facing error. Returns true when the caller must abort.
 */
export const rejectIfAgentRunning = (isRunning: boolean): boolean => {
  const message = resolveAgentBusyMessage(isRunning);
  if (!message) {
    return false;
  }

  useChatStore.getState().setActionError(message);
  return true;
};
