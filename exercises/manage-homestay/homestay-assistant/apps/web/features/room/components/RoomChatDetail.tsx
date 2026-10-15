"use client";

import { ArrowLeft, CalendarCheck, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/features/booking/components/BookingStatusBadge";
import { RoomBookingPricePerNight } from "@/features/room/components/RoomBookingPricePerNight";
import {
  RoomDetailAmenityHighlights,
  RoomDetailQuickStats,
} from "@/features/room/components/RoomDetailHighlights";
import { RoomDetailRating } from "@/features/room/components/RoomDetailRating";
import { RoomImage } from "@/features/room/components/RoomImage";
import type { RoomSelectPayload } from "@/features/room/components/Room";
import type { Room } from "@/features/room/types/room";
import { cn } from "@repo/utils";

type RoomChatDetailProps = {
  room: Room;
  className?: string;
  onBack?: () => void;
  onBook?: (payload: RoomSelectPayload) => void;
  /** Keeps the Book button visible but non-interactive (e.g. turn superseded / agent still running). */
  bookDisabled?: boolean;
};

/**
 * Read-only room detail sized for the chat sidebar (~420px card).
 * Single column, condensed typography, and no page state — booking is handed
 * off to the existing booking-form flow.
 */
export const RoomChatDetail = ({
  room,
  className,
  onBack,
  onBook,
  bookDisabled = false,
}: RoomChatDetailProps) => {
  const {
    id,
    name,
    description,  
    capacity,
    level,
    levelColor,
    imageUrl,
    amenities = [],
    availableSlots,
    pricePerNight,
    bookingStatus,
  } = room;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <RoomImage
        imageUrl={imageUrl}
        name={name || "Room Image"}
        level={level}
        levelColor={levelColor}
        capacity={capacity}
        compact
      />

      <div className="flex flex-col gap-3 p-3.5">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 w-fit gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="size-3.5" />
            Back to results
          </Button>
        ) : null}

        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-semibold leading-tight text-foreground">
            {name}
          </h3>
          {bookingStatus ? (
            <BookingStatusBadge status={bookingStatus} />
          ) : null}
        </div>

        <RoomDetailRating />

        <RoomDetailQuickStats
          capacity={capacity}
          level={level}
          className="gap-x-4 text-xs"
        />

        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}

        <RoomDetailAmenityHighlights
          amenities={amenities}
          className="grid-cols-1 gap-2.5 p-3 sm:grid-cols-1"
        />

        {availableSlots > 0 && availableSlots <= 3 ? (
          <div className="flex items-start gap-2 rounded-lg border border-gold/35 bg-gold/10 px-2.5 py-2 text-xs text-gold">
            <Clock3 className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Only {availableSlots} room{availableSlots === 1 ? "" : "s"} left!
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          {pricePerNight != null ? (
            <RoomBookingPricePerNight
              pricePerNight={pricePerNight}
              size="sm"
            />
          ) : (
            <span />
          )}

          {onBook ? (
            <Button
              type="button"
              size="sm"
              disabled={bookDisabled}
              className="h-8 gap-1.5 px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onBook({ roomId: id, roomName: name })}
            >
              <CalendarCheck className="size-3.5" />
              Book
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
};
