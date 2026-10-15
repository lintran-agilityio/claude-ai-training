import { roomSchema } from "./room.js";
import { z } from "zod";

/** HITL confirm_modify_booking params — shared by FE useHumanInTheLoop. */
export const confirmModifyBookingSchema = z.object({
  bookingId: z
    .string()
    .describe("Booking ID being modified — never a roomId"),
  room: roomSchema.describe(
    "Full room object — from find_booking_by_id.result.room",
  ),
  checkInDate: z
    .string()
    .describe(
      "Updated check-in (YYYY-MM-DD): from edit_modify_booking confirmed:true (form path), or find_booking_by_id.result.availability.checkInDate (stated-change path — the merged stay it probed). Not the original booking.",
    ),
  checkOutDate: z
    .string()
    .describe(
      "Updated check-out (YYYY-MM-DD): from edit_modify_booking confirmed:true (form path), or find_booking_by_id.result.availability.checkOutDate (stated-change path). Not the original booking.",
    ),
  guests: z
    .number()
    .describe(
      "Updated guests: from edit_modify_booking confirmed:true (form path), or find_booking_by_id.result.availability.guests (stated-change path).",
    ),
  originalCheckInDate: z
    .string()
    .optional()
    .describe(
      "Pre-change check-in of the current booking — from edit_modify_booking tool-call args (form path) or find_booking_by_id.result.bookings[0].checkInDate (stated-change path). For UI before→after diffs only.",
    ),
  originalCheckOutDate: z
    .string()
    .optional()
    .describe(
      "Pre-change check-out of the current booking — from edit_modify_booking tool-call args (form path) or find_booking_by_id.result.bookings[0].checkOutDate (stated-change path). For UI before→after diffs only.",
    ),
  originalGuests: z
    .number()
    .optional()
    .describe(
      "Pre-change guests of the current booking — from edit_modify_booking tool-call args (form path) or find_booking_by_id.result.bookings[0].guests (stated-change path). For UI before→after diffs only.",
    ),
});

export type ConfirmModifyBookingArgs = z.infer<
  typeof confirmModifyBookingSchema
>;

export type ConfirmModifyBookingResult =
  | { confirmed: false }
  | {
      confirmed: true;
      bookingId: string;
      checkInDate: string;
      checkOutDate: string;
      guests: number;
    };
