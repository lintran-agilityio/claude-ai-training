import type { RequestContext } from "@mastra/core/request-context";
import { AGENT_MEMORY_LAST_MESSAGES } from "@repo/constants";

type StoredToolInvocation = {
  toolCallId?: string;
  state?: string;
};

type StoredMessage = {
  id?: string;
  content?: {
    parts?: Array<{ type?: string; toolInvocation?: StoredToolInvocation }>;
  };
};

type RecallFn = (args: {
  threadId: string;
  resourceId: string;
  perPage?: number | false;
}) => Promise<{ messages?: StoredMessage[] }>;

type MastraAgentLike = {
  getMemory?: (args: {
    requestContext?: RequestContext;
  }) => Promise<object | null | undefined>;
};

export type RecalledMessageIds = {
  /** Tool calls memory stores together with their result. */
  resolvedToolCallIds: ReadonlySet<string>;
  /** Every message memory stores. */
  persistedMessageIds: ReadonlySet<string>;
};

const EMPTY_RECALLED_IDS: RecalledMessageIds = {
  resolvedToolCallIds: new Set(),
  persistedMessageIds: new Set(),
};

const getRecall = (memory: object | null | undefined): RecallFn | undefined => {
  if (!memory || typeof memory !== "object" || !("recall" in memory)) {
    return undefined;
  }

  const { recall } = memory;

  if (typeof recall !== "function") {
    return undefined;
  }

  // Memory.recall relies on instance methods (e.g. getMergedThreadConfig).
  // Extracting the function without binding loses `this` and throws.
  return (args) => (recall as RecallFn).call(memory, args);
};

const readRecalledMessageIds = (
  messages: StoredMessage[],
): RecalledMessageIds => {
  const resolvedToolCallIds = new Set<string>();
  const persistedMessageIds = new Set<string>();

  for (const message of messages) {
    if (typeof message.id === "string") {
      persistedMessageIds.add(message.id);
    }

    for (const part of message.content?.parts ?? []) {
      if (part?.type !== "tool-invocation") {
        continue;
      }

      const { toolCallId, state } = part.toolInvocation ?? {};

      // A stored call without its result still needs the incoming result to
      // arrive, so only completed invocations count as owned by memory.
      if (typeof toolCallId === "string" && state === "result") {
        resolvedToolCallIds.add(toolCallId);
      }
    }
  }

  return { resolvedToolCallIds, persistedMessageIds };
};

/**
 * Ids memory already owns, within the recall window the model sees — read in
 * one recall per request. Used to drop what the AG-UI transcript replays,
 * which memory would otherwise store and send to the provider a second time.
 */
export async function loadRecalledMessageIdsForThread({
  mastraAgent,
  threadId,
  resourceId,
  requestContext,
}: {
  mastraAgent: MastraAgentLike | null | undefined;
  threadId: string;
  resourceId: string | undefined;
  requestContext?: RequestContext;
}): Promise<RecalledMessageIds> {
  if (!mastraAgent?.getMemory || !resourceId) {
    return EMPTY_RECALLED_IDS;
  }

  try {
    const recall = getRecall(await mastraAgent.getMemory({ requestContext }));

    if (!recall) {
      return EMPTY_RECALLED_IDS;
    }

    // `recall` paginates from the newest message, so this matches the window
    // the agent itself recalls.
    const { messages } = await recall({
      threadId,
      resourceId,
      perPage: AGENT_MEMORY_LAST_MESSAGES,
    });

    return readRecalledMessageIds(messages ?? []);
  } catch (error) {
    console.warn(
      `[AgUiMessages] Failed to load recalled message ids for thread ${threadId}:`,
      error,
    );

    return EMPTY_RECALLED_IDS;
  }
}
