import { CalendarCheck } from "lucide-react";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { RoomInfo, RoomImage } from "@/features/room/components";
import type { Room as RoomType } from "@/features/room/types/room";
import { cn } from "@repo/utils";

export type RoomSelectPayload = {
  roomId: string;
  roomName: string;
};

export type Room = RoomType & {
  compact?: boolean;
  className?: string;
  onSelect?: (payload: RoomSelectPayload) => void;
  onBook?: (payload: RoomSelectPayload) => void;
  /** Keeps the Book button visible but non-interactive (e.g. turn superseded / agent still running). */
  bookDisabled?: boolean;
};

export const Room = ({
  compact = false,
  className,
  onSelect,
  onBook,
  bookDisabled = false,
  ...room
}: Room) => {
  const canViewOnPage = typeof onSelect === "function";
  const canBookInChat = typeof onBook === "function";

  const handleSelect = () => {
    onSelect?.({
      roomId: room.id,
      roomName: room.name,
    });
  };

  const handleBook = (event: MouseEvent) => {
    event.stopPropagation();
    onBook?.({
      roomId: room.id,
      roomName: room.name,
    });
  };

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-gold/40 hover:shadow-sm",
        "w-full min-w-0",
        canViewOnPage &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      key={room.id}
      role={canViewOnPage ? "button" : undefined}
      tabIndex={canViewOnPage ? 0 : undefined}
      onClick={canViewOnPage ? handleSelect : undefined}
      onKeyDown={
        canViewOnPage
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleSelect();
              }
            }
          : undefined
      }
    >
      <RoomImage
        imageUrl={room.imageUrl}
        name={room.name || "Room Image"}
        level={room.level}
        levelColor={room.levelColor}
        compact={compact}
        capacity={room.capacity}
      />
      <div className="flex-1">
        <RoomInfo
          name={room.name}
          description={room.description}
          amenities={room.amenities}
          compact={compact}
        />
      </div>
      {canViewOnPage || canBookInChat ? (
        <div
          className={cn(
            "flex items-center gap-2 border-t border-border px-3 py-2.5",
            canBookInChat && canViewOnPage ? "justify-between" : "justify-end",
          )}
        >
          {canViewOnPage ? (
            <p className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">
              View {!compact ? "on page" : ""}
            </p>
          ) : null}
          {canBookInChat ? (
            <Button
              type="button"
              size="sm"
              disabled={bookDisabled}
              className="h-8 gap-1.5 bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleBook}
            >
              <CalendarCheck className="size-3.5" />
              Book
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};
