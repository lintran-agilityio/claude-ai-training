import { roomSchema } from "./room.js";
import { z } from "zod";

/** HITL edit_modify_booking params — shared by FE useHumanInTheLoop. */
export const editModifyBookingSchema = z.object({
  bookingId: z
    .string()
    .describe("Booking ID being modified — never a roomId"),
  room: roomSchema.describe(
    "Full room from find_booking_by_id.result.room — do not call get_room_by_id",
  ),
  checkInDate: z
    .string()
    .describe("Current check-in date (YYYY-MM-DD) from the booking"),
  checkOutDate: z
    .string()
    .describe("Current check-out date (YYYY-MM-DD) from the booking"),
  guests: z.number().describe("Current guest count from the booking"),
});

export type EditModifyBookingArgs = z.infer<typeof editModifyBookingSchema>;

export type EditModifyBookingResult =
  | { confirmed: false }
  | {
      confirmed: true;
      bookingId: string;
      roomId: string;
      checkInDate: string;
      checkOutDate: string;
      guests: number;
    };
