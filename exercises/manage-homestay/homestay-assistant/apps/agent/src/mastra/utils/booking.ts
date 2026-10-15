import z from "zod";
import type { RequestContext } from "@mastra/core/request-context";

import { BookingStatus } from "@repo/types";
import { createBookingInputSchema } from "@repo/schemas";
import { takePinnedStay } from "@/mastra/utils/resolve-pinned-stay";
import { REQUEST_CONTEXT_KEYS } from "@/mastra/middleware/constants";

type CreateBookingInput = z.input<typeof createBookingInputSchema>;

type CreateBookingCommand = {
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  status: BookingStatus;
};

/**
 * Resolve the authoritative booking input.
 *
 * When a confirmed stay is pinned in request context, prefer it over
 * model-provided arguments so stale LLM arguments cannot override the
 * guest-confirmed stay.
 */
export const resolveCreateBookingInput = (
  input: CreateBookingInput,
  requestContext?: RequestContext,
): CreateBookingInput => {
  const pinned = takePinnedStay(
    requestContext,
    REQUEST_CONTEXT_KEYS.PENDING_CREATE_STAY,
  );

  if (!pinned) {
    return input;
  }

  return {
    ...input,
    roomId: pinned.roomId ?? input.roomId,
    checkInDate: pinned.checkInDate,
    checkOutDate: pinned.checkOutDate,
    guests: pinned.guests,
  };
};

export const buildCreateBookingCommand = (
  input: CreateBookingInput,
): CreateBookingCommand => ({
  roomId: input.roomId,
  checkInDate: input.checkInDate,
  checkOutDate: input.checkOutDate,
  guests: input.guests,
  status: BookingStatus.CONFIRMED,
});
