import {
  countNightOfDates,
  formatPrice,
  formatShortDateForDisplay,
} from "@repo/utils";

import type { ModifyStaySnapshot } from "@/features/booking/types";

export type ModifyChangeRow = {
  label: string;
  from: string;
  to: string;
};

export type CreateStayCorrelationKeyInput = {
  roomId?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  guests?: number | null;
};

const calculateStayTotal = (
  stay: ModifyStaySnapshot,
  pricePerNight: number,
): number =>
  countNightOfDates(stay.checkInDate, stay.checkOutDate) * pricePerNight;

const changeRow = (
  label: string,
  from: string,
  to: string,
): ModifyChangeRow | null =>
  from === to ? null : { label, from, to };

export const buildModifyChangeRows = (
  original: ModifyStaySnapshot,
  next: ModifyStaySnapshot,
  pricePerNight: number,
): ModifyChangeRow[] => {
  const originalTotal = calculateStayTotal(original, pricePerNight);
  const nextTotal = calculateStayTotal(next, pricePerNight);

  return [
    changeRow(
      "Guests",
      String(original.guests),
      String(next.guests),
    ),

    changeRow(
      "Check-in",
      formatShortDateForDisplay(original.checkInDate),
      formatShortDateForDisplay(next.checkInDate),
    ),

    changeRow(
      "Check-out",
      formatShortDateForDisplay(original.checkOutDate),
      formatShortDateForDisplay(next.checkOutDate),
    ),

    changeRow(
      "Total",
      formatPrice(originalTotal) ?? String(originalTotal),
      formatPrice(nextTotal) ?? String(nextTotal),
    ),
  ].filter((row): row is ModifyChangeRow => row !== null);
};

/**
 * Stable key correlating show_cancel_dialog_confirm HITL with cancel_booking.
 * Prefer exact key match; store falls back to latest pending when args drift.
 */
export const buildCancelBookingCorrelationKey = (
  bookingId?: string | null,
): string | null => {
  const id = bookingId?.trim();
  return id ? id : null;
};

/**
 * Stable key correlating confirm_booking HITL with create_booking results.
 * Prefer exact key match; store falls back to latest pending when args drift.
 */
export const buildCreateStayCorrelationKey = (
  input: CreateStayCorrelationKeyInput,
): string | null => {
  const roomId = input.roomId?.trim();
  const checkInDate = input.checkInDate?.trim();
  const checkOutDate = input.checkOutDate?.trim();
  const guests = Number(input.guests);

  if (
    !roomId ||
    !checkInDate ||
    !checkOutDate ||
    !Number.isFinite(guests) ||
    guests <= 0
  ) {
    return null;
  }

  return `${roomId}|${checkInDate}|${checkOutDate}|${guests}`;
};
