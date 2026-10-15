/**
 * Abort helpers for the CopilotKit → AG-UI → Mastra Stop path.
 *
 * Runtime injects `abortSignal` into `agent.stream()`; Mastra forwards it to
 * prepareStep / tool `execute` context. Tools and HTTP must honor it so Stop
 * does not commit side effects after the user cancels.
 */

import type { RequestContext } from "@mastra/core/request-context";
import { isAbortError, RUN_STOPPED_BY_USER_MESSAGE } from "@repo/utils";

const isAbortSignalAborted = (
  signal: AbortSignal | null | undefined,
): boolean => Boolean(signal?.aborted);

/** Throw a standard AbortError when the run was stopped. */
export const throwIfAborted = (
  signal: AbortSignal | null | undefined,
  message: string = RUN_STOPPED_BY_USER_MESSAGE,
): void => {
  if (!isAbortSignalAborted(signal)) {
    return;
  }

  const error = new Error(message);
  error.name = "AbortError";
  throw error;
};

/** Build Nest API service context from a Mastra tool execution context. */
export const serviceContextFromTool = (context: {
  requestContext?: RequestContext;
  abortSignal?: AbortSignal;
}) => ({
  requestContext: context.requestContext,
  abortSignal: context.abortSignal,
});

/**
 * Re-check the signal immediately before a mutation commits, then run it.
 * Guards the gap between tool setup (pin resolution, ownership checks) and
 * the fetch that actually persists the change, so Stop cannot land after
 * the last check but before the write goes out.
 */
export const commitIfNotAborted = <T>(
  signal: AbortSignal | null | undefined,
  mutate: () => Promise<T>,
): Promise<T> => {
  throwIfAborted(signal);
  return mutate();
};

/**
 * Runs a create/update/cancel booking mutation and converts an expected
 * failure (ownership/state checks, API errors) into a returned `{ message }`
 * result instead of letting it throw out of the tool. A thrown error becomes
 * a `tool-error` stream chunk, and the AG-UI/Mastra bridge only forwards
 * `tool-error` for background-task tool calls — for a normal HITL mutation
 * call it never reaches the frontend, so the confirm card's tool-call status
 * never flips to Complete and stays stuck on "submitting" forever, even
 * though the model still sees the error and can reply in chat. AbortError is
 * rethrown so Stop still actually halts the run.
 */
export const runBookingMutation = async <T>(
  mutate: () => Promise<T>,
): Promise<T | { message: string }> => {
  try {
    return await mutate();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return {
      message: error instanceof Error ? error.message : String(error),
    };
  }
};
