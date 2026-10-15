import { z } from "zod";

import { roomSchema } from "./room.js";
import { confirmCancelBookingSchema } from "./confirm-cancel-booking.js";
import { RESOLVE_BOOKING_TARGET_PURPOSE_VALUES } from "@repo/constants";

/**
 * RESOLVE primitive for MODIFY/CANCEL. Resolves a booking by id or by room
 * name among the guest's active bookings, suspending via useInterrupt on an
 * ambiguous match; for purpose:"modify" also suspends for stay-change input
 * when none was stated. Replaces find_bookings + find_booking_by_id +
 * get_bookings(resolve) + show_modify_dialog_select.
 */
export const resolveBookingTargetInputSchema = z.object({
  purpose: z.enum(RESOLVE_BOOKING_TARGET_PURPOSE_VALUES),
  bookingId: z
    .string()
    .optional()
    .describe(
      "Booking ID stated by the guest or carried from a [booking-cancel]/[booking-modify] trigger. Skips room-name resolution.",
    ),
  roomName: z
    .string()
    .optional()
    .describe(
      "Room name to resolve the target booking among the guest's active bookings — used when bookingId is not known.",
    ),
  requestedCheckInDate: z
    .string()
    .optional()
    .describe(
      "NEW check-in (YYYY-MM-DD) the guest explicitly stated in the LATEST message. Modify only.",
    ),
  requestedCheckOutDate: z
    .string()
    .optional()
    .describe(
      "NEW check-out (YYYY-MM-DD) the guest explicitly stated, including a computed date from a stated night/day extend or shorten. Modify only.",
    ),
  requestedGuests: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("NEW guest count the guest explicitly stated. Modify only."),
});

export type ResolveBookingTargetInput = z.infer<
  typeof resolveBookingTargetInputSchema
>;

export const resolveBookingTargetSuspendSchema = z.discriminatedUnion(
  "reason",
  [
    z.object({
      reason: z.literal("ambiguous_booking"),
      bookings: z.array(confirmCancelBookingSchema).min(2),
    }),
    z.object({
      reason: z.literal("need_stay_change"),
      booking: confirmCancelBookingSchema,
      room: roomSchema,
    }),
  ],
);

export type ResolveBookingTargetSuspend = z.infer<
  typeof resolveBookingTargetSuspendSchema
>;

export const resolveBookingTargetResumeSchema = z.object({
  bookingId: z.string().optional(),
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  guests: z.number().int().positive().optional(),
});

export type ResolveBookingTargetResume = z.infer<
  typeof resolveBookingTargetResumeSchema
>;

export const resolveBookingTargetOutputSchema = z.discriminatedUnion(
  "status",
  [
    z.object({ status: z.literal("not_found") }),
    z.object({ status: z.literal("not_modifiable") }),
    z.object({
      status: z.literal("target_resolved"),
      booking: confirmCancelBookingSchema,
    }),
    z.object({
      status: z.literal("resolved"),
      booking: confirmCancelBookingSchema,
      room: roomSchema,
      newCheckInDate: z.string().optional(),
      newCheckOutDate: z.string().optional(),
      newGuests: z.number().optional(),
    }),
  ],
);

export type ResolveBookingTargetOutput = z.infer<
  typeof resolveBookingTargetOutputSchema
>;
