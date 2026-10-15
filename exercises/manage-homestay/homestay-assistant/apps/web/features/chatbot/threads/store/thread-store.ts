import { create } from "zustand";

import type { Thread, ThreadLoadingState } from "@/features/chatbot/threads/types";
import { dedupeThreadsById } from "@/features/chatbot/threads/utils";
import { generateId } from "@/utils";

/**
 * Single source of truth for threads.
 *
 * activeThreadId (per scope) drives BOTH:
 * - Thread sidebar highlight
 * - CopilotChat / AG-UI / Mastra threadId
 *
 * Draft threads exist only as activeThreadId until the first message
 * is persisted by CopilotKit Intelligence, then they appear in threads[].
 */
type ThreadStoreState = {
  threads: Thread[];
  threadsLoading: boolean;
  /**
   * True only after Intelligence thread list settles for the current scope.
   * Prevents bootstrap from minting a draft while threads are still [].
   */
  threadsFetched: boolean;
  threadsError: Error | null;

  /** scopeKey → active thread id */
  activeThreadIds: Record<string, string | undefined>;
  /** Client-created ids not yet persisted by Intelligence */
  draftThreadIds: Record<string, true>;

  /** Chat session for the active thread */
  loadingState: ThreadLoadingState;
  loadError: string | null;
  reloadToken: number;

  createDraftThread: (scopeKey: string) => string;
  activateThread: (scopeKey: string, threadId: string) => void;
  persistThread: (thread: Thread) => void;
  setPersistedThreads: (threads: Thread[]) => void;
  deleteThread: (threadId: string) => void;

  setThreadsLoading: (threadsLoading: boolean) => void;
  setThreadsFetched: (threadsFetched: boolean) => void;
  setThreadsError: (threadsError: Error | null) => void;
  setLoadingState: (loadingState: ThreadLoadingState) => void;
  setLoadError: (loadError: string | null) => void;
  requestReload: () => void;
  isDraftThread: (threadId: string) => boolean;
  getActiveThreadId: (scopeKey: string | null | undefined) => string | null;
};

export const useThreadStore = create<ThreadStoreState>()((set, get) => ({
  threads: [],
  threadsLoading: false,
  threadsFetched: false,
  threadsError: null,

  activeThreadIds: {},
  draftThreadIds: {},

  loadingState: "idle",
  loadError: null,
  reloadToken: 0,

  createDraftThread: (scopeKey) => {
    const threadId = generateId();

    set((state) => ({
      activeThreadIds: {
        ...state.activeThreadIds,
        [scopeKey]: threadId,
      },
      draftThreadIds: {
        ...state.draftThreadIds,
        [threadId]: true,
      },
      loadingState: "loaded",
      loadError: null,
    }));

    return threadId;
  },

  activateThread: (scopeKey, threadId) => {
    set((state) => ({
      activeThreadIds: {
        ...state.activeThreadIds,
        [scopeKey]: threadId,
      },
      // Intelligence connect/replay hydrates messages; no manual fetch wait.
      loadingState: "loaded",
      loadError: null,
    }));
  },

  persistThread: (thread) => {
    set((state) => {
      const draftThreadIds = { ...state.draftThreadIds };
      delete draftThreadIds[thread.id];

      const withoutId = state.threads.filter(
        (current) => current.id !== thread.id,
      );

      return {
        draftThreadIds,
        threads: dedupeThreadsById([thread, ...withoutId]),
      };
    });
  },

  setPersistedThreads: (threads) => {
    const unique = dedupeThreadsById(threads);

    set((state) => {
      const draftThreadIds = { ...state.draftThreadIds };

      for (const thread of unique) {
        delete draftThreadIds[thread.id];
      }

      return {
        threads: unique,
        draftThreadIds,
        threadsError: null,
      };
    });
  },

  deleteThread: (threadId) => {
    set((state) => {
      const draftThreadIds = { ...state.draftThreadIds };
      delete draftThreadIds[threadId];

      return {
        threads: state.threads.filter((thread) => thread.id !== threadId),
        draftThreadIds,
      };
    });
  },

  setThreadsLoading: (threadsLoading) => set({ threadsLoading }),

  setThreadsFetched: (threadsFetched) => set({ threadsFetched }),

  setThreadsError: (threadsError) => set({ threadsError }),

  setLoadingState: (loadingState) =>
    set({
      loadingState,
      ...(loadingState !== "error" ? { loadError: null } : {}),
    }),

  setLoadError: (loadError) =>
    set({
      loadError,
      loadingState: loadError ? "error" : "idle",
    }),

  requestReload: () =>
    set((state) => ({
      reloadToken: state.reloadToken + 1,
      loadError: null,
      loadingState: "loading",
    })),

  isDraftThread: (threadId) => Boolean(get().draftThreadIds[threadId]),

  getActiveThreadId: (scopeKey) => {
    if (!scopeKey) {
      return null;
    }

    return get().activeThreadIds[scopeKey] ?? null;
  },
}));
