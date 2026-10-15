"use client";

import {
  useAgent,
  useFrontendTool,
  useRenderTool,
} from "@copilotkit/react-core/v2";

import { AGENT_KEYS, TOOL_KEYS } from "@repo/constants";
import {
  findRoomInputSchema,
  getRoomByIdInputSchema,
} from "@repo/schemas";
import { updateRoomListSchema } from "@/features/room/schemas";
import {
  formatRoomListSyncResult,
  hasFindRoomInCurrentTurn,
  markAgentRoomSearch,
  resolveRoomsByIds,
} from "@/features/room/utils";
import {
  FindRoomNotice,
  GetRoomByIdNotice,
} from "@/features/room/components";
import type {
  FindRoomResult,
  GetRoomByIdResult,
} from "@/features/room/types";

export const RoomToolsProvider = () => {
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });

  useRenderTool(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.BOOKING.GET_ROOM_BY_ID,
      parameters: getRoomByIdInputSchema,
      render: ({ status, result, toolCallId }) => (
        <GetRoomByIdNotice
          status={status}
          result={result as GetRoomByIdResult | string | null}
          toolCallId={toolCallId}
        />
      ),
    },
    [],
  );

  useRenderTool(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.GET.FIND_ROOM,
      parameters: findRoomInputSchema,
      render: ({ status, result, parameters, toolCallId }) => (
        <FindRoomNotice
          status={status}
          result={result as FindRoomResult | string | null}
          parameters={
            parameters as { purpose?: FindRoomResult["purpose"] } | undefined
          }
          toolCallId={toolCallId}
        />
      ),
    },
    [],
  );

  useFrontendTool(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.ACTION.UPDATE_ROOM_LIST,
      // find_room renders its own chat list. Remove this tool for the rest of
      // that turn so the model cannot create a redundant frontend-tool hop.
      available: !hasFindRoomInCurrentTurn(agent.messages),
      description:
        "Use ONLY after get_rooms (plain catalog browse). Pass roomIds from get_rooms result.roomIds (IDs only). Do NOT call after find_room — ListRoomPreview already renders search results and calling this can duplicate the room list in chat. This tool does not change the page the guest is browsing. After this succeeds, always send one short guest-facing chat reply.",
      parameters: updateRoomListSchema,
      handler: async ({ roomIds, title }) => {
        // find_room already renders ListRoomPreview in chat — skip side effects
        // so a mistaken follow-up update_room_list cannot duplicate the list.
        if (hasFindRoomInCurrentTurn(agent.messages)) {
          return "Room cards are already shown in chat from find_room — do not call update_room_list after find_room. Reply with one short sentence only.";
        }

        const rooms = await resolveRoomsByIds(roomIds);

        if (!rooms.length) {
          return "Could not resolve those room IDs — nothing to show.";
        }

        markAgentRoomSearch();
        return formatRoomListSyncResult(rooms, title);
      },
    },
    [agent.messages],
  );

  return null;
};
