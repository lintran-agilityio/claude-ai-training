import { z } from "zod";

export const calculatePriceInputSchema = z.object({
  roomId: z.string().describe("Room ID to price"),
  checkInDate: z.string().describe("YYYY-MM-DD check-in date"),
  checkOutDate: z.string().describe("YYYY-MM-DD check-out date (after check-in)"),
  guests: z.number().int().positive().describe("Number of guests"),
  purpose: z
    .enum(["quote", "booking"])
    .optional()
    .describe(
      '"booking" when pricing a stay that is about to be confirmed (the app then forces confirm_booking next); omit or "quote" for a plain price question.',
    ),
});

const money = z.number().describe("Amount in VND");

export const calculatePriceOutputSchema = z.object({
  roomId: z.string(),
  roomName: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  guests: z.number(),
  nights: z.number(),
  pricePerNight: money,
  roomSubtotal: money,
  extraGuests: z.number().describe("Guests above the base occupancy"),
  extraGuestSurcharge: money,
  cleaningFee: money,
  taxRate: z.number().describe("Tax rate as a fraction, e.g. 0.08"),
  tax: money,
  total: money,
  currency: z.literal("VND"),
});

export type CalculatePriceInput = z.infer<typeof calculatePriceInputSchema>;
export type CalculatePriceOutput = z.infer<typeof calculatePriceOutputSchema>;
