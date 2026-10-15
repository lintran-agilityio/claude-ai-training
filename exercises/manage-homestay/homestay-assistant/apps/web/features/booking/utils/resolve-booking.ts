import type { ModifyBookingPickerItem } from "@repo/schemas";
import { parseToolResult } from "@repo/utils";
import { MESSAGE_ROLE, TOOL_KEYS } from "@repo/constants";
import type { BookingPickerCopy } from "@/features/booking/constants";
import { type HitlDecisionStatus } from "./hitl-status";
import { MessageLike } from "@/features/chatbot/types";
import { HITL_DECISION_STATUS } from "@/constants";

type GetBookingsListItem = {
  id?: string;
  bookingId?: string;
  roomId?: string;
  roomName?: string;
  room?: { name?: string; id?: string };
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
  totalPrice?: number;
};

type GetBookingsToolResult = {
  bookings?: GetBookingsListItem[];
};

/** Title for a settled cancel/modify disambiguation picker (completed state). */
export const resolvePickerCompletedTitle = (
  completed: BookingPickerCopy["completed"],
  decisionStatus: HitlDecisionStatus,
  expiredBySupersede: boolean,
) => {
  const { expiredTitle, rejectedTitle, approvedTitle } = completed;
  if (expiredBySupersede) {
    return expiredTitle;
  }

  if (decisionStatus === HITL_DECISION_STATUS.REJECTED) {
    return rejectedTitle;
  }

  if (decisionStatus === HITL_DECISION_STATUS.APPROVED) {
    return approvedTitle;
  }

  return expiredTitle;
};

const toPickerItem = (
  booking: GetBookingsListItem,
): ModifyBookingPickerItem | null => {
  const bookingId = (booking.bookingId ?? booking.id ?? "").trim();
  const roomName = (booking.roomName ?? booking.room?.name ?? "").trim();
  const roomId = (booking.roomId ?? booking.room?.id ?? "").trim();
  const checkInDate = (booking.checkInDate ?? "").trim();
  const checkOutDate = (booking.checkOutDate ?? "").trim();
  const guests = booking.guests;
  const totalPrice = booking.totalPrice;

  if (
    !bookingId ||
    !roomName ||
    !roomId ||
    !checkInDate ||
    !checkOutDate ||
    typeof guests !== "number" ||
    typeof totalPrice !== "number"
  ) {
    return null;
  }

  return {
    bookingId,
    roomId,
    roomName,
    checkInDate,
    checkOutDate,
    guests,
    totalPrice,
  };
};

const readToolResultContent = (
  messages: MessageLike[],
  toolCallId: string,
): MessageLike["content"] => {
  const toolMessage = messages.find(
    (message) =>
      message.role === MESSAGE_ROLE.TOOL && message.toolCallId === toolCallId,
  );
  return toolMessage?.content ?? null;
};

/**
 * Hydrate modify-picker rows from the latest find_bookings (or legacy
 * get_bookings) tool result in the transcript (presentation only — does not
 * rewrite agent.messages).
 *
 * Used when show_modify_dialog_select passes bookingIds[] (small args) instead
 * of full bookings[] rows that truncate mid-stream.
 */
export const resolveModifyPickerBookingsFromMessages = (
  messages: MessageLike[] | undefined,
  bookingIds?: string[] | null,
): ModifyBookingPickerItem[] => {
  if (!messages?.length) {
    return [];
  }

  const idSet =
    bookingIds && bookingIds.length > 0
      ? new Set(bookingIds.map((id) => id.trim()).filter(Boolean))
      : null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== MESSAGE_ROLE.ASSISTANT) {
      continue;
    }

    for (const toolCall of [...(message.toolCalls ?? [])].reverse()) {
      if (toolCall.function?.name !== TOOL_KEYS.BOOKING.FIND || !toolCall.id) {
        continue;
      }

      const parsed = parseToolResult<GetBookingsToolResult>(
        readToolResultContent(messages, toolCall.id) as
          | GetBookingsToolResult
          | string
          | null,
      );

      const rows = parsed?.bookings;
      if (!Array.isArray(rows) || rows.length === 0) {
        continue;
      }

      const mapped = rows
        .map(toPickerItem)
        .filter((item): item is ModifyBookingPickerItem => item != null);

      if (mapped.length === 0) {
        continue;
      }

      if (!idSet) {
        return mapped;
      }

      const filtered = mapped.filter((item) => idSet.has(item.bookingId));
      return filtered.length > 0 ? filtered : mapped;
    }
  }

  return [];
};
