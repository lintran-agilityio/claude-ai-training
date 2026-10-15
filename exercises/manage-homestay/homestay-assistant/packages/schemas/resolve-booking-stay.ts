import { z } from "zod";

import { roomSchema } from "./room.js";

/**
 * RESOLVE primitive for the BOOK flow. Resolves a named room and the stay
 * (checkInDate/checkOutDate/guests), suspending via useInterrupt for an
 * ambiguous room name or missing stay input. Replaces find_room(book_resolve)
 * and get_room_by_id-as-form-opener.
 */
export const resolveBookingStayInputSchema = z.object({
  roomName: z
    .string()
    .optional()
    .describe(
      "Room name the guest named for booking — partial, case-insensitive match. Required when roomId is not already known.",
    ),
  roomId: z
    .string()
    .optional()
    .describe(
      "Already-resolved room id — e.g. re-calling after a room_resolved result, or from a [book-stay]/[book-form] trigger. Skips name lookup.",
    ),
  checkInDate: z
    .string()
    .optional()
    .describe("Check-in date YYYY-MM-DD if the guest already stated it"),
  checkOutDate: z
    .string()
    .optional()
    .describe(
      "Check-out date YYYY-MM-DD if stated — defaults to +1 night from checkInDate",
    ),
  guests: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Guest count if the guest already stated it"),
});

export type ResolveBookingStayInput = z.infer<
  typeof resolveBookingStayInputSchema
>;

export const resolveBookingStaySuspendSchema = z.discriminatedUnion("reason", [
  z.object({
    reason: z.literal("ambiguous_room"),
    rooms: z.array(roomSchema).min(2),
  }),
  z.object({
    reason: z.literal("need_stay_input"),
    room: roomSchema,
  }),
]);

export type ResolveBookingStaySuspend = z.infer<
  typeof resolveBookingStaySuspendSchema
>;

export const resolveBookingStayResumeSchema = z.object({
  roomId: z.string().optional(),
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  guests: z.number().int().positive().optional(),
});

export type ResolveBookingStayResume = z.infer<
  typeof resolveBookingStayResumeSchema
>;

export const resolveBookingStayOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_found") }),
  z.object({
    status: z.literal("room_resolved"),
    roomId: z.string(),
    roomName: z.string(),
    capacity: z.number(),
  }),
  z.object({
    status: z.literal("resolved"),
    roomId: z.string(),
    checkInDate: z.string(),
    checkOutDate: z.string(),
    guests: z.number(),
  }),
]);

export type ResolveBookingStayOutput = z.infer<
  typeof resolveBookingStayOutputSchema
>;
