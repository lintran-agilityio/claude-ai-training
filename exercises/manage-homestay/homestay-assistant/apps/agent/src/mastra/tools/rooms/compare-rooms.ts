import { randomUUID } from "node:crypto";
import { createTool } from "@mastra/core/tools";

import { TOOL_KEYS } from "@repo/constants/tool-keys";
import {
  compareRoomsInputSchema,
  compareRoomsOutputSchema,
  type CompareRoomsOutput,
} from "@/mastra/schemas/rooms";
import {
  buildRoomComparisonEnvelope,
  readCompareCandidates,
  selectCompareRooms,
  toRoomComparisonProps,
} from "@/mastra/utils/compare-rooms";
import {
  REPLY_HINT_COMPARE_ROOMS_NO_CANDIDATES,
  REPLY_HINT_COMPARE_ROOMS_RENDERED,
} from "@/mastra/utils/generic-ui";
import { throwIfAborted } from "@/mastra/utils/abort";

/**
 * The UI receives the `a2ui_operations` envelope (painted by the A2UIMiddleware).
 * The model only learns that the surface rendered — no room names, prices or
 * amenities it could repeat in its companion sentence.
 */
export const toCompareRoomsModelOutput = (output: CompareRoomsOutput) => ({
  type: "json" as const,
  value:
    output.status === "rendered"
      ? {
          status: output.status,
          roomCount: output.roomCount,
          replyHint: REPLY_HINT_COMPARE_ROOMS_RENDERED,
        }
      : {
          status: output.status,
          replyHint: REPLY_HINT_COMPARE_ROOMS_NO_CANDIDATES,
        },
});

export const compareRoomsTool = createTool({
  id: TOOL_KEYS.GET.COMPARE_ROOMS,

  description: `
    Render a side-by-side RoomComparison of rooms the guest ALREADY sees from the
    latest find_room search/recommend in this conversation.

    Use when the guest asks to compare / contrast those rooms, or which of them is
    better / cheaper / bigger.

    The tool reads the room data itself from that search — never pass names,
    prices or amenities. Pass roomIds only to narrow to the rooms the guest named.

    Do not use for:
    - a new search (use find_room)
    - room details or booking (use get_room_by_id)
  `.trim(),

  inputSchema: compareRoomsInputSchema,
  outputSchema: compareRoomsOutputSchema,

  execute: async (input, context) => {
    throwIfAborted(context.abortSignal);

    const candidates = readCompareCandidates(context.requestContext);
    if (!candidates) {
      return { status: "no_candidates" as const };
    }

    const rooms = selectCompareRooms(candidates.rooms, input.roomIds);
    const props = toRoomComparisonProps(rooms, candidates.language);
    const surfaceId = `room-comparison-${context.agent?.toolCallId ?? randomUUID()}`;

    return {
      status: "rendered" as const,
      roomCount: props.rooms.length,
      ...buildRoomComparisonEnvelope(surfaceId, props),
    };
  },

  toModelOutput: toCompareRoomsModelOutput,
});
