import { AsyncLocalStorage } from "node:async_hooks";

import type { RequestContext } from "@mastra/core/request-context";
import {
  THREAD_METADATA_BLOCKED_MESSAGE_IDS,
  type TripwireKind,
} from "@repo/constants";
import {
  isBlockedUserMessage,
  normalizeBlockedMessageIds,
} from "@repo/utils";

import { classifyTripwire } from "./classify-tripwire";
import type { AgUiMessage, MastraAgentLike, MastraStreamChunk } from "./types";
import { isMastraTripwireChunk, ThreadMemoryPort } from "./types";

export type TripwireHandlingContext = {
  threadId: string;
  blockedUserMessageId?: string;
};

export const tripwireHandlingContext =
  new AsyncLocalStorage<TripwireHandlingContext>();

export async function syncBlockedMessageIdsToRequestContext({
  requestContext,
  blockedMessageIds,
}: {
  requestContext?: RequestContext;
  blockedMessageIds: string[];
}) {
  if (!requestContext) {
    return;
  }

  // Same key Mastra processors read — shared constant, not Mastra middleware.
  requestContext.set(THREAD_METADATA_BLOCKED_MESSAGE_IDS, blockedMessageIds);
}

export async function resolveBlockedMessageIds({
  memoryPort,
  mastraAgent,
  threadId,
  requestContext,
  messages,
}: {
  memoryPort: ThreadMemoryPort;
  mastraAgent: MastraAgentLike | null | undefined;
  threadId: string;
  requestContext?: RequestContext;
  messages: AgUiMessage[];
}) {
  const blockedMessageIds = new Set(
    await memoryPort.loadBlockedMessageIds({
      mastraAgent,
      threadId,
      requestContext,
    }),
  );

  for (const message of messages) {
    if (isBlockedUserMessage(message) && typeof message.id === "string") {
      blockedMessageIds.add(message.id);
    }
  }

  return [...blockedMessageIds];
}

export const persistBlockedMessageId = async ({
  mastraAgent,
  threadId,
  messageId,
  requestContext,
}: {
  mastraAgent: MastraAgentLike | null | undefined;
  threadId: string;
  messageId: string;
  requestContext?: RequestContext;
}) => {
  if (!mastraAgent?.getMemory) {
    return;
  }

  try {
    const memory = await mastraAgent.getMemory({ requestContext });

    if (!memory?.getThreadById || !memory.updateThread) {
      return;
    }

    const thread = await memory.getThreadById({ threadId });
    const metadata = { ...(thread?.metadata ?? {}) };
    const rawBlockedIds = metadata[THREAD_METADATA_BLOCKED_MESSAGE_IDS];
    const blockedMessageIds = normalizeBlockedMessageIds(
      Array.isArray(rawBlockedIds) ? rawBlockedIds : undefined,
    );

    if (blockedMessageIds.includes(messageId)) {
      return;
    }

    await memory.updateThread({
      id: threadId,
      title: typeof thread?.title === "string" ? thread.title : "",
      metadata: {
        ...metadata,
        [THREAD_METADATA_BLOCKED_MESSAGE_IDS]: [...blockedMessageIds, messageId],
      },
    });
  } catch (error) {
    console.warn(
      `[ProcessorTripwire] Failed to persist blocked message ${messageId} for thread ${threadId}:`,
      error,
    );
  }
};

export async function* interceptTripwireStream(
  stream: AsyncIterable<unknown>,
  onTripwire: (
    chunk: MastraStreamChunk,
    kind: TripwireKind,
  ) => Promise<void>,
) {
  for await (const chunk of stream) {
    if (!isMastraTripwireChunk(chunk)) {
      yield chunk;
      continue;
    }

    const typedChunk = chunk;
    const kind = classifyTripwire(typedChunk.payload);

    await onTripwire(typedChunk, kind);
    return;
  }
}
