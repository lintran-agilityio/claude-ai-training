import { z } from "zod";

export const cancelBookingInputSchema = z.object({
  bookingId: z.string().describe("Booking ID to cancel"),
});

export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;
