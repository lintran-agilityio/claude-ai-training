"use client";

import { CardListSection } from "@/components/common/CardListSection";
import { Room, type RoomSelectPayload } from "@/features/room/components/Room";
import {
  useOpenRoomOnPage,
  useRequestRoomBookingForm,
} from "@/features/room/hooks";
import type { Room as RoomType } from "@/features/room/types/room";

type ListRoomProps = {
  rooms: RoomType[];
  title?: string;
  compact?: boolean;
  className?: string;
  /** Overrides the default "open room detail on the page" behaviour. */
  onSelectRoom?: (payload: RoomSelectPayload) => void;
  /** Overrides the default "start the booking form" behaviour. */
  onBookRoom?: (payload: RoomSelectPayload) => void;
  /** Keeps Book visible but disabled (e.g. superseded Generic UI interaction). */
  bookDisabled?: boolean;
};

export const ListRoom = ({
  rooms,
  title,
  compact = false,
  className,
  onSelectRoom,
  onBookRoom,
  bookDisabled = false,
}: ListRoomProps) => {
  const openRoomOnPage = useOpenRoomOnPage();
  const requestRoomBookingForm = useRequestRoomBookingForm();
  const handleSelect = onSelectRoom ?? openRoomOnPage;
  const handleBook = onBookRoom ?? requestRoomBookingForm;

  return (
    <CardListSection
      items={rooms}
      title={title}
      emptyMessage="No rooms found"
      compact={compact}
      className={className}
      getItemKey={(room, index) => `${room.id}-${index}`}
      renderItem={(room) => (
        <Room
          {...room}
          compact={compact}
          onSelect={handleSelect}
          onBook={handleBook}
          bookDisabled={bookDisabled}
        />
      )}
    />
  );
};
