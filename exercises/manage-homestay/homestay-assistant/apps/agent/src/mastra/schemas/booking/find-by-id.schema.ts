import { z } from "zod";
import { roomSchema } from "@repo/schemas";
import { FIND_BOOKING_BY_ID_PURPOSE_VALUES } from "@repo/constants";

import { cancellationBookingSchema } from "./cancel.schema";

/**
 * Availability probe attached to a `purpose: "modify"` result with exactly one
 * booking — and only when the guest already stated a new date / guest count
 * (the stated-change fast path). `findBookingByIdTool.execute` calls
 * `/bookings/availability` for the booking's room (excluding the booking
 * itself) so the MODIFY flow no longer needs a separate
 * `check_room_availability` tool call. Absent → the probe was skipped (no
 * stated change → edit form opens) or the call failed.
 */
export const findBookingAvailabilitySchema = z.object({
  available: z.boolean(),
  guestsWithinCapacity: z.boolean(),
  /**
   * Whether the merged stay's dates alone are free, independent of guest
   * count — lets a guest already over capacity also learn whether the dates
   * they asked about are taken (see resolveBookingUnavailableReason).
   */
  datesAvailable: z.boolean(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  guests: z.number(),
});

export type FindBookingAvailability = z.infer<
  typeof findBookingAvailabilitySchema
>;

export const findBookingByIdInputSchema = z.object({
  bookingId: z
    .string()
    .describe(
      "Booking ID (UUID) to look up — extract the value after bookingId: in [booking-cancel] / [booking-modify] messages (format: [booking-cancel|booking-modify] bookingId: <uuid>. …) or chat cancel/modify messages. Never pass the room name or roomId.",
    ),
  purpose: z
    .enum(FIND_BOOKING_BY_ID_PURPOSE_VALUES)
    .optional()
    .describe(
      '"cancel" (or omit) allows any active booking, including one already checked in. "modify" additionally requires the stay not to have started yet — a booking whose check-in is today or past comes back as bookings: [] with reason: "not_modifiable" so the edit form is never opened for it.',
    ),
  requestedCheckInDate: z
    .string()
    .optional()
    .describe(
      "MODIFY only. The NEW check-in (YYYY-MM-DD) the guest explicitly stated in the LATEST message. Omit entirely if no new check-in was stated — never invent, infer, reuse an old value, or guess from context. When present (with requestedCheckOutDate and/or requestedGuests), the app skips the edit form, probes availability itself (merging your stated value(s) over the booking's current stay, excluding this booking), and goes straight to confirm_modify_booking — never check_room_availability.",
    ),
  requestedCheckOutDate: z
    .string()
    .optional()
    .describe(
      "MODIFY only. The NEW check-out (YYYY-MM-DD) the guest explicitly stated as an ABSOLUTE date in the LATEST message (\"change checkout to Aug 22\"). For a RELATIVE extend/shorten (\"one more night\", \"extend 2 nights\") use requestedCheckOutDeltaDays instead and leave this unset — do NOT compute the date yourself. Omit entirely if no new check-out was stated — never invent, infer, reuse an old value, or guess from context. If requestedCheckOutDeltaDays is also set, the delta is used and this value is ignored.",
    ),
  requestedCheckOutDeltaDays: z
    .number()
    .int()
    .optional()
    .describe(
      "MODIFY only. The guest's stated RELATIVE check-out change as a whole number of nights/days: positive to extend (\"one more night\" / \"count one more date\" → 1, \"extend 2 nights\" → 2), negative to shorten (\"shorten by one night\" → -1), 0 for an explicit no-op. Pass the stated count as-is and DO NOT also send requestedCheckOutDate — the app computes the resulting check-out from the RESOLVED booking's authoritative current check-out; you never do this arithmetic. When set, this is authoritative over any requestedCheckOutDate. Omit entirely when the guest gave an absolute date (use requestedCheckOutDate) or stated no check-out change.",
    ),
  requestedGuests: z
    .number()
    .optional()
    .describe(
      "MODIFY only. The NEW guest count the guest explicitly stated in the LATEST message. Omit entirely if no new guest count was stated — never invent, infer, reuse an old value, or guess from context.",
    ),
});

export const findBookingByIdOutputSchema = z.object({
  bookings: z
    .array(cancellationBookingSchema)
    .describe(
      "Active booking summary when found (length 1), including bookingId + roomId + current dates/guests. If length 0, reply in chat only — do not open cancel/modify dialogs.",
    ),
  bookingId: z.string().describe("Booking ID that was looked up"),
  queryName: z
    .string()
    .describe(
      "Room display name from the booking — pass as queryName to show_cancel_dialog_confirm when cancelling",
    ),
  room: roomSchema
    .optional()
    .describe(
      "Full room object when booking is found — pass to edit_modify_booking for the modify form. Do not call get_room_by_id in a modify turn.",
    ),
  reason: z
    .enum(["not_modifiable", "lookup_failed"])
    .optional()
    .describe(
      'Only set when bookings is empty. "not_modifiable": purpose was "modify" and the booking exists/is active but its check-in is today or past — reply that the stay has already started and can no longer be modified, and offer to cancel instead. "lookup_failed": the lookup itself failed (network/server error), NOT that the booking does not exist — apologize briefly and ask the guest to try again in a moment; never say the booking was not found or does not exist.',
    ),
  requestedCheckInDate: z
    .string()
    .optional()
    .describe(
      "Echoed back from this call's own requestedCheckInDate, or carried over from an earlier show_modify_dialog_select pick when this call omitted it — the app's routing decision (edit form vs straight to availability) is based on this resolved value, not on what you passed to this specific call.",
    ),
  requestedCheckOutDate: z
    .string()
    .optional()
    .describe(
      "Echoed back from this call's own requestedCheckOutDate, or carried over from an earlier show_modify_dialog_select pick when this call omitted it.",
    ),
  requestedGuests: z
    .number()
    .optional()
    .describe(
      "Echoed back from this call's own requestedGuests, or carried over from an earlier show_modify_dialog_select pick when this call omitted it.",
    ),
  availability: findBookingAvailabilitySchema
    .optional()
    .describe(
      "MODIFY stated-change path only: the availability probe result for the merged stay (booking's current stay + requested* overrides), excluding this booking from overlap detection. Present → the app forces confirm_modify_booking when available:true, or renders BookingUnavailable and stops. Absent → no stated change (edit form opens) or the probe call failed.",
    ),
  stayUnchanged: z
    .boolean()
    .optional()
    .describe(
      "MODIFY stated-change path only: true when the merged stay equals the booking's current stay. The app stops the turn — reply that the booking already has those details; never open confirm_modify_booking.",
    ),
});

export type FindBookingByIdInput = z.infer<typeof findBookingByIdInputSchema>;
export type FindBookingByIdOutput = z.infer<typeof findBookingByIdOutputSchema>;
