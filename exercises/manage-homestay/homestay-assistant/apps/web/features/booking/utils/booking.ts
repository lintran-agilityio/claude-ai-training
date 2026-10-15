import { BookingStatus } from "@repo/types";
import {
  isTimeInFuture,
  isTimeTodayOrLater,
  parseToolResult,
} from "@repo/utils";
import {
  CancelBookingResult,
  CreateBookingResult,
  UpdateBookingResult,
} from "../types";

export type BookingStatusMeta = {
  label: string;
  className: string;
};

const normalizeStatus = (status: string) => status.toUpperCase();

export const getBookingStatusMeta = (status: string): BookingStatusMeta => {
  switch (normalizeStatus(status)) {
    case BookingStatus.CONFIRMED.toUpperCase():
      return {
        label: "Confirmed",
        className: "border-primary/30 bg-primary text-white",
      };
    case BookingStatus.PENDING.toUpperCase():
      return {
        label: "Pending",
        className:
          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case BookingStatus.CANCELLED.toUpperCase():
      return {
        label: "Cancelled",
        className: "border-border bg-muted text-muted-foreground",
      };
    default:
      return {
        label: status,
        className: "border-border bg-muted text-muted-foreground",
      };
  }
};


export const isCancelBookingSuccess = (
  result?: CancelBookingResult | string | null,
) => {
  const parsed = parseToolResult<CancelBookingResult>(result);
  if (!parsed?.id) {
    return false;
  }

  return parsed.status?.toLowerCase() === BookingStatus.CANCELLED.toLowerCase();
};

/** True when createBooking returned a booking id (PENDING or CONFIRMED). */
export const isCreateBookingSuccess = (
  result?: CreateBookingResult | string | null,
) => {
  const parsed = parseToolResult<CreateBookingResult>(result);
  if (!parsed?.id) {
    return false;
  }

  if (!parsed.status) {
    return true;
  }

  const status = parsed.status.toLowerCase();
  return (
    status === BookingStatus.CONFIRMED.toLowerCase() ||
    status === BookingStatus.PENDING.toLowerCase()
  );
};

/** True when update_booking returned a booking id (still active). */
export const isUpdateBookingSuccess = (
  result?: UpdateBookingResult | string | null,
) => {
  const parsed = parseToolResult<UpdateBookingResult>(result);
  if (!parsed?.id) {
    return false;
  }

  if (!parsed.status) {
    return true;
  }

  return parsed.status.toLowerCase() !== BookingStatus.CANCELLED.toLowerCase();
};

export const isBookingCancellable = (status: string, checkOutDate: string) => {
  if (status.toLowerCase() === BookingStatus.CANCELLED) {
    return false;
  }

  return isTimeTodayOrLater(checkOutDate);
};

/**
 * True only while the stay hasn't started yet. Once check-in arrives the
 * stay is in progress (or over), so dates/guests can no longer be modified —
 * cancellation ({@link isBookingCancellable}) is still allowed separately.
 */
export const isBookingModifiable = (status: string, checkInDate: string) => {
  if (status.toLowerCase() === BookingStatus.CANCELLED) {
    return false;
  }

  return isTimeInFuture(checkInDate);
};

/** Required fields for a cancel/modify disambiguation picker row. */
export type BookingPickerFields = {
  bookingId?: string;
  roomName?: string;
  checkInDate?: string;
  checkOutDate?: string;
};

export const hasBookingPickerFields = (booking: BookingPickerFields) =>
  Boolean(
    booking.bookingId?.trim() &&
    booking.roomName?.trim() &&
    booking.checkInDate?.trim() &&
    booking.checkOutDate?.trim(),
  );
