"use client";

import { useMemo } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { AGENT_KEYS, MESSAGE_ROLE, TOOL_KEYS } from "@repo/constants";
import { parseToolResult } from "@repo/utils";

import type { MessageLike } from "@/features/chatbot/types";
import type {
  FindRoomResult,
  GetRoomByIdResult,
  Room,
} from "@/features/room/types/room";
import { useBookingStore } from "@/features/booking/stores/booking-store";

/**
 * `confirm_booking` args carry only `roomId` — the full room never travels
 * through the model. Hydrate it from:
 *   1. the Booking Form's stash (`[book-form]` → form and page BOOK entry), or
 *   2. the `find_room` / `get_room_by_id` tool result already in the transcript
 *      (the skip-form path, where find_room(book_resolve) resolved the room).
 * `null` while neither is available yet — the confirm card stays in a loading
 * state until one resolves.
 */

const ROOM_SOURCE_TOOLS = new Set<string>([
  TOOL_KEYS.GET.FIND_ROOM,
  TOOL_KEYS.BOOKING.GET_ROOM_BY_ID,
]);

const normalizeToolContent = (content: MessageLike["content"]): string | object | null => {
  if (content == null) {
    return null;
  }
  if (typeof content === "string" || !Array.isArray(content)) {
    return content as string | object;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return null;
  }
};

const roomFromToolContent = (
  content: MessageLike["content"],
  roomId: string,
): Room | null => {
  const parsed = parseToolResult<FindRoomResult & GetRoomByIdResult>(
    normalizeToolContent(content) as never,
  );
  if (!parsed) {
    return null;
  }

  const candidates: (Room | null | undefined)[] = [
    parsed.room,
    ...(Array.isArray(parsed.rooms) ? parsed.rooms : []),
  ];

  return candidates.find((room): room is Room => room?.id === roomId) ?? null;
};

const findRoomInTranscript = (
  messages: MessageLike[] | undefined,
  roomId: string,
): Room | null => {
  if (!messages?.length) {
    return null;
  }

  const roomSourceCallIds = new Set<string>();
  for (const message of messages) {
    if (message.role !== MESSAGE_ROLE.ASSISTANT) {
      continue;
    }
    for (const toolCall of message.toolCalls ?? []) {
      const name = toolCall.function?.name ?? toolCall.name;
      if (name && ROOM_SOURCE_TOOLS.has(name) && toolCall.id) {
        roomSourceCallIds.add(toolCall.id);
      }
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message?.role !== MESSAGE_ROLE.TOOL ||
      !message.toolCallId ||
      !roomSourceCallIds.has(message.toolCallId)
    ) {
      continue;
    }

    const room = roomFromToolContent(message.content, roomId);
    if (room) {
      return room;
    }
  }

  return null;
};

export const useConfirmBookingRoom = (roomId?: string): Room | null => {
  const bookingRoom = useBookingStore((state) => state.bookingRoom);
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });
  const messages = agent.messages as MessageLike[] | undefined;

  return useMemo(() => {
    if (!roomId) {
      return null;
    }
    if (bookingRoom?.id === roomId) {
      return bookingRoom;
    }
    return findRoomInTranscript(messages, roomId);
  }, [roomId, bookingRoom, messages]);
};
