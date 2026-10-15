import { z } from "zod";

import { bookingSchema } from "./booking.schema";

export const bookingResolutionSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("not_found"),
    bookings: z.tuple([]),
  }),
  z.object({
    status: z.literal("resolved"),
    booking: bookingSchema,
  }),
  z.object({
    status: z.literal("ambiguous"),
    bookings: z.array(bookingSchema).min(2),
  }),
]);

export type BookingResolution = z.infer<typeof bookingResolutionSchema>;
