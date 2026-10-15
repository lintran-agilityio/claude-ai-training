import type { CancellationBookingSummary } from "@repo/types";
import { z } from "zod";

/**
 * Booking summary for cancel HITL — shared by Mastra cancellation schema and
 * FE confirm_cancel / show_cancel_dialog_confirm params.
 */
export const confirmCancelBookingSchema = z.object({
  bookingId: z.string().describe("Booking ID to cancel"),
  roomId: z.string().describe("Room ID associated with the booking"),
  roomName: z.string().describe("Room display name"),
  checkInDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
  checkOutDate: z.string().describe("Check-out date (YYYY-MM-DD)"),
  guests: z.number().describe("Number of guests"),
  totalPrice: z.number().describe("Total price in VND"),
}) satisfies z.ZodType<CancellationBookingSummary>;

export type ConfirmCancelBookingArgs = z.infer<
  typeof confirmCancelBookingSchema
>;

export type ConfirmCancelBookingResult =
  | { confirmed: false }
  | { confirmed: true; bookingId: string };

/** Alias used by Mastra cancel tool schemas. */
export const cancellationBookingSchema = confirmCancelBookingSchema;

/** HITL show_cancel_dialog_confirm params. */
export const cancelBookingByRoomSchema = z.object({
  bookings: z
    .array(confirmCancelBookingSchema)
    .describe(
      "Matching bookings from find_booking_by_id (length 1) or multi-match get_bookings — map get_bookings.id → bookingId and include totalPrice. Only call when length > 0. When length > 1 the UI shows a selectable list.",
    ),
  queryName: z
    .string()
    .describe(
      "Room display name from find_booking_by_id, or a date cue / \"your bookings\" when disambiguating multiple get_bookings matches",
    ),
});

export type CancelBookingByRoomArgs = z.infer<typeof cancelBookingByRoomSchema>;

export type CancelBookingByRoomResult =
  | {
      confirmed: false;
      reason?: "declined" | "not_found";
    }
  | { confirmed: true; bookingId: string; roomName: string };
