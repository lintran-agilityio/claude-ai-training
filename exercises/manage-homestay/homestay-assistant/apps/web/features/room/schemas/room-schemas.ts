import { z } from "zod";

/** FE-only frontend tool — not mirrored in Mastra. */
export const updateRoomListSchema = z.object({
  roomIds: z
    .array(z.string())
    .describe(
      "Room IDs only — get_rooms result.roomIds, or find_room result.rooms[].id. Never send full room objects; the UI resolves the details itself.",
    ),
  title: z
    .string()
    .optional()
    .describe("Optional heading above the room grid"),
});
