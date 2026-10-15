import { isAbortError } from "@repo/utils";

import type { MastraAgentLike } from "./types";

/** Per CopilotKit/Intelligence runId — abortSignal injected into Mastra stream(). */
const abortControllersByRunId = new Map<string, AbortController>();

/**
 * Maps threadId → live runIds so abortRun can cancel every in-flight controller
 * for a thread, even when Intelligence calls abort on a clone whose
 * `activeRunId` is stale or empty (first-click Stop miss).
 */
const runIdsByThreadId = new Map<string, Set<string>>();

const streamPatchedMastraAgents = new WeakSet<object>();

export const registerRunAbortController = (
  threadId: string | undefined,
  runId: string,
  controller: AbortController,
) => {
  abortControllersByRunId.set(runId, controller);

  if (!threadId) {
    return;
  }

  const runIds = runIdsByThreadId.get(threadId) ?? new Set<string>();
  runIds.add(runId);
  runIdsByThreadId.set(threadId, runIds);
};

export const unregisterRunAbortController = (
  threadId: string | undefined,
  runId: string,
) => {
  abortControllersByRunId.delete(runId);

  if (!threadId) {
    return;
  }

  const runIds = runIdsByThreadId.get(threadId);

  if (!runIds) {
    return;
  }

  runIds.delete(runId);

  if (runIds.size === 0) {
    runIdsByThreadId.delete(threadId);
  }
};

export const abortControllersForThread = (
  threadId: string | undefined,
  preferredRunId?: string,
): { runIds: string[]; controllers: AbortController[] } => {
  const runIds = new Set<string>();

  if (preferredRunId) {
    runIds.add(preferredRunId);
  }

  if (threadId) {
    for (const runId of runIdsByThreadId.get(threadId) ?? []) {
      runIds.add(runId);
    }
  }

  const controllers: AbortController[] = [];

  for (const runId of runIds) {
    const controller = abortControllersByRunId.get(runId);

    if (controller) {
      controllers.push(controller);
    }
  }

  return { runIds: [...runIds], controllers };
};

/**
 * Abort every live AbortController for a thread.
 *
 * Used by HTTP `/stop` so Mastra is cancelled even when Intelligence
 * `runner.stop()` returns false (no thread in the runner map). Idempotent:
 * unknown / empty threadIds and threads with no controllers are no-ops.
 */
export const abortThreadRuns = (threadId: string | undefined): void => {
  if (!threadId) {
    return;
  }

  const { controllers } = abortControllersForThread(threadId);

  for (const controller of controllers) {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  }
};

export const getAbortControllerForRunId = (
  runId: string | undefined,
): AbortController | undefined =>
  runId ? abortControllersByRunId.get(runId) : undefined;

/** Bound map growth if clones are discarded without abort/complete. */
export const evictOldestAbortControllerIfNeeded = (
  keepRunId: string | undefined,
) => {
  if (abortControllersByRunId.size <= 64) {
    return;
  }

  const oldest = abortControllersByRunId.keys().next().value;
  if (!oldest || oldest === keepRunId) {
    return;
  }

  let oldestThreadId: string | undefined;
  for (const [mappedThreadId, runIds] of runIdsByThreadId) {
    if (runIds.has(oldest)) {
      oldestThreadId = mappedThreadId;
      break;
    }
  }
  unregisterRunAbortController(oldestThreadId, oldest);
};

/**
 * Stop forwarding chunks as soon as `signal` aborts — do not wait for the
 * next LLM token. A plain `for await` only checks aborted after each chunk,
 * so Stop appeared to do nothing until another token arrived (often a
 * second click).
 */
export async function* takeUntilAborted(
  stream: AsyncIterable<unknown>,
  signal: AbortSignal | undefined,
) {
  if (signal?.aborted) {
    return;
  }

  const iterator = stream[Symbol.asyncIterator]();
  let abortListener: (() => void) | undefined;
  const abortPromise =
    signal == null
      ? null
      : new Promise<"aborted">((resolve) => {
          if (signal.aborted) {
            resolve("aborted");
            return;
          }

          abortListener = () => resolve("aborted");
          signal.addEventListener("abort", abortListener, { once: true });
        });

  try {
    while (true) {
      const nextPromise = iterator.next();
      const raced =
        abortPromise == null
          ? { kind: "next" as const, result: await nextPromise }
          : await Promise.race([
              nextPromise.then((result) => ({
                kind: "next" as const,
                result,
              })),
              abortPromise.then((kind) => ({ kind })),
            ]);

      if (raced.kind === "aborted") {
        try {
          await iterator.return?.();
        } catch {
          // Best-effort close of the underlying Mastra stream.
        }
        return;
      }

      if (raced.result.done) {
        return;
      }

      yield raced.result.value;
    }
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      return;
    }

    throw error;
  } finally {
    if (signal && abortListener) {
      signal.removeEventListener("abort", abortListener);
    }
  }
}

/**
 * Shared LocalMastraAgent instances are reused across AG-UI clones. Inject
 * abortSignal from the per-runId map so concurrent threads do not share one
 * controller.
 */
export const ensureMastraStreamAbortInjection = (
  mastraAgent: MastraAgentLike | null | undefined,
) => {
  if (!mastraAgent?.stream || streamPatchedMastraAgents.has(mastraAgent)) {
    return;
  }

  streamPatchedMastraAgents.add(mastraAgent);

  const originalStream = mastraAgent.stream.bind(mastraAgent);

  mastraAgent.stream = (messages, options = {}) => {
    const runId = typeof options.runId === "string" ? options.runId : undefined;
    const controller = runId
      ? abortControllersByRunId.get(runId)
      : undefined;

    return originalStream(messages, {
      ...options,
      ...(controller ? { abortSignal: controller.signal } : {}),
    });
  };
};
