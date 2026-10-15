"use client";

import { formatPrice, formatShortDateForDisplay } from "@repo/utils";

export type StaySummaryProps = {
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  guests?: number;
  totalPrice?: number;
};

/**
 * Shared stay details summary for HITL confirm cards (create / cancel / fallbacks).
 */
export const StaySummary = ({
  roomName,
  checkInDate,
  checkOutDate,
  guests,
  totalPrice,
}: StaySummaryProps) => (
  <dl className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3 text-xs">
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">Room</dt>
      <dd className="text-right text-foreground">{roomName}</dd>
    </div>
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">Dates</dt>
      <dd className="text-right text-foreground">
        {formatShortDateForDisplay(checkInDate)} →{" "}
        {formatShortDateForDisplay(checkOutDate)}
      </dd>
    </div>
    {guests != null ? (
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Guests</dt>
        <dd className="text-right text-foreground">{guests}</dd>
      </div>
    ) : null}
    {totalPrice != null ? (
      <div className="flex justify-between gap-4 border-t border-border pt-1.5">
        <dt className="text-muted-foreground">Total</dt>
        <dd className="text-right font-medium text-primary">
          {formatPrice(totalPrice)}
        </dd>
      </div>
    ) : null}
  </dl>
);
