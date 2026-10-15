import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { useBooking } from "@/features/booking/hooks";
import {
  selectActiveHomestayUiFocus,
  selectFocusedRoomId,
  useHomestayAgentUiStore,
} from "@/features/chatbot/stores/homestay-agent-ui-store";
import type { HomestayAgentContext } from "@/features/chatbot/types";
import { buildHomestayAgentContext } from "@/features/chatbot/utils/build-homestay-agent-context";

export const useHomestayAgentContext = (): HomestayAgentContext => {
  const pathname = usePathname();
  const roomId = useBooking((s) => s.roomId);
  const checkInDate = useBooking((s) => s.checkInDate);
  const checkOutDate = useBooking((s) => s.checkOutDate);
  const focusedRoomId = useHomestayAgentUiStore((s) =>
    selectFocusedRoomId(s.focusedRoomStack),
  );
  const uiFocusEntries = useHomestayAgentUiStore((s) => s.uiFocusEntries);

  return useMemo(() => {
    const activeUiFocus = selectActiveHomestayUiFocus(uiFocusEntries);

    return buildHomestayAgentContext(
      pathname,
      { roomId, checkInDate, checkOutDate },
      { focusedRoomId, activeUiFocus },
    );
  }, [
    checkInDate,
    checkOutDate,
    focusedRoomId,
    pathname,
    roomId,
    uiFocusEntries,
  ]);
};
