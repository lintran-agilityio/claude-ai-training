import type { ProcessInputStepArgs } from "@mastra/core/processors";

import { asUnknownRecord, type JsonValue } from "@/mastra/utils/json-value";

/** `content.parts` of a stored (format 2) Mastra message, or null when absent. */
export const getMessageParts = (
  message: ProcessInputStepArgs["messages"][number] | undefined,
): JsonValue[] | null => {
  const content = asUnknownRecord(message?.content);
  const parts = content?.parts;

  return Array.isArray(parts) ? parts : null;
};
