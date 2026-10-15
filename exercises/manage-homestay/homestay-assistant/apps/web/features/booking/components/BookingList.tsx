"use client";

import { CardListSection } from "@/components/common/CardListSection";
import { RoomListSkeleton } from "@/components/common/RoomListSkeleton";
import { BookingCard } from "@/features/booking/components/BookingCard";
import type { BookingResponse } from "@/features/booking/types/booking";
import { useGenericUiInteraction } from "@/features/chatbot/hooks";
import {
  useCancelBooking,
  useModifyBooking,
} from "@/features/booking/hooks/use-booking";

type BookingListProps = {
  bookings: BookingResponse[];
  title?: string;
  className?: string;
  isLoading?: boolean;
  error?: Error;
  compact?: boolean;
  /** Host get_bookings tool call — actions lock once superseded by a new user turn. */
  toolCallId?: string;
};

export const BookingList = ({
  bookings,
  title,
  className,
  isLoading = false,
  error,
  compact = false,
  toolCallId,
}: BookingListProps) => {
  const { isActionable } = useGenericUiInteraction(toolCallId);
  const cancelBooking = useCancelBooking();
  const modifyBooking = useModifyBooking();

  if (isLoading) {
    return (
       <RoomListSkeleton className={className} />
    );
  }

  if (error && !isLoading) {
    return (
      <div className="flex items-center justify-center">
        <p className="text-destructive">{error.message}</p>
      </div>
    );
  }

  return (
    <CardListSection
      items={bookings}
      title={title}
      itemLabel="booking"
      emptyMessage="No bookings found"
      compact={compact}
      className={className}
      getItemKey={(booking) => booking.id}
      renderItem={(booking) => (
        <BookingCard
          booking={booking}
          compact={compact}
          actionsLocked={!isActionable}
          onCancelBooking={cancelBooking}
          onModifyBooking={modifyBooking}
        />
      )}
    />
  );
};
