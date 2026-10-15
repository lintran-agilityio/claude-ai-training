"use client";

import type { ReactNode } from "react";
import { formatPrice } from "@repo/utils";

import { Button } from "@/components/ui/button";
import type { BookingDetails } from "@/features/booking/types";

type BookingPickerRowProps = {
  booking: BookingDetails;
  onSelect?: () => void;
  disabled?: boolean;
};

const BookingPickerRow = ({
  booking,
  onSelect,
  disabled = false,
}: BookingPickerRowProps) => {
  const content = (
    <>
      <span className="font-medium text-foreground">{booking.roomName}</span>
      <span className="text-muted-foreground">
        {booking.checkInDate} → {booking.checkOutDate}
      </span>
      {onSelect ? (
        <span className="text-muted-foreground">
          Total price: {formatPrice(booking.totalPrice)}
        </span>
      ) : null}
    </>
  );

  if (!onSelect) {
    return (
      <div className="flex w-full flex-col rounded-lg border border-border bg-muted/40 p-3 text-left text-xs cursor-pointer">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className="flex w-full flex-col rounded-lg border border-border bg-muted/40 p-3 text-left text-xs transition hover:bg-accent disabled:opacity-50 cursor-pointer"
      onClick={onSelect}
    >
      {content}
    </button>
  );
};

type BookingPickerCardProps = {
  title: ReactNode;
  description: ReactNode;
  /** Read-only summary rows when `onSelect` is omitted. */
  bookings: BookingDetails[];
  disabled?: boolean;
  onSelect?: (booking: BookingDetails) => void;
  keepLabel?: string;
  onKeep?: () => void;
};

/** Shared body for cancel/modify multi-booking disambiguation pickers. */
export const BookingPickerCard = ({
  title,
  description,
  bookings,
  disabled = false,
  onSelect,
  keepLabel,
  onKeep,
}: BookingPickerCardProps) => (
  <div className="space-y-3 p-3.5 text-foreground">
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>

    {bookings.length > 0 ? (
      <div className="space-y-2">
        {bookings.map((booking) => (
          <BookingPickerRow
            key={booking.bookingId}
            booking={booking}
            disabled={disabled}
            onSelect={onSelect ? () => onSelect(booking) : undefined}
          />
        ))}
      </div>
    ) : null}

    {onKeep && keepLabel ? (
      <div className="pt-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onKeep}
        >
          {keepLabel}
        </Button>
      </div>
    ) : null}
  </div>
);
