"use client";

import { useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  HOMESTAY_AGENT_TASK_STATUS,
  HOMESTAY_AGENT_TASK_TYPE,
} from "@repo/constants";
import { buildActionPrompt } from "@repo/utils";
import { useSendAgentMessage } from "@/features/chatbot/hooks";
import { FLOW_KEY, ROUTES, ROOM_DETAIL_ENTRY_MODE } from "@/constants";
import { useHomestayAgentUiStore } from "@/features/chatbot/stores/homestay-agent-ui-store";
import { useBookingStore } from "@/features/booking/stores/booking-store";
import { useRoomStore } from "@/features/room/stores/room-store";
import { prepareBookingFormMessage } from "@/features/booking/utils";

type OpenRoomDetailArgs = {
  roomId: string;
  roomName: string;
};

export const useRequestRoomDetail = () => {
  const roomIdRef = useRef<string | null>(null);

  const { sendMessage } = useSendAgentMessage({
    onBeforeSend: () => {
      const roomId = roomIdRef.current;
      if (roomId) {
        useHomestayAgentUiStore.getState().pushFocusedRoom(roomId);
      }
    },
    onError: (error) => {
      console.error("Failed to open room detail in chat", error);
    },
  });

  return useCallback(
    ({ roomId, roomName }: OpenRoomDetailArgs) => {
      if (!roomId) {
        return;
      }

      roomIdRef.current = roomId;
      const message = buildActionPrompt({
        action: "Show detail room for",
        targetName: roomName || "this room",
        identifiers: {
          roomId,
        },
      });
      sendMessage(message);
    },
    [sendMessage],
  );
};

type RequestRoomBookingFormArgs = {
  roomId: string;
  roomName: string;
  /**
   * Whether to also open the room detail on the home page. Page room cards
   * keep this on; chat cards turn it off so booking stays inside chat.
   */
  openOnPage?: boolean;
};

export const useRequestRoomBookingForm = () => {
  const pathname = usePathname();
  const paramsRef = useRef<{ roomId: string; openOnPage: boolean } | null>(
    null,
  );

  const { sendMessage } = useSendAgentMessage({
    onBeforeSend: () => {
      const params = paramsRef.current;
      if (!params) {
        return;
      }
      const { roomId, openOnPage } = params;

      useBookingStore.getState().updateBookingDraft({
        roomId,
        checkInDate: null,
        checkOutDate: null,
        guests: 1,
      });
      useHomestayAgentUiStore.getState().pushFocusedRoom(roomId);
      useHomestayAgentUiStore.getState().pushUiFocus({
        key: FLOW_KEY.BOOK,
        task: {
          type: HOMESTAY_AGENT_TASK_TYPE.BOOK,
          status: HOMESTAY_AGENT_TASK_STATUS.IN_PROGRESS,
        },
        focus: { type: "room", id: roomId },
      });

      if (openOnPage && pathname === ROUTES.HOME) {
        useRoomStore
          .getState()
          .setSelectedRoomId(roomId, ROOM_DETAIL_ENTRY_MODE.BOOK);
      }
    },
    onError: (error) => {
      console.error("Failed to open room booking form in chat", error);
    },
  });

  return useCallback(
    ({ roomId, roomName, openOnPage = true }: RequestRoomBookingFormArgs) => {
      if (!roomId) {
        return;
      }

      paramsRef.current = { roomId, openOnPage };
      const { message } = prepareBookingFormMessage(roomId, roomName);
      sendMessage(message);
    },
    [sendMessage],
  );
};
