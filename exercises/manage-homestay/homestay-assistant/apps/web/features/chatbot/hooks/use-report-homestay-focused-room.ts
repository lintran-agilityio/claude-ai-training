import { useEffect } from "react";

import { useHomestayAgentUiStore } from "@/features/chatbot/stores/homestay-agent-ui-store";

/** Registers visible room detail UI for HomestayAgentContext (stacked by mount order). */
export const useReportHomestayFocusedRoom = (roomId: string | null | undefined) => {
  const pushFocusedRoom = useHomestayAgentUiStore(
    (state) => state.pushFocusedRoom,
  );
  const popFocusedRoom = useHomestayAgentUiStore(
    (state) => state.popFocusedRoom,
  );

  useEffect(() => {
    if (!roomId) {
      return;
    }

    pushFocusedRoom(roomId);

    return () => {
      popFocusedRoom(roomId);
    };
  }, [popFocusedRoom, pushFocusedRoom, roomId]);
};
