"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThreads as useCopilotThreads } from "@copilotkit/react-core/v2";

import type { Thread } from "@/features/chatbot/threads/types";
import {
  groupThreadsByDate,
  mapIntelligenceThreadToThread,
} from "@/features/chatbot/threads/utils";
import { useThreadStore } from "@/features/chatbot/threads/store/thread-store";

type UseThreadsOptions = {
  agentId: string;
  enabled?: boolean;
  /** Active thread — used to surface a local draft row before Intelligence persists it. */
  activeThreadId?: string | null;
};

const createDraftThreadItem = (
  threadId: string,
  agentId: string,
): Thread => {
  const now = new Date();

  return {
    id: threadId,
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    status: "active",
    messageCount: 0,
    agentId,
  };
};

/**
 * Lists / renames / archives durable threads via CopilotKit Intelligence.
 * Active drafts appear in the sidebar immediately; Intelligence rows replace
 * them after the first persisted run (without wiping the list on refetch).
 */
export const useThreads = ({
  agentId,
  enabled = true,
  activeThreadId = null,
}: UseThreadsOptions) => {
  const setThreadsFetched = useThreadStore((state) => state.setThreadsFetched);
  const setThreadsError = useThreadStore((state) => state.setThreadsError);
  const setPersistedThreads = useThreadStore(
    (state) => state.setPersistedThreads,
  );
  const deleteThreadLocal = useThreadStore((state) => state.deleteThread);
  const draftThreadIds = useThreadStore((state) => state.draftThreadIds);
  const hasLoadedOnceRef = useRef(false);

  const {
    threads: intelligenceThreads,
    isLoading,
    error,
    refetchThreads,
    startNewThread,
    renameThread: renameIntelligenceThread,
    archiveThread: archiveIntelligenceThread,
    deleteThread: deleteIntelligenceThread,
  } = useCopilotThreads({
    agentId,
    enabled,
  });

  const persistedThreads = useMemo(
    () =>
      intelligenceThreads.map((thread) =>
        mapIntelligenceThreadToThread(thread, agentId),
      ),
    [agentId, intelligenceThreads],
  );

  const threads = useMemo(() => {
    const persistedIds = new Set(
      persistedThreads.map((thread) => thread.id),
    );

    // Optimistic row for the active draft until Intelligence returns it.
    if (
      activeThreadId &&
      draftThreadIds[activeThreadId] &&
      !persistedIds.has(activeThreadId)
    ) {
      return [
        createDraftThreadItem(activeThreadId, agentId),
        ...persistedThreads,
      ];
    }

    return persistedThreads;
  }, [activeThreadId, agentId, draftThreadIds, persistedThreads]);

  const threadGroups = useMemo(
    () => groupThreadsByDate(threads),
    [threads],
  );

  // Initial fetch only — background refetch must not flash "Loading threads..."
  useEffect(() => {
    if (!enabled) {
      hasLoadedOnceRef.current = false;
      return;
    }

    if (!isLoading) {
      hasLoadedOnceRef.current = true;
    }
  }, [enabled, isLoading]);

  const isInitialLoading = Boolean(enabled && isLoading && !hasLoadedOnceRef.current);

  // Mirror load settlement into ThreadStore so bootstrap waits correctly.
  // Sync persisted rows so draft flags clear once Intelligence knows the thread.
  useEffect(() => {
    if (!enabled) {
      setThreadsFetched(false);
      setThreadsError(null);
      return;
    }

    if (isLoading) {
      setThreadsFetched(false);
      return;
    }

    setPersistedThreads(persistedThreads);
    setThreadsFetched(true);
    setThreadsError(error);
  }, [
    enabled,
    error,
    isLoading,
    persistedThreads,
    setPersistedThreads,
    setThreadsError,
    setThreadsFetched,
  ]);

  const renameThread = async (threadId: string, name: string) => {
    await renameIntelligenceThread(threadId, name);
  };

  const archiveThread = async (threadId: string) => {
    await archiveIntelligenceThread(threadId);
    deleteThreadLocal(threadId);
  };

  const deleteThreadRemote = async (threadId: string) => {
    await deleteIntelligenceThread(threadId);
    deleteThreadLocal(threadId);
  };

  const persistThread = () => {
    void refetchThreads();
  };

  return {
    threads,
    threadGroups,
    isLoading: isInitialLoading,
    threadsFetched: enabled ? !isLoading : false,
    error,
    refetchThreads,
    startNewThread,
    renameThread,
    archiveThread,
    deleteThread: deleteThreadRemote,
    persistThread,
  };
};
