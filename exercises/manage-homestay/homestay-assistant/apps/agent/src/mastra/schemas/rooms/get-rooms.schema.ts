import { z } from "zod";
import { roomSchema } from "@repo/schemas";

export const getRoomsInputSchema = z.object({});

export const getRoomsOutputSchema = z.object({
  rooms: z.array(roomSchema),
});

export type GetRoomsOutput = z.infer<typeof getRoomsOutputSchema>;

/** API list response for GET /rooms (with or without filters). */
export const roomsListResponseSchema = z.array(roomSchema);
