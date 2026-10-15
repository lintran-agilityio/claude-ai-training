import { createTool } from "@mastra/core/tools";

import { TOOL_KEYS } from "@repo/constants/tool-keys";
import { getRooms } from "@/mastra/services";
import {
  getRoomsInputSchema,
  getRoomsOutputSchema,
  type GetRoomsOutput,
} from "@/mastra/schemas/rooms";
import {
  serviceContextFromTool,
  throwIfAborted,
} from "@/mastra/utils/abort";

/**
 * Slim payload for the model: ids only, mirroring find_room. Re-emitting full
 * room objects as update_room_list arguments overflows the per-step output
 * token budget, which truncates the tool call and breaks the AG-UI stream.
 * The UI still receives the raw result with every field.
 */
const toGetRoomsModelOutput = (output: GetRoomsOutput) => {
  const roomCount = output.rooms.length;
  const replyHint =
    roomCount === 0
      ? "No rooms available. Reply with ONE short sentence saying so — do NOT invent rooms."
      : "Pass roomIds to update_room_list, then reply with ONE short sentence that the rooms are ready on the grid. Never write room names, prices, or details in chat.";

  return {
    type: "json" as const,
    value: {
      roomCount,
      // IDs only — the model never needs the rich fields, and withholding them
      // stops it from dumping room details into chat.
      roomIds: output.rooms.map((room) => room.id),
      replyHint,
    },
  };
};

export const getRoomsTool = createTool({
  id: TOOL_KEYS.GET.ROOMS,
  description: `
    Fetch the complete room catalog.

    Use only for plain catalog browsing, such as:
    - "show all rooms"
    - "browse all rooms"

    Do not use for:
    - room search or filtering
    - room name lookup
    - guest/capacity filtering
    - room level filtering
    - available rooms
    - date availability

    Use find_room for filtered or availability searches.

    After a successful call with rooms:
    1. Pass the returned roomIds to update_room_list.
    2. Reply with one short sentence saying the rooms are ready on the grid.
    3. Do not list room names, prices, or details in chat.

    If no rooms are returned, reply with one short sentence saying no rooms are available.
  `.trim(),
  inputSchema: getRoomsInputSchema,
  outputSchema: getRoomsOutputSchema,
  execute: async (_input, context) => {
    throwIfAborted(context.abortSignal);
    const rooms = await getRooms(serviceContextFromTool(context));
    return { rooms };
  },
  toModelOutput: toGetRoomsModelOutput,
});
