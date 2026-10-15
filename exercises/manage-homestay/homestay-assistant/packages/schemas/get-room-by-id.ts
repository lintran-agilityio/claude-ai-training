import { z } from "zod";

export const getRoomByIdInputSchema = z.object({
  roomId: z.string().describe("Room ID to fetch"),
  checkInDate: z
    .string()
    .optional()
    .describe("YYYY-MM-DD check-in date already stated in the guest's latest message, to prefill the Booking Form"),
  checkOutDate: z
    .string()
    .optional()
    .describe("YYYY-MM-DD check-out date already stated in the guest's latest message, to prefill the Booking Form"),
  guests: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Guest count already stated in the guest's latest message, to prefill the Booking Form"),
  nights: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Stay LENGTH in nights already stated in the guest's latest message ('4 nights' → 4), to prefill the Booking Form. Carried even when no check-in date is known — the form opens with empty dates but keeps the stay length, so picking a check-in resolves check-out as check-in + nights. Never derive a date from this.",
    ),
});

export type GetRoomByIdInput = z.infer<typeof getRoomByIdInputSchema>;
