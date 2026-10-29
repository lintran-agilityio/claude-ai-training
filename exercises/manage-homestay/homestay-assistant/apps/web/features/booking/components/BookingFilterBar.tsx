"use client";

import { Button } from "@/components/ui/button";
import {
  BookingStatus,
  type BookingFilters,
} from "@/features/booking/types/booking";

const ALL_STATUSES = "all";

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: BookingStatus.PENDING, label: "Pending" },
  { value: BookingStatus.CONFIRMED, label: "Confirmed" },
  { value: BookingStatus.CHECKED_IN, label: "Checked-in" },
  { value: BookingStatus.CHECKED_OUT, label: "Checked-out" },
  { value: BookingStatus.CANCELLED, label: "Cancelled" },
];

const FIELD_CLASS =
  "h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type BookingFilterBarProps = {
  /** Live (un-debounced) values shown in the inputs. */
  filters: BookingFilters;
  onChange: (filters: BookingFilters) => void;
  onClear: () => void;
};

export const BookingFilterBar = ({
  filters,
  onChange,
  onClear,
}: BookingFilterBarProps) => (
  <form
    role="search"
    aria-label="Filter bookings"
    className="mt-6 flex flex-wrap items-end gap-3"
    onSubmit={(event) => event.preventDefault()}
  >
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Room name
      <input
        type="text"
        value={filters.roomName ?? ""}
        placeholder="e.g. Lotus"
        className={FIELD_CLASS}
        onChange={(event) =>
          onChange({ ...filters, roomName: event.target.value })
        }
      />
    </label>
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Check-in
      <input
        type="date"
        value={filters.checkInDate ?? ""}
        className={FIELD_CLASS}
        onChange={(event) =>
          onChange({
            ...filters,
            checkInDate: event.target.value || undefined,
          })
        }
      />
    </label>
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Status
      <select
        value={filters.status ?? ALL_STATUSES}
        className={FIELD_CLASS}
        onChange={(event) =>
          onChange({
            ...filters,
            status:
              STATUS_OPTIONS.find((o) => o.value === event.target.value)
                ?.value ?? undefined,
          })
        }
      >
        <option value={ALL_STATUSES}>All</option>
        {STATUS_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
    <Button type="button" variant="outline" size="lg" onClick={onClear}>
      Clear filters
    </Button>
  </form>
);
