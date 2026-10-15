"use client";

import { useCallback, useState } from "react";

import { useGenericUiInteraction } from "@/features/chatbot/hooks";
import { ListRoom } from "@/features/room/components/ListRoom";
import type { RoomSelectPayload } from "@/features/room/components/Room";
import { RoomChatDetail } from "@/features/room/components/RoomChatDetail";
import { useRequestRoomBookingForm } from "@/features/room/hooks";
import { Room } from "@/features/room/types";

type ListRoomPreviewProps = {
  rooms?: Room[];
  title?: string;
  /** Host find_room tool call — gates Book when interaction is superseded. */
  toolCallId?: string;
};

/**
 * Chat-only room results. Viewing a room swaps this card for a chat-sized
 * detail view; nothing here touches the page room grid.
 * Book stays visible but disabled once the interaction is superseded by a
 * new user request.
 */
export const ListRoomPreview = ({
  rooms = [],
  title,
  toolCallId,
}: ListRoomPreviewProps) => {
  const [viewedRoomId, setViewedRoomId] = useState<string | null>(null);
  const requestRoomBookingForm = useRequestRoomBookingForm();
  const { isActionable } = useGenericUiInteraction(toolCallId);
  // Clicking while the agent is genuinely still running is already caught by
  // rejectIfAgentRunning() inside sendMessage (useSendAgentMessage) — gating
  // the button on agent.isRunning too just left it stuck disabled whenever
  // that flag lagged/failed to clear until a thread refresh.
  const bookDisabled = !isActionable;

  const viewedRoom = viewedRoomId
    ? rooms.find((room) => room.id === viewedRoomId)
    : undefined;

  const handleView = useCallback(({ roomId }: RoomSelectPayload) => {
    setViewedRoomId(roomId);
  }, []);

  const handleBookInChat = useCallback(
    ({ roomId, roomName }: RoomSelectPayload) => {
      requestRoomBookingForm({ roomId, roomName, openOnPage: false });
    },
    [requestRoomBookingForm],
  );

  if (viewedRoom) {
    return (
      <RoomChatDetail
        room={viewedRoom}
        onBack={() => setViewedRoomId(null)}
        onBook={handleBookInChat}
        bookDisabled={bookDisabled}
      />
    );
  }

  return (
    <ListRoom
      rooms={rooms}
      title={title ?? "Room results"}
      compact
      className="max-w-full rounded-xl border border-border bg-card p-3.5"
      onSelectRoom={handleView}
      onBookRoom={handleBookInChat}
      bookDisabled={bookDisabled}
    />
  );
};
