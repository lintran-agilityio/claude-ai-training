import {
  HOMESTAY_AGENT_SCREEN,
  HOMESTAY_AGENT_TASK_STATUS,
  HOMESTAY_AGENT_TASK_TYPE,
} from "@repo/constants";
import { ROUTES } from "@/constants";
import type { HomestayAgentContext } from "@/features/chatbot/types";
import type { HomestayAgentUiFocusEntry } from "@/features/chatbot/stores/homestay-agent-ui-store";

export type HomestayAgentDraftSnapshot = {
  roomId: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
};

export type HomestayAgentUiSnapshot = {
  focusedRoomId: string | null;
  /** Active UI focus stack top (suggestion / context). */
  activeUiFocus: HomestayAgentUiFocusEntry | null;
};

export const buildHomestayAgentContext = (
  pathname: string,
  draft: HomestayAgentDraftSnapshot,
  ui: HomestayAgentUiSnapshot,
): HomestayAgentContext => {
  const active = ui.activeUiFocus;

  if (pathname === ROUTES.BOOKINGS) {
    return {
      screen: { name: HOMESTAY_AGENT_SCREEN.BOOKINGS },
      ...(active?.focus ? { focus: active.focus } : {}),
      task: active?.task ?? {
        type: HOMESTAY_AGENT_TASK_TYPE.MANAGE,
        status: HOMESTAY_AGENT_TASK_STATUS.IDLE,
      },
    };
  }

  const roomId =
    active?.focus?.type === "room"
      ? active.focus.id
      : (ui.focusedRoomId ?? draft.roomId);

  if (!roomId && !active) {
    return {
      screen: { name: HOMESTAY_AGENT_SCREEN.HOME },
      task: {
        type: HOMESTAY_AGENT_TASK_TYPE.DISCOVER,
        status: HOMESTAY_AGENT_TASK_STATUS.IDLE,
      },
    };
  }

  const hasDraftForRoom =
    Boolean(roomId) &&
    draft.roomId === roomId &&
    Boolean(draft.checkInDate && draft.checkOutDate);

  const isBookingForm =
    active?.focus?.type === "booking" ||
    active?.task.type === HOMESTAY_AGENT_TASK_TYPE.BOOK ||
    (active?.task.type === HOMESTAY_AGENT_TASK_TYPE.MANAGE &&
      active.task.status !== HOMESTAY_AGENT_TASK_STATUS.IDLE) ||
    hasDraftForRoom;

  const screen = isBookingForm
    ? { name: HOMESTAY_AGENT_SCREEN.BOOKING_FORM }
    : { name: HOMESTAY_AGENT_SCREEN.ROOM_DETAIL };

  const focus =
    active?.focus ??
    (roomId ? { type: "room" as const, id: roomId } : undefined);

  const defaultTask = hasDraftForRoom
    ? {
        type: HOMESTAY_AGENT_TASK_TYPE.BOOK,
        status: HOMESTAY_AGENT_TASK_STATUS.IDLE,
      }
    : {
        type: HOMESTAY_AGENT_TASK_TYPE.DISCOVER,
        status: HOMESTAY_AGENT_TASK_STATUS.IDLE,
      };

  return {
    screen,
    ...(focus ? { focus } : {}),
    task: active?.task ?? defaultTask,
  };
};
