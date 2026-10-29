import { createTool } from "@mastra/core/tools";

import { TOOL_KEYS } from "@repo/constants";
import {
  roomAvailabilityOverviewInputSchema,
  roomAvailabilityOverviewSchema,
  type RoomAvailabilityOverview,
} from "@repo/schemas";
import { formatTodayYmd } from "@repo/utils";
import { getRoomAvailabilityOverview } from "@/mastra/services";
import { serviceContextFromTool, throwIfAborted } from "@/mastra/utils/abort";

/**
 * Slim payload for the model: free rooms as `{ id, name }` (same shape as
 * find_room) plus counts. `booked` entries — guest names and booked room
 * names — NEVER reach the model, only `bookedCount`. The UI receives the raw
 * result and renders it. `bookedVisible` mirrors whether the API included
 * `booked` for this caller.
 */
export const toRoomAvailabilityModelOutput = (
  output: RoomAvailabilityOverview,
) => {
  const bookedVisible = output.booked !== undefined;

  return {
    type: "json" as const,
    value: {
      date: output.date,
      checkOutDate: output.checkOutDate,
      available: output.available.map((room) => ({
        id: room.id,
        name: room.name,
      })),
      availableCount: output.summary.availableCount,
      bookedCount: output.summary.bookedCount,
      bookedVisible,
      replyHint: bookedVisible
        ? "The availability card is shown. Reply with ONE short sentence; never state guest names. You may answer whether a named room is free from `available`."
        : "The availability card is shown with the free rooms. Reply with ONE short sentence about the free rooms only (you may answer whether a named room is free from `available`). Never mention booked rooms or guest names.",
    },
  };
};

export const checkRoomAvailabilityOverviewTool = createTool({
  id: TOOL_KEYS.GET.CHECK_ROOM_AVAILABILITY,
  description: `
    Read-only room availability overview for a date: which rooms are free, plus
    booked rooms with guest names when the signed-in user is allowed to see them.
    Never creates or changes a booking. User identity and role always come from
    the server session.

    Use for "which rooms are free/booked", room status / occupancy on a date, and
    messages starting with [availability-check].

    Do not use for a guest looking for a room to book (use find_room), and never
    chain confirm_booking, create_booking, or get_room_by_id after it.

    The UI renders the result. Never mention booked rooms or guest names unless
    the result says bookedVisible: true — and even then never state guest names in chat.
  `.trim(),
  inputSchema: roomAvailabilityOverviewInputSchema,
  outputSchema: roomAvailabilityOverviewSchema,
  execute: async (input, context) => {
    throwIfAborted(context.abortSignal);
    return getRoomAvailabilityOverview(
      {
        date: input.date?.trim() || formatTodayYmd(),
        checkOutDate: input.checkOutDate,
      },
      serviceContextFromTool(context),
    );
  },
  toModelOutput: toRoomAvailabilityModelOutput,
});
