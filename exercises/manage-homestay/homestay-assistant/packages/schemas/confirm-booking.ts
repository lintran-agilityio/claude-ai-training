import { z } from "zod";

/** HITL confirm_booking params — shared by FE useHumanInTheLoop. */
export const confirmBookingSchema = z.object({
  roomId: z
    .string()
    .describe(
      "Room id — from find_room(book_resolve).rooms[0].id (its availability block carries the dates/guests) or the roomId in a [book-stay] message. The confirm card hydrates the full room on the frontend.",
    ),
  checkInDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
  checkOutDate: z.string().describe("Check-out date (YYYY-MM-DD)"),
  guests: z.number().describe("Number of guests"),
});

export type ConfirmBookingArgs = z.infer<typeof confirmBookingSchema>;

export type ConfirmBookingResult =
  | { confirmed: false }
  | {
      confirmed: true;
      roomId: string;
      checkInDate: string;
      checkOutDate: string;
      guests: number;
    };
