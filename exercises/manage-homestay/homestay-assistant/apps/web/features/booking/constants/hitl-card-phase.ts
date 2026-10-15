import { MODEL_NAME } from "@repo/types";
/**
 * Shared HITL confirm-card UI phase model.
 * Used by create / cancel / modify same-card flows:
 * review → submitting → success | failed | cancelled | expired
 */
export const HITL_CARD_PHASE = {
  REVIEW: "review",
  SUBMITTING: "submitting",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;

export type HitlCardPhase =
  (typeof HITL_CARD_PHASE)[keyof typeof HITL_CARD_PHASE];

/**
 * Mutation outcome phases published onto the HITL card store
 * (create_booking / cancel_booking / update_booking).
 */
export const BOOKING_MUTATION_PHASE = {
  SUBMITTING: "submitting",
  SUCCESS: "success",
  FAILED: "failed",
} as const;

export type BookingMutationPhase =
  (typeof BOOKING_MUTATION_PHASE)[keyof typeof BOOKING_MUTATION_PHASE];

export const BOOKINGS_PAGE_PATH = "/bookings";

export const getRetryMessage = (model: MODEL_NAME) => `Retry ${model} this booking.`;
export const getFailureMessage = (model: MODEL_NAME) => `Something went wrong while ${model} your booking.`;