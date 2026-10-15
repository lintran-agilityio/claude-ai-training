"use client";

import { Minus, Plus } from "lucide-react";

type RoomBookingGuestsProps = {
  guests: number;
  capacity: number;
  disabled?: boolean;
  onGuestsChange: (guests: number) => void;
};

export const RoomBookingGuests = ({
  guests,
  capacity,
  disabled = false,
  onGuestsChange,
}: RoomBookingGuestsProps) => {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
        Guests
      </p>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Up to {capacity} guest{capacity === 1 ? "" : "s"}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Decrease guests"
            disabled={disabled || guests <= 1}
            onClick={() => onGuestsChange(Math.max(1, guests - 1))}
            className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none cursor-pointer"
          >
            <Minus className="size-4" />
          </button>

          <span className="min-w-6 text-center text-sm font-medium text-foreground">
            {guests}
          </span>

          <button
            type="button"
            aria-label="Increase guests"
            disabled={disabled || guests >= capacity}
            onClick={() => onGuestsChange(Math.min(capacity, guests + 1))}
            className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none cursor-pointer"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
