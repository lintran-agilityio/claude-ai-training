import { create } from "zustand";

/**
 * Outbound message queue and guest-facing chat action errors.
 * activeThreadId lives in features/chatbot/threads/store/thread-store.
 */
interface ChatStore {
  pendingOutboundMessages: Record<string, string | undefined>;
  actionError: string | null;
  /** True when the current `actionError` clears by re-running the agent (Retry). */
  actionErrorRetriable: boolean;
  setPendingOutboundMessage: (scopeKey: string, message: string) => void;
  clearPendingOutboundMessage: (scopeKey: string) => void;
  consumePendingOutboundMessage: (scopeKey: string) => string | undefined;
  setActionError: (message: string, options?: { retriable?: boolean }) => void;
  clearActionError: () => void;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  pendingOutboundMessages: {},
  actionError: null,
  actionErrorRetriable: false,
  setPendingOutboundMessage: (scopeKey, message) =>
    set((state) => ({
      pendingOutboundMessages: {
        ...state.pendingOutboundMessages,
        [scopeKey]: message,
      },
    })),
  clearPendingOutboundMessage: (scopeKey) =>
    set((state) => {
      if (!(scopeKey in state.pendingOutboundMessages)) {
        return state;
      }

      const pendingOutboundMessages = { ...state.pendingOutboundMessages };
      delete pendingOutboundMessages[scopeKey];

      return { pendingOutboundMessages };
    }),
  consumePendingOutboundMessage: (scopeKey) => {
    const message = get().pendingOutboundMessages[scopeKey];
    if (!message) {
      return undefined;
    }

    set((state) => {
      const pendingOutboundMessages = { ...state.pendingOutboundMessages };
      delete pendingOutboundMessages[scopeKey];

      return { pendingOutboundMessages };
    });

    return message;
  },
  setActionError: (message, options) =>
    set({
      actionError: message,
      actionErrorRetriable: options?.retriable ?? false,
    }),
  clearActionError: () =>
    set({ actionError: null, actionErrorRetriable: false }),
}));
