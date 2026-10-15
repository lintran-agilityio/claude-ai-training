"use client";

import { useCallback } from "react";

import { ROOM_DETAIL_ENTRY_MODE } from "@/constants";
import { useRoomStore } from "@/features/room/stores/room-store";

type OpenRoomOnPageArgs = {
  roomId: string;
};

export const useOpenRoomOnPage = () => {
  const setSelectedRoomId = useRoomStore((state) => state.setSelectedRoomId);

  return useCallback(
    ({ roomId }: OpenRoomOnPageArgs) => {
      if (!roomId) {
        return;
      }

      setSelectedRoomId(roomId, ROOM_DETAIL_ENTRY_MODE.VIEW);
    },
    [setSelectedRoomId],
  );
};
