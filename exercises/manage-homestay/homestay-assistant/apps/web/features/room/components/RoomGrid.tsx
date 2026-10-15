"use client";

import { ArrowLeft, Heart, Share2 } from "lucide-react";

import { RoomListSkeleton } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ListRoom, RoomDetail } from "@/features/room/components";
import { ROOM_DETAIL_VARIANT } from "@/constants";
import { useRoomStore } from "@/features/room/stores/room-store";
import type { Room } from "@/features/room/types/room";
import { cn } from "@repo/utils";

type RoomGridProps = {
  initialRooms: Room[];
  className?: string;
};

export const RoomGrid = ({ initialRooms, className }: RoomGridProps) => {
  const storeRooms = useRoomStore((state) => state.rooms);
  const title = useRoomStore((state) => state.roomListTitle);
  const isLoading = useRoomStore((state) => state.isRoomListLoading);
  const selectedRoomId = useRoomStore((state) => state.selectedRoomId);
  const selectedRoomMode = useRoomStore((state) => state.selectedRoomMode);
  const clearSelectedRoom = useRoomStore((state) => state.clearSelectedRoom);
  const rooms =
    title !== undefined
      ? storeRooms
      : storeRooms.length > 0
        ? storeRooms
        : initialRooms;
  const hasRooms = rooms.length > 0;
  const selectedRoom =
    selectedRoomId != null
      ? (rooms.find((room) => room.id === selectedRoomId) ??
        initialRooms.find((room) => room.id === selectedRoomId))
      : undefined;

  if (isLoading && !hasRooms) {
    return <RoomListSkeleton className={className} />;
  }

  if (selectedRoom) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={clearSelectedRoom}
          >
            <ArrowLeft className="size-4" />
            Back to rooms
          </Button>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Heart className="size-4" />
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Share2 className="size-4" />
              Share
            </Button>
          </div>
        </div>

        <RoomDetail
          {...selectedRoom}
          variant={ROOM_DETAIL_VARIANT.PAGE}
          entryMode={selectedRoomMode}
        />
      </div>
    );
  }

  return <ListRoom rooms={rooms} title={title} className={className} />;
};
