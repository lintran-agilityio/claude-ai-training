import type { Thread } from "@/features/chatbot/threads/types";

/**
 * Keeps a single entry per thread id.
 * Prefer the entry with more messages, then the newer updatedAt.
 */
export const dedupeThreadsById = (threads: Thread[]): Thread[] => {
  const byId = new Map<string, Thread>();

  for (const thread of threads) {
    const existing = byId.get(thread.id);

    if (!existing) {
      byId.set(thread.id, thread);
      continue;
    }

    if (thread.messageCount !== existing.messageCount) {
      byId.set(
        thread.id,
        thread.messageCount > existing.messageCount ? thread : existing,
      );
      continue;
    }

    const threadUpdatedAt = thread.updatedAt.getTime();
    const existingUpdatedAt = existing.updatedAt.getTime();

    byId.set(
      thread.id,
      threadUpdatedAt >= existingUpdatedAt ? thread : existing,
    );
  }

  return Array.from(byId.values());
};
