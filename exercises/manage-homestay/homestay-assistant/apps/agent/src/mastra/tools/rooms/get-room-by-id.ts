import { createTool } from "@mastra/core/tools";

import { TOOL_KEYS } from "@repo/constants/tool-keys";
import { getRoomByIdInputSchema } from "@repo/schemas";
import { getRoom } from "@/mastra/services";
import {
  getRoomDetailOutputSchema,
  type GetRoomDetailOutput,
} from "@/mastra/schemas/rooms";
import {
  serviceContextFromTool,
  throwIfAborted,
  resolveRoomStay,
  REPLY_HINT_GET_ROOM_BY_ID,
  REPLY_HINT_GET_ROOM_BY_ID_UNAVAILABLE,
} from "@/mastra/utils";

/**
 * True when a stated guest count (this turn, or carried from an earlier
 * dated/guest-count search) already exceeds `room.capacity` — a fact
 * `resolveRoomStay` deliberately never clamps away. Named-room BOOK requests
 * can reach `get_room_by_id` directly (roomId already known from earlier in
 * the conversation — see WORKFLOW — BOOK in intent-playbook.ts) as well as via
 * `find_room(book_resolve)`'s forced routing, so this guard has to live here
 * too, not only in findRoomTool's probe, or the same over-capacity request
 * silently opens the Booking Form instead of GetRoomByIdNotice rendering
 * BookingUnavailable.
 */
const isOverCapacity = (room: GetRoomDetailOutput["room"]): boolean =>
  typeof room.guests === "number" && room.guests > room.capacity;

/**
 * The UI receives the full raw result. The model only receives the room id and
 * companion-copy instruction, preventing it from repeating visible card data.
 */
export const toGetRoomByIdModelOutput = (output: GetRoomDetailOutput) => {
  const { room } = output;

  return {
    type: "json" as const,
    value: {
      roomId: room.id,
      replyHint: isOverCapacity(room)
        ? REPLY_HINT_GET_ROOM_BY_ID_UNAVAILABLE
        : REPLY_HINT_GET_ROOM_BY_ID,
    },
  };
};

export const getRoomByIdTool = createTool({
  id: TOOL_KEYS.BOOKING.GET_ROOM_BY_ID,

  description: `
    Fetch a room by its unique roomId.

    Use when:
    - the guest explicitly requests details for a specific room
    - roomId is already known and the room must be resolved before continuing a booking flow

    Do not use for:
    - room search
    - room availability search
    - room filtering
    - room recommendations

    The UI renders the room detail or booking form from the tool result.
  `.trim(),

  inputSchema: getRoomByIdInputSchema,
  outputSchema: getRoomDetailOutputSchema,

  execute: async (input, context) => {
    throwIfAborted(context.abortSignal);

    const room = await getRoom(input.roomId, serviceContextFromTool(context));

    const stay = resolveRoomStay(input, context.requestContext);

    return {
      room: {
        ...room,
        ...stay,
      },
    };
  },

  toModelOutput: toGetRoomByIdModelOutput,
});
