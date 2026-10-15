import { create } from "zustand";

import {
  BOOKING_MUTATION_PHASE,
  type BookingMutationPhase,
} from "@/features/booking/constants";

export type CancelBookingCardOutcome = {
  correlationKey: string;
  phase: BookingMutationPhase;
  bookingId?: string;
  errorMessage?: string;
};

type CancelBookingCardStore = {
  outcomesByCorrelationKey: Record<string, CancelBookingCardOutcome>;
  /** Correlation key of the most recently confirmed cancel HITL awaiting cancel_booking. */
  latestPendingCorrelationKey: string | null;
  markSubmitting: (correlationKey: string) => void;
  markSuccess: (correlationKey: string, data: { bookingId: string }) => void;
  markFailed: (correlationKey: string, errorMessage: string) => void;
  /**
   * Resolve which outcome slot to update for a cancel_booking result.
   * Preferred: exact correlation key. Fallback: latest pending cancel card.
   */
  resolveTargetCorrelationKey: (
    correlationKey: string | null,
  ) => string | null;
  getOutcome: (
    correlationKey: string | null,
  ) => CancelBookingCardOutcome | null;
};

export const useCancelBookingCardStore = create<CancelBookingCardStore>()(
  (set, get) => ({
    outcomesByCorrelationKey: {},
    latestPendingCorrelationKey: null,

    markSubmitting: (correlationKey) =>
      set((state) => ({
        latestPendingCorrelationKey: correlationKey,
        outcomesByCorrelationKey: {
          ...state.outcomesByCorrelationKey,
          [correlationKey]: {
            correlationKey,
            phase: BOOKING_MUTATION_PHASE.SUBMITTING,
          },
        },
      })),

    markSuccess: (correlationKey, data) =>
      set((state) => ({
        latestPendingCorrelationKey:
          state.latestPendingCorrelationKey === correlationKey
            ? null
            : state.latestPendingCorrelationKey,
        outcomesByCorrelationKey: {
          ...state.outcomesByCorrelationKey,
          [correlationKey]: {
            correlationKey,
            phase: BOOKING_MUTATION_PHASE.SUCCESS,
            bookingId: data.bookingId,
          },
        },
      })),

    markFailed: (correlationKey, errorMessage) =>
      set((state) => ({
        latestPendingCorrelationKey:
          state.latestPendingCorrelationKey === correlationKey
            ? null
            : state.latestPendingCorrelationKey,
        outcomesByCorrelationKey: {
          ...state.outcomesByCorrelationKey,
          [correlationKey]: {
            correlationKey,
            phase: BOOKING_MUTATION_PHASE.FAILED,
            errorMessage,
          },
        },
      })),

    resolveTargetCorrelationKey: (correlationKey) => {
      const { outcomesByCorrelationKey, latestPendingCorrelationKey } = get();

      if (correlationKey && outcomesByCorrelationKey[correlationKey]) {
        return correlationKey;
      }

      if (
        latestPendingCorrelationKey &&
        outcomesByCorrelationKey[latestPendingCorrelationKey]
      ) {
        return latestPendingCorrelationKey;
      }

      return correlationKey ?? latestPendingCorrelationKey;
    },

    getOutcome: (correlationKey) => {
      if (!correlationKey) {
        return null;
      }

      return get().outcomesByCorrelationKey[correlationKey] ?? null;
    },
  }),
);
