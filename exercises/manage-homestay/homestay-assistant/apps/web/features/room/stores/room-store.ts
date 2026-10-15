import { create } from "zustand";

import {
  ROOM_DETAIL_ENTRY_MODE,
  type RoomDetailEntryMode,
} from "@/constants";
import type { Room } from "@/features/room/types/room";

type RoomStore = {
  rooms: Room[];
  roomListTitle: string | undefined;
  isRoomListLoading: boolean;
  selectedRoomId: string | null;
  selectedRoomMode: RoomDetailEntryMode;
  /** True after the agent searched rooms in chat. Drives suggestions only — the grid is page-owned. */
  hasAgentRoomSearch: boolean;
  updateRoomList: (rooms: Room[], title?: string) => void;
  markAgentRoomSearch: () => void;
  setSelectedRoomId: (
    roomId: string | null,
    mode?: RoomDetailEntryMode,
  ) => void;
  clearSelectedRoom: () => void;
  clearAgentRoomSearch: () => void;
};

export const useRoomStore = create<RoomStore>()((set) => ({
  rooms: [],
  roomListTitle: undefined,
  isRoomListLoading: false,
  selectedRoomId: null,
  selectedRoomMode: ROOM_DETAIL_ENTRY_MODE.VIEW,
  hasAgentRoomSearch: false,

  updateRoomList: (rooms, title) =>
    set({ rooms, roomListTitle: title, isRoomListLoading: false }),

  markAgentRoomSearch: () => set({ hasAgentRoomSearch: true }),

  setSelectedRoomId: (roomId, mode = ROOM_DETAIL_ENTRY_MODE.VIEW) =>
    set({
      selectedRoomId: roomId,
      selectedRoomMode: roomId == null ? ROOM_DETAIL_ENTRY_MODE.VIEW : mode,
    }),

  clearSelectedRoom: () =>
    set({
      selectedRoomId: null,
      selectedRoomMode: ROOM_DETAIL_ENTRY_MODE.VIEW,
    }),

  clearAgentRoomSearch: () => set({ hasAgentRoomSearch: false }),
}));
