import { create } from "zustand";

import {
  BOOKING_MUTATION_PHASE,
  type BookingMutationPhase,
} from "@/features/booking/constants";

export type CreateBookingCardOutcome = {
  correlationKey: string;
  phase: BookingMutationPhase;
  bookingId?: string;
  totalPrice?: number;
  errorMessage?: string;
};

type CreateBookingCardStore = {
  outcomesByCorrelationKey: Record<string, CreateBookingCardOutcome>;
  /** Correlation key of the most recently confirmed create HITL awaiting create_booking. */
  latestPendingCorrelationKey: string | null;
  markSubmitting: (correlationKey: string) => void;
  markSuccess: (
    correlationKey: string,
    data: { bookingId: string; totalPrice?: number },
  ) => void;
  markFailed: (correlationKey: string, errorMessage: string) => void;
  /**
   * Resolve which outcome slot to update for a create_booking result.
   * Preferred: exact correlation key. Fallback: latest pending create card.
   */
  resolveTargetCorrelationKey: (
    correlationKey: string | null,
  ) => string | null;
  getOutcome: (
    correlationKey: string | null,
  ) => CreateBookingCardOutcome | null;
};

export const useCreateBookingCardStore = create<CreateBookingCardStore>()(
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
            totalPrice: data.totalPrice,
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
