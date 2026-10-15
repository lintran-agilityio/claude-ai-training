import { create } from "zustand";

import type {
  BookingDraft,
  PendingModifyStay,
} from "@/features/booking/types/booking";
import type { Room } from "@/features/room/types/room";
import { useHomestayAgentUiStore } from "@/features/chatbot/stores/homestay-agent-ui-store";

export interface BookingStore extends BookingDraft {
  /**
   * Stay the guest confirmed in an edit_modify_booking form, keyed by that
   * form's toolCallId — the confirm_modify_booking card of the SAME episode
   * reads it (see selectModifyEpisode). One slot per form, never cleared: a
   * single shared slot was overwritten by the next modify, and clearing it on
   * success blanked the card that had just succeeded. Stale entries are inert
   * because no other card's episode holds their toolCallId.
   */
  pendingModifyStays: Record<string, PendingModifyStay>;
  /**
   * Full room the guest is booking, stashed by the Booking Form when it emits
   * `[book-stay]`. `confirm_booking` args carry only `roomId`, so the confirm
   * card reads room name/price/capacity from here (see useConfirmBookingRoom).
   */
  bookingRoom: Room | null;
  updateBookingDraft: (input: Partial<BookingDraft>) => void;
  stashPendingModifyStay: (
    editToolCallId: string,
    stay: PendingModifyStay,
  ) => void;
  setBookingRoom: (room: Room | null) => void;
  resetBooking: () => void;
}

const DEFAULT_DRAFT: BookingDraft = {
  roomId: null,
  checkInDate: null,
  checkOutDate: null,
  guests: 1,
};

export const useBookingStore = create<BookingStore>()((set) => ({
  ...DEFAULT_DRAFT,
  pendingModifyStays: {},
  bookingRoom: null,

  updateBookingDraft: (input) =>
    set((state) => {
      const next = { ...state, ...input };
      if (
        next.roomId === state.roomId &&
        next.checkInDate === state.checkInDate &&
        next.checkOutDate === state.checkOutDate &&
        next.guests === state.guests
      ) {
        return state;
      }
      return next;
    }),

  stashPendingModifyStay: (editToolCallId, stay) =>
    set((state) => ({
      pendingModifyStays: {
        ...state.pendingModifyStays,
        [editToolCallId]: stay,
      },
    })),

  setBookingRoom: (room) => set({ bookingRoom: room }),

  resetBooking: () => {
    useHomestayAgentUiStore.getState().resetUiFocus();
    set((state) => ({
      ...state,
      ...DEFAULT_DRAFT,
      bookingRoom: null,
    }));
  },
}));
