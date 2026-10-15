import { create } from "zustand";

import {
  BOOKING_MUTATION_PHASE,
  type BookingMutationPhase,
} from "@/features/booking/constants";

export type ModifyBookingCardOutcome = {
  phase: BookingMutationPhase;
  bookingId?: string;
  errorMessage?: string;
};

/**
 * Optimistic phase per `confirm_modify_booking` card, keyed by the card's OWN
 * toolCallId. Settled outcomes are not stored here — each card reads them from
 * the `update_booking` attempt in its own episode (see selectModifyEpisode).
 *
 * Never key this by stay (bookingId|dates|guests): two cards can resolve to the
 * same stay, and a shared slot made confirming booking B flip the settled
 * booking-A card back to "Updating booking…".
 */
type ModifyBookingCardStore = {
  outcomesByCardId: Record<string, ModifyBookingCardOutcome>;
  /** Hold the card's spinner from its Confirm/Retry click until update_booking streams. */
  markSubmitting: (cardId: string) => void;
};

export const useModifyBookingCardStore = create<ModifyBookingCardStore>()(
  (set) => ({
    outcomesByCardId: {},

    markSubmitting: (cardId) =>
      set((state) => ({
        outcomesByCardId: {
          ...state.outcomesByCardId,
          [cardId]: { phase: BOOKING_MUTATION_PHASE.SUBMITTING },
        },
      })),
  }),
);
