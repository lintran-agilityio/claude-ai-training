"use client";

import {
  CalendarCheck,
  CalendarRange,
  Pencil,
  Users,
  CalendarX2,
} from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { useState } from "react";

import { BookingStatusBadge } from "@/features/booking/components/BookingStatusBadge";
import type { BookingResponse } from "@/features/booking/types/booking";
import { FALLBACK_ROOM_IMAGE, resolveRoomImage } from "@/features/room/utils";
import { cn, formatPrice, formatShortDateForDisplay } from "@repo/utils";
import { Button } from "@/components/ui/button";
import {
  isBookingCancellable,
  isBookingModifiable,
} from "@/features/booking/utils";

type BookingCardProps = {
  booking: BookingResponse;
  className?: string;
  /** True once this card's interaction is superseded by a newer request. */
  actionsLocked?: boolean;
  compact?: boolean;
  onCancelBooking?: (booking: BookingResponse) => void;
  onModifyBooking?: (booking: BookingResponse) => void;
};

export const BookingCard = ({
  booking,
  className,
  actionsLocked = false,
  compact = false,
  onCancelBooking,
  onModifyBooking,
}: BookingCardProps) => {
  const { checkInDate, checkOutDate, guests, totalPrice, status } = booking;
  const room = booking.room;
  const imageUrl = room?.imageUrl ?? "";
  const [url, setUrl] = useState<string | StaticImageData>(
    resolveRoomImage(imageUrl),
  );

  const isCancellable = isBookingCancellable(status, checkOutDate);
  const canModify =
    isCancellable && isBookingModifiable(status, checkInDate) && !actionsLocked;
  const canCancel = isCancellable && !actionsLocked;

  const handleCancelBooking = () => {
    if (!room || !canCancel) return;

    onCancelBooking?.(booking);
  };

  const handleModifyBooking = () => {
    if (!room || !canModify) return;

    onModifyBooking?.(booking);
  };

  return (
    <article
      className={cn(
        "group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-gold/40 hover:shadow-sm",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <Image
          src={url}
          alt={room?.name ?? "Booked room"}
          width={800}
          height={500}
          sizes="(max-width: 768px) 100vw, 300px"
          onError={() => {
            setUrl(FALLBACK_ROOM_IMAGE);
          }}
          loading="eager"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-start justify-between",
            compact ? "p-3" : "p-4",
          )}
        >
          {room ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">
              <span
                className="h-3 w-1 rounded-full"
                style={{ backgroundColor: room.levelColor }}
              />
              Level {room.level}
            </span>
          ) : (
            <span />
          )}

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-foreground/70 px-2 py-1 text-xs font-medium text-background">
            <Users className="size-3.5" />
            {guests}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col",
          compact ? "gap-3 p-3" : "gap-4 p-4",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h3
            className={cn(
              // Always reserve two lines so a longer/shorter room name never
              // shifts the date / total / action rows out of alignment with a
              // sibling card in the grid.
              "line-clamp-2 min-h-[l8h] font-serif font-medium text-foreground",
              compact ? "text-base" : "text-lg",
            )}
          >
            {room?.name ?? "Room"}
          </h3>
        </div>

        <div
          className={cn(
            "flex items-start gap-2 text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          <CalendarRange className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className={cn(compact && "min-h-[2lh]")}>
            {formatShortDateForDisplay(checkInDate)} →{" "}
            {formatShortDateForDisplay(checkOutDate)}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Total
          </span>
          <span className="font-semibold text-foreground">
            {formatPrice(totalPrice)}
          </span>
        </div>
      </div>
      {isCancellable ? (
        <div
          className={cn(
            "mt-auto flex gap-2",
            compact ? "m-3 mt-0" : "m-4 mt-0",
          )}
        >
          <Button
            type="button"
            size={compact ? "sm" : "lg"}
            variant="outline"
            disabled={!canModify}
            className={cn(
              "min-w-10 flex-1 gap-2 font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
              compact ? "h-8 text-xs" : "h-11 text-base",
            )}
            onClick={handleModifyBooking}
          >
            <Pencil className="size-4" />
            {compact ? "" : "Modify"}
          </Button>
          <Button
            type="button"
            size={compact ? "sm" : "lg"}
            disabled={!canCancel}
            className={cn(
              "min-w-10 flex-1 gap-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
              compact ? "h-8 text-xs" : "h-11 text-base",
            )}
            onClick={handleCancelBooking}
          >
            {compact ? (
              <CalendarX2 className="size-4" />
            ) : (
              <CalendarCheck className="size-4" />
            )}
            {compact ? "" : "Cancel"}
          </Button>
        </div>
      ) : null}
    </article>
  );
};
