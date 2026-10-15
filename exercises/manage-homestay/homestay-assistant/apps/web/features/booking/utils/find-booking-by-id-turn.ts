import { MESSAGE_ROLE } from "@repo/constants";
import { parseToolResult } from "@repo/utils";

import type { MessageLike } from "@/features/chatbot/types";
import type {
  FindBookingByIdResult,
  ModifyAvailability,
} from "@/features/booking/types";

/**
 * `find_booking_by_id(purpose:"modify")` stated-change path whose availability
 * probe (the MODIFY flow's replacement for a `check_room_availability` call)
 * came back taken / over capacity. `FindBookingByIdNotice` renders
 * `BookingUnavailable` for this case, so the tool row must NOT be dropped as a
 * silent internal lookup. Returns the probe result (for the card) or `null`.
 */
export const resolveModifyResolveUnavailable = (
  parsed: FindBookingByIdResult | null | undefined,
): ModifyAvailability | null => {
  const availability = parsed?.availability;
  if (!availability) {
    return null;
  }
  return availability.available === false ||
    availability.guestsWithinCapacity === false
    ? availability
    : null;
};

/** Parse a resolved `find_booking_by_id` `tool` result message by tool-call id. */
export const readResolvedFindBookingByIdResult = (
  toolCallId: string | undefined,
  messages: readonly MessageLike[] | undefined,
): FindBookingByIdResult | null => {
  if (!toolCallId || !messages) {
    return null;
  }
  const resultMessage = messages.find(
    (message) =>
      message.role === MESSAGE_ROLE.TOOL && message.toolCallId === toolCallId,
  );
  return resultMessage
    ? parseToolResult<FindBookingByIdResult>(
        resultMessage.content as
          | FindBookingByIdResult
          | string
          | null
          | undefined,
      )
    : null;
};
