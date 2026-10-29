"use client";

import { formatPrice, formatShortDateForDisplay, parseDateKey, toDateKey } from "@repo/utils";
import type { RoomAvailabilityOverview } from "@repo/schemas";
import { DateSelected } from "@/features/room/components/DateSelected";

type RoomAvailabilityCardProps = {
  overview: RoomAvailabilityOverview;
  /** Called with the picked YYYY-MM-DD date. */
  onDateChange: (date: string) => void;
  disabled?: boolean;
};

/**
 * Read-only room availability for a date. "Booked" renders only when the API
 * sent `booked` (managers) — its absence is never treated as "nothing booked".
 * There is deliberately no Book action here.
 */
export const RoomAvailabilityCard = ({
  overview,
  onDateChange,
  disabled = false,
}: RoomAvailabilityCardProps) => {
  const { available, booked, summary } = overview;

  return (
    <div className="space-y-3 p-3.5" data-testid="room-availability-card">
      <DateSelected
        label="Date"
        selectedDate={parseDateKey(overview.date)}
        disabled={disabled}
        onSelect={(date) => onDateChange(toDateKey(date))}
      />

      <p className="text-xs text-muted-foreground">
        {summary.availableCount} available · {summary.bookedCount} booked ·{" "}
        {summary.total} total
      </p>

      <section aria-label="Available rooms" className="space-y-1.5">
        <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Available
        </h3>
        {available.length ? (
          <ul className="space-y-1">
            {available.map((room) => (
              <li
                key={room.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5"
              >
                <span className="font-medium">{room.name}</span>
                <span className="text-xs text-muted-foreground">
                  {room.capacity} guests · {formatPrice(room.pricePerNight)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No rooms are free on this date.</p>
        )}
      </section>

      {booked ? (
        <section aria-label="Booked rooms" className="space-y-1.5">
          <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Booked
          </h3>
          {booked.length ? (
            <ul className="space-y-1">
              {booked.map((entry) => (
                <li
                  key={entry.bookingId}
                  className="rounded-lg border border-border px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{entry.room.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.guestName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatShortDateForDisplay(entry.checkInDate)} →{" "}
                    {formatShortDateForDisplay(entry.checkOutDate)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No bookings on this date.</p>
          )}
        </section>
      ) : null}
    </div>
  );
};
