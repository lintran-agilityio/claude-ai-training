import { create } from "zustand";

import type {
  HomestayAgentFocusType,
  HomestayAgentTaskStatus,
  HomestayAgentTaskType,
} from "@/features/chatbot/types";

/**
 * UI focus stack entry — drives suggestion pills / HomestayAgentContext only.
 * Not booking orchestration authority (that is the Mastra step machine).
 */
export type HomestayAgentUiFocusEntry = {
  key: string;
  task: {
    type: HomestayAgentTaskType;
    status: HomestayAgentTaskStatus;
  };
  focus?: {
    type: HomestayAgentFocusType;
    id: string;
  };
};

/** @deprecated Prefer `HomestayAgentUiFocusEntry`. */
export type HomestayAgentWorkflowEntry = HomestayAgentUiFocusEntry;

type HomestayAgentUiStore = {
  /** LIFO stack of room ids from mounted detail UI (supports multiple chat cards). */
  focusedRoomStack: string[];
  /** Canonical UI focus stack (suggestion pills / agent context). */
  uiFocusEntries: HomestayAgentUiFocusEntry[];
  /**
   * @deprecated Prefer `uiFocusEntries` — kept in sync for one release.
   */
  workflowEntries: HomestayAgentUiFocusEntry[];
  /** Transient: set after create_booking succeeds; cleared on the next agent run. */
  bookingJustCompleted: boolean;
  pushFocusedRoom: (roomId: string) => void;
  popFocusedRoom: (roomId: string) => void;
  pushUiFocus: (entry: HomestayAgentUiFocusEntry) => void;
  popUiFocus: (key: string) => void;
  resetUiFocus: () => void;
  /** @deprecated Prefer `pushUiFocus`. */
  pushWorkflow: (entry: HomestayAgentUiFocusEntry) => void;
  /** @deprecated Prefer `popUiFocus`. */
  popWorkflow: (key: string) => void;
  /** @deprecated Prefer `resetUiFocus`. */
  resetWorkflow: () => void;
  setBookingJustCompleted: (value: boolean) => void;
  reset: () => void;
};

const emptyFocusEntries = [] as HomestayAgentUiFocusEntry[];

const initialState = {
  focusedRoomStack: [] as string[],
  uiFocusEntries: emptyFocusEntries,
  workflowEntries: emptyFocusEntries,
  bookingJustCompleted: false,
};

const withFocusEntries = (entries: HomestayAgentUiFocusEntry[]) => ({
  uiFocusEntries: entries,
  workflowEntries: entries,
});

export const selectFocusedRoomId = (
  stack: string[],
): string | null => stack.at(-1) ?? null;

export const selectActiveHomestayUiFocus = (
  entries: HomestayAgentUiFocusEntry[],
): HomestayAgentUiFocusEntry | null => entries.at(-1) ?? null;

/** @deprecated Prefer `selectActiveHomestayUiFocus`. */
export const selectActiveHomestayWorkflow = selectActiveHomestayUiFocus;

export const useHomestayAgentUiStore = create<HomestayAgentUiStore>()(
  (set) => {
    const pushUiFocus = (entry: HomestayAgentUiFocusEntry) =>
      set((state) =>
        withFocusEntries([
          ...state.uiFocusEntries.filter((item) => item.key !== entry.key),
          entry,
        ]),
      );

    const popUiFocus = (key: string) =>
      set((state) =>
        withFocusEntries(
          state.uiFocusEntries.filter((item) => item.key !== key),
        ),
      );

    const resetUiFocus = () => set(withFocusEntries([]));

    return {
      ...initialState,

      pushFocusedRoom: (roomId) =>
        set((state) => ({
          focusedRoomStack: [...state.focusedRoomStack, roomId],
        })),

      popFocusedRoom: (roomId) =>
        set((state) => {
          const stack = [...state.focusedRoomStack];
          const index = stack.lastIndexOf(roomId);
          if (index === -1) {
            return state;
          }
          stack.splice(index, 1);
          return { focusedRoomStack: stack };
        }),

      pushUiFocus,
      popUiFocus,
      resetUiFocus,
      pushWorkflow: pushUiFocus,
      popWorkflow: popUiFocus,
      resetWorkflow: resetUiFocus,

      setBookingJustCompleted: (value) => set({ bookingJustCompleted: value }),

      reset: () => set(initialState),
    };
  },
);
