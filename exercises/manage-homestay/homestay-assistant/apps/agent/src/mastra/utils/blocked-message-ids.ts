import type { RequestContext } from "@mastra/core/request-context";
import { THREAD_METADATA_BLOCKED_MESSAGE_IDS } from "@repo/constants";
import { normalizeBlockedMessageIds } from "@repo/utils";

type MemoryLike = {
  getThreadById?: (args: { threadId: string }) => Promise<{
    metadata?: Record<string, unknown>;
  } | null>;
};

type MastraAgentLike = {
  getMemory?: (args: {
    requestContext?: RequestContext;
  }) => Promise<MemoryLike | null>;
};

const readBlockedMessageIdsFromMetadata = (
  metadata: Record<string, unknown> | undefined,
) => {
  const value = metadata?.[THREAD_METADATA_BLOCKED_MESSAGE_IDS];

  return normalizeBlockedMessageIds(Array.isArray(value) ? value : undefined);
};

/**
 * Blocked message ids a thread already persisted in its memory metadata.
 * Injected into the AG-UI bridge via `ThreadMemoryPort` so the bridge stays
 * free of `@/mastra` imports — the sibling of `loadRecalledMessageIdsForThread`.
 */
export async function loadBlockedMessageIdsForThread({
  mastraAgent,
  threadId,
  requestContext,
}: {
  mastraAgent: MastraAgentLike | null | undefined;
  threadId: string;
  requestContext?: RequestContext;
}) {
  if (!mastraAgent?.getMemory) {
    return [] as string[];
  }

  try {
    const memory = await mastraAgent.getMemory({ requestContext });

    if (!memory?.getThreadById) {
      return [];
    }

    const thread = await memory.getThreadById({ threadId });

    return readBlockedMessageIdsFromMetadata(thread?.metadata);
  } catch (error) {
    console.warn(
      `[BlockedMessages] Failed to load blocked message ids for thread ${threadId}:`,
      error,
    );

    return [];
  }
}
