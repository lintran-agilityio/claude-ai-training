"use client";

import {
  addDays,
  startOfDay,
  parseDateKey,
  toDateKey,
} from "@repo/utils";
import { DateSelected } from "@/features/room/components/DateSelected";

type RoomBookingDatesProps = {
  checkInDate: string | null;
  checkOutDate: string | null;
  disabled?: boolean;
  onCheckInChange: (dateKey: string) => void;
  onCheckOutChange: (dateKey: string) => void;
};

export const RoomBookingDates = ({
  checkInDate,
  checkOutDate,
  disabled = false,
  onCheckInChange,
  onCheckOutChange,
}: RoomBookingDatesProps) => {
  const checkIn = checkInDate ? parseDateKey(checkInDate) : null;
  const checkOut = checkOutDate ? parseDateKey(checkOutDate) : null;
  const minCheckOut = checkIn ? addDays(checkIn, 1) : startOfDay(new Date());

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/40 p-2">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {disabled ? "Booking dates" : "Select dates"}
      </p>

      <DateSelected
        label="Check-in"
        selectedDate={checkIn}
        minDate={startOfDay(new Date())}
        disabled={disabled}
        onSelect={(date) => onCheckInChange(toDateKey(date))}
      />

      <DateSelected
        label="Check-out"
        selectedDate={checkOut}
        minDate={minCheckOut}
        disabled={disabled}
        onSelect={(date) => onCheckOutChange(toDateKey(date))}
      />
    </div>
  );
};
