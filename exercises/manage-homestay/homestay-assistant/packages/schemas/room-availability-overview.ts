import { z } from "zod";
import { roomSchema } from "./room.js";

export const roomAvailabilityOverviewInputSchema = z.object({
  date: z
    .string()
    .optional()
    .describe(
      "YYYY-MM-DD date to check. Omit for today. Resolve relative cues (tomorrow, the 16th) to a calendar date first.",
    ),
  checkOutDate: z
    .string()
    .optional()
    .describe(
      "YYYY-MM-DD exclusive check-out date. Omit to check the single night starting on `date`.",
    ),
});

export type RoomAvailabilityOverviewInput = z.infer<
  typeof roomAvailabilityOverviewInputSchema
>;

export const bookedRoomSchema = z.object({
  room: roomSchema,
  bookingId: z.string(),
  guestName: z.string(),
  checkInDate: z.string().describe("YYYY-MM-DD"),
  checkOutDate: z.string().describe("YYYY-MM-DD"),
});

/**
 * `booked` is optional on purpose: the API omits the key entirely for
 * non-managers, so consumers must treat its absence as "not allowed to see".
 */
export const roomAvailabilityOverviewSchema = z.object({
  date: z.string().describe("YYYY-MM-DD"),
  checkOutDate: z.string().describe("YYYY-MM-DD"),
  available: z.array(roomSchema),
  summary: z.object({
    total: z.number(),
    availableCount: z.number(),
    bookedCount: z.number(),
  }),
  booked: z.array(bookedRoomSchema).optional(),
});

export type BookedRoom = z.infer<typeof bookedRoomSchema>;
export type RoomAvailabilityOverview = z.infer<
  typeof roomAvailabilityOverviewSchema
>;

