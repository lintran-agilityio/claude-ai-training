import { z } from "zod";

export const updateBookingInputSchema = z.object({
  bookingId: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  guests: z.number().int().positive(),
});

export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;
