import type { MastraDBMessage } from "@mastra/core/agent";

const MISSING_ITEM_RE = /Item with id '(?:fc|rs|msg)_[\w-]+' not found/i;

/** OpenAI Responses item ids (`fc_…` call, `rs_…` reasoning, `msg_…`) kept on recalled parts. */
const readOpenAIItemId = (part: unknown): string | undefined => {
  if (typeof part !== "object" || part === null) {
    return undefined;
  }

  const { providerMetadata } = part as {
    providerMetadata?: { openai?: { itemId?: unknown } };
  };
  const itemId = providerMetadata?.openai?.itemId;

  return typeof itemId === "string" ? itemId : undefined;
};

/**
 * Log-only `ProviderHistoryCompat` rule for
 * `AI_APICallError: Item with id 'fc_…' not found`.
 *
 * OpenAI's Responses API rejects a recalled assistant turn when it references a
 * stored item (`itemId` in the part's providerMetadata) the provider no longer
 * has (store disabled / expired). The error text carries only the id, so list
 * the recalled messages that still hold OpenAI item ids to locate the thread
 * history that triggers it. Returns false: nothing is mutated, no retry.
 */
export const logOpenAIMissingItemRule = {
  name: "log-openai-missing-item",
  errorPatterns: [MISSING_ITEM_RE],
  fix(messages: MastraDBMessage[]) {
    const holders = messages.flatMap((message) => {
      const parts = (message.content as { parts?: unknown[] } | undefined)
        ?.parts;
      const itemIds = (parts ?? []).flatMap(
        (part) => readOpenAIItemId(part) ?? [],
      );

      return itemIds.length
        ? [{ messageId: message.id, role: message.role, itemIds }]
        : [];
    });

    console.error(
      "[openai-missing-item] provider rejected a recalled item id; recalled messages carrying OpenAI item ids:",
      JSON.stringify(holders),
    );

    return false;
  },
};
