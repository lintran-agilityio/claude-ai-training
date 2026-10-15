import { z } from "zod";
import { getBookingsInputSchema } from "@repo/schemas";

import { bookingSchema } from "./booking.schema";

export const getBookingsOutputSchema = z.object({
  bookings: z.array(bookingSchema),
  /** Echoed from input — FE uses this to skip the booking-list card on purpose:"resolve". */
  purpose: getBookingsInputSchema.shape.purpose,
});

export type GetBookingsOutput = z.infer<typeof getBookingsOutputSchema>;
