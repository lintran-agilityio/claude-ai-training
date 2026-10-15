import { z } from "zod";

import { confirmCancelBookingSchema } from "./confirm-cancel-booking.js";

/**
 * Booking row for modify multi-match HITL — same shape as cancel picker rows
 * so get_bookings can map id → bookingId + totalPrice without inventing fields.
 */
export const modifyBookingPickerItemSchema = confirmCancelBookingSchema;

export type ModifyBookingPickerItem = z.infer<
  typeof modifyBookingPickerItemSchema
>;

/**
 * HITL show_modify_dialog_select params.
 *
 * Prefer `bookingIds` (small JSON — avoids truncated tool-arg streams).
 * The FE hydrates rows from the latest get_bookings result in the turn.
 * `bookings` remains supported when the model still sends full rows.
 */
export const modifyBookingByRoomSchema = z.object({
  bookingIds: z
    .array(z.string())
    .optional()
    .describe(
      "Preferred: ALL matching get_bookings ids only (no other fields). FE hydrates display rows from that get_bookings result. Prefer this over bookings[] to keep tool args small.",
    ),
  bookings: z
    .array(modifyBookingPickerItemSchema)
    .optional()
    .describe(
      "Optional full rows when bookingIds is omitted — map get_bookings.id → bookingId and include totalPrice. Prefer bookingIds instead.",
    ),
  queryName: z
    .string()
    .describe(
      "Room display name, date cue, or \"your bookings\" when disambiguating multiple get_bookings matches for modify",
    ),
  requestedCheckInDate: z
    .string()
    .optional()
    .describe(
      "The NEW check-in (YYYY-MM-DD) the guest explicitly stated in the LATEST message, same extraction rule as find_booking_by_id's field of the same name. Pass it here too (not only later on find_booking_by_id) — the app carries it across the picker so the guest doesn't have to restate it after choosing a booking. Omit entirely if no new check-in was stated.",
    ),
  requestedCheckOutDate: z
    .string()
    .optional()
    .describe(
      "The NEW check-out (YYYY-MM-DD) the guest explicitly stated as an ABSOLUTE date in the LATEST message, same extraction rule as find_booking_by_id's field of the same name. For a RELATIVE extend/shorten use requestedCheckOutDeltaDays. Pass it here too — the app carries it across the picker. Omit entirely if no new check-out was stated.",
    ),
  requestedCheckOutDeltaDays: z
    .number()
    .int()
    .optional()
    .describe(
      "The guest's stated RELATIVE check-out change as a whole number of nights/days (positive to extend, negative to shorten, 0 = explicit no-op), same meaning as find_booking_by_id's field of the same name. Pass it here too (and do NOT also send requestedCheckOutDate) — the app carries it across the picker and applies it against the check-out of the booking the guest ultimately selects (never computed before the pick, and authoritative over any requestedCheckOutDate). Omit entirely if the guest gave an absolute date or no check-out change.",
    ),
  requestedGuests: z
    .number()
    .optional()
    .describe(
      "The NEW guest count the guest explicitly stated in the LATEST message, same extraction rule as find_booking_by_id's field of the same name. Pass it here too — the app carries it across the picker. Omit entirely if no new guest count was stated.",
    ),
});

export type ModifyBookingByRoomArgs = z.infer<typeof modifyBookingByRoomSchema>;

export type ModifyBookingByRoomResult =
  | {
      confirmed: false;
      reason?: "declined" | "not_found";
    }
  | { confirmed: true; bookingId: string; roomName: string };
