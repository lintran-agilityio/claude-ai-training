import {
  parseToolResult,
  buildActionPrompt,
  formatShortDateForDisplay,
} from "@repo/utils";
import { MODEL_NAME } from "@repo/types";
import {
  BOOKING_CANCEL_PROMPT_PREFIX,
  BOOKING_FORM_PROMPT_PREFIX,
  BOOKING_MODIFY_PROMPT_PREFIX,
  BOOKING_STAY_PROMPT_PREFIX,
} from "@repo/constants";

import { getFailureMessage } from "@/features/booking/constants";
import type {
  CancelBookingResult,
  CreateBookingResult,
  UpdateBookingResult,
  BookingResponse,
} from "@/features/booking/types";


type BookingErrorShape = {
  message?: BookingErrorField;
  error?: BookingErrorField;
  reason?: BookingErrorField;
};

type BookingErrorField = string | null | undefined;

type BookingFailureResult =
  | CancelBookingResult
  | CreateBookingResult
  | UpdateBookingResult
  | BookingErrorShape
  | string
  | null
  | undefined;

export type BuildBookingStayMessageArgs = {
  roomId: string;
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
};

const readErrorField = (value: BookingErrorField): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveFailureMessage = (
  result: BookingFailureResult,
  fallback: string,
): string => {
  if (result == null) {
    return fallback;
  }

  if (typeof result === "string") {
    const parsed = parseToolResult<BookingErrorShape>(result);
    if (parsed && typeof parsed === "object") {
      return (
        readErrorField(parsed.message) ??
        readErrorField(parsed.error) ??
        readErrorField(parsed.reason) ??
        fallback
      );
    }

    const trimmed = result.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  const shape = result as BookingErrorShape;
  return (
    readErrorField(shape.message) ??
    readErrorField(shape.error) ??
    readErrorField(shape.reason) ??
    fallback
  );
};

/** Guest-facing reason when create_booking completes without a success payload. */
export const getCreateBookingFailureMessage = (
  result?: CreateBookingResult | string | null,
): string =>
  resolveFailureMessage(result, getFailureMessage(MODEL_NAME.CREATE));

/** Guest-facing reason when cancel_booking completes without a success payload. */
export const getCancelBookingFailureMessage = (
  result?: CancelBookingResult | string | null,
): string =>
  resolveFailureMessage(result, getFailureMessage(MODEL_NAME.CANCEL));

/** Guest-facing reason when update_booking completes without a success payload. */
export const getModifyBookingFailureMessage = (
  result?: UpdateBookingResult | string | null,
): string =>
  resolveFailureMessage(result, getFailureMessage(MODEL_NAME.MODIFY));

/** Agent priority trigger: always runs availability → confirm_booking (never get_room_by_id). */
export const buildBookingStayMessage = ({
  roomId,
  roomName,
  checkInDate,
  checkOutDate,
  guests,
}: BuildBookingStayMessageArgs) => {
  const guestLabel = guests === 1 ? "1 guest" : `${guests} guests`;
  const display = `Book ${roomName} (${checkInDate} → ${checkOutDate}, ${guestLabel}).`;

  return `${BOOKING_STAY_PROMPT_PREFIX} roomId: ${roomId}. checkInDate: ${checkInDate}. checkOutDate: ${checkOutDate}. guests: ${guests}. ${display}`;
};

export const buildBookingFormMessage = (
  roomId: string,
  roomName: string,
  artifactId?: string,
) =>
  `${BOOKING_FORM_PROMPT_PREFIX} ${buildActionPrompt({
    action: "Show booking form for",
    targetName: roomName || "this room",
    identifiers: artifactId ? { roomId, artifactId } : { roomId },
  })}`;

export const buildBookingCancelMessage = (booking: BookingResponse) => {
  const room = booking.room!;
  const checkIn = formatShortDateForDisplay(booking.checkInDate);
  const checkOut = formatShortDateForDisplay(booking.checkOutDate);
  const display = `Please confirm cancellation of my booking for ${room.name} (${checkIn} → ${checkOut}).`;

  return `${BOOKING_CANCEL_PROMPT_PREFIX} bookingId: ${booking.id}. ${display}`;
};

export const buildBookingModifyMessage = (booking: BookingResponse) => {
  const { id } = booking;
  const room = booking.room!;
  // Intentionally NO dates / guests here: the Modify button opens the edit form
  // so the guest can choose what to change. Restating the current stay let the
  // model read it as a stated change and skip the form straight to
  // confirm_modify_booking with an unintended one-day shift.
  const display = `I want to modify my booking for ${room.name}.`;

  return `${BOOKING_MODIFY_PROMPT_PREFIX} bookingId: ${id}. ${display}`;
};
