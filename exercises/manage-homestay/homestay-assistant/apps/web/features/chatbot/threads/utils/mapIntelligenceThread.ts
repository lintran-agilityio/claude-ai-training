import type { Thread } from "@/features/chatbot/threads/types";

type IntelligenceThread = {
  id: string;
  agentId?: string;
  name?: string | null;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastRunAt?: string;
};

const toDate = (value: string | undefined): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

/** Maps CopilotKit Intelligence thread summary into the UI Thread model. */
export const mapIntelligenceThreadToThread = (
  thread: IntelligenceThread,
  fallbackAgentId: string,
): Thread => {
  const createdAt = toDate(thread.createdAt) ?? new Date();
  const updatedAt = toDate(thread.updatedAt) ?? createdAt;
  const lastRunAt = toDate(thread.lastRunAt);

  return {
    id: thread.id,
    title: thread.name?.trim() || "New chat",
    createdAt,
    updatedAt,
    status: thread.archived ? "archived" : "active",
    // Intelligence summaries do not expose message counts.
    messageCount: 0,
    agentId: thread.agentId ?? fallbackAgentId,
    ...(lastRunAt ? { lastRunAt } : {}),
  };
};
