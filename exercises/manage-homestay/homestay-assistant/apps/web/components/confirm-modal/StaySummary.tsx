"use client";

import {
  formatPrice,
  formatShortDateForDisplay,
  type PriceBreakdown,
} from "@repo/utils";

export type StaySummaryProps = {
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  guests?: number;
  totalPrice?: number;
  /** When set, itemised price rows are shown above the total. */
  breakdown?: PriceBreakdown & { pricePerNight: number };
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
  breakdown,
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
    {breakdown ? (
      <div className="space-y-1.5 border-t border-border pt-1.5">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">
            {formatPrice(breakdown.pricePerNight)} × {breakdown.nights} night
            {breakdown.nights > 1 ? "s" : ""}
          </dt>
          <dd className="text-right text-foreground">
            {formatPrice(breakdown.roomSubtotal)}
          </dd>
        </div>
        {breakdown.extraGuests > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              Extra guest surcharge ({breakdown.extraGuests})
            </dt>
            <dd className="text-right text-foreground">
              {formatPrice(breakdown.extraGuestSurcharge)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Cleaning fee</dt>
          <dd className="text-right text-foreground">
            {formatPrice(breakdown.cleaningFee)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">
            Tax ({Math.round(breakdown.taxRate * 100)}%)
          </dt>
          <dd className="text-right text-foreground">
            {formatPrice(breakdown.tax)}
          </dd>
        </div>
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
