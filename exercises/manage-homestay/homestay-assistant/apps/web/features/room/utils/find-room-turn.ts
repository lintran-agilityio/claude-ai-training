import { MESSAGE_ROLE, TOOL_KEYS, TOOL_PURPOSE } from "@repo/constants";
import { getCurrentTurn, parseToolResult } from "@repo/utils";

import type { MessageLike } from "@/features/chatbot/types";
import { hasLaterToolCallInTurn } from "@/features/chatbot/utils";
import type {
  FindRoomAvailability,
  FindRoomResult,
} from "@/features/room/types/room";

const FIND_ROOM = TOOL_KEYS.GET.FIND_ROOM;

/**
 * book_resolve + exactly one match whose availability probe (the CREATE flow's
 * replacement for a check_room_availability call) came back taken / over
 * capacity. `FindRoomNotice` renders `BookingUnavailable` for this case, so the
 * tool row must NOT be dropped as a silent internal lookup. Returns the probe
 * result (for the card) or `null`.
 */
export const resolveBookResolveUnavailable = (
  parsed: FindRoomResult | null | undefined,
): FindRoomAvailability | null => {
  if (
    parsed?.purpose !== TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE ||
    (parsed.rooms?.length ?? 0) !== 1
  ) {
    return null;
  }
  const availability = parsed.availability;
  if (!availability) {
    return null;
  }
  return availability.available === false ||
    availability.guestsWithinCapacity === false
    ? availability
    : null;
};

/** Parse a resolved `find_room` `tool` result message by tool-call id. */
export const readResolvedFindRoomResult = (
  toolCallId: string | undefined,
  messages: readonly MessageLike[] | undefined,
): FindRoomResult | null => {
  if (!toolCallId || !messages) {
    return null;
  }
  const resultMessage = messages.find(
    (message) =>
      message.role === MESSAGE_ROLE.TOOL && message.toolCallId === toolCallId,
  );
  return resultMessage
    ? parseToolResult<FindRoomResult>(
        resultMessage.content as FindRoomResult | string | null | undefined,
      )
    : null;
};

/**
 * True when this turn already invoked `find_room` (cards render via
 * FindRoomNotice). Used to no-op `update_room_list` so the model cannot
 * double-render the room list after a search.
 *
 * Temporary UI compatibility for duplicate tool emissions / replay — prefer
 * fixing transcript uniqueness in AG-UI (`stream-patch`) or Mastra, then
 * remove this guard.
 */
export const hasFindRoomInCurrentTurn = (
  messages: MessageLike[] | undefined,
): boolean => {
  if (!messages?.length) {
    return false;
  }

  return getCurrentTurn(messages).some((message) =>
    message.toolCalls?.some(
      (toolCall) => toolCall.function?.name === FIND_ROOM,
    ),
  );
};

/**
 * Latest `find_room` toolCallId in the current turn (across all assistant
 * messages). Used to keep a single FindRoomNotice when continuations replay
 * find_room with a new id.
 *
 * Temporary card-dedupe compatibility; phase out when replay stops emitting
 * duplicate find_room tool calls for one turn.
 */
export const getLatestFindRoomToolCallIdInCurrentTurn = (
  messages: MessageLike[] | undefined,
): string | undefined => {
  if (!messages?.length) {
    return undefined;
  }

  let lastId: string | undefined;

  for (const message of getCurrentTurn(messages)) {
    for (const toolCall of message.toolCalls ?? []) {
      if (toolCall.function?.name === FIND_ROOM && toolCall.id) {
        lastId = toolCall.id;
      }
    }
  }

  return lastId;
};

/**
 * True when a tool call is an internal "resolve" lookup rather than a
 * guest-facing answer: either it was called with the resolve purpose, or
 * another tool ran later in the same turn (get_bookings, find_booking_by_id,
 * a picker, a confirm dialog, ...) even if the call forgot to pass purpose.
 * Shared by FindRoomNotice (find_room) and MyBookingsNotice (get_bookings),
 * whose resolve-visibility rules are otherwise identical.
 */
export const shouldSuppressForResolve = <TPurpose>(
  purpose: TPurpose | undefined,
  resolvePurpose: TPurpose,
  messages: MessageLike[] | undefined,
  toolCallId: string | undefined,
) => purpose === resolvePurpose || hasLaterToolCallInTurn(messages, toolCallId);
