/**
 * AG-UI bridge layer (CopilotKit Runtime ↔ Mastra).
 *
 * Stop (AbortSignal) ownership in this stack:
 * 1. CopilotKit UI — stopAgent / HTTP /stop → idle chat, no new tokens
 * 2. This layer — AbortController per run; inject abortSignal into Mastra
 *    stream(); abortRun + stop latch kill the run chain (Intelligence WS,
 *    not a plain SSE close)
 * 3. Mastra — honors abortSignal between steps (prepareStep) and in tools
 * 4. Tools / Nest fetch — throwIfAborted + fetch({ signal }) before side effects
 *
 * Owns: stream adaptation, abortSignal injection, stop latch, tripwire,
 * and transcript/stream compatibility so the UI does not become the long-term
 * home for memory/replay data fixes.
 * Does not own: prompts, Nest domain logic, CopilotKit presentation state
 * (animations, optimistic UI, Stop dismiss/dim of incomplete bubbles).
 *
 * HTTP `/stop` must both latch the thread and abortThreadRuns(threadId) so
 * in-flight Mastra streams die even when the Intelligence runner map is empty.
 *
 * Stop TTLs: see `@repo/constants` `stop-timing` — latch (10s) and client
 * silent-409 (20s) are one contract; review them together.
 *
 * Memory loaders stay in Mastra; inject them via {@link ThreadMemoryPort}.
 */

export {
  clearStopLatch,
  getStopLatch,
  isRunBlockedByStopLatch,
  isStopLatchLive,
  latchThreadStop,
  noteThreadUserMessage,
  type StopLatchEntry,
} from "./stop-latch";

export { abortThreadRuns } from "./abort-controllers";

export { excludeBlockedUserMessages, isBlockedUserMessage } from "@repo/utils";

export { enableProcessorTripwireHandling } from "./stream-patch";
export * from "./types";
