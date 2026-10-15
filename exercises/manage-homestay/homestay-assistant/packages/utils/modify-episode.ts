/**
 * MODIFY episode scoping for the `confirm_modify_booking` card.
 *
 * Every modify leaves its HITL card mounted in chat, and each card hydrates
 * its booking, room, stays, and mutation outcome from the transcript (the
 * model-authored HITL args are not trusted — see confirm-modify-stay.ts).
 * Those reads used to scan the WHOLE transcript for "the latest" lookup, so
 * consecutive modifies bled into each other:
 *   - modify room A, then room B → B's card showed A's room and stay, and its
 *     Confirm sent B's bookingId with A's dates, which update_booking wrote;
 *   - A's settled card re-hydrated from B's lookup, landed on B's correlation
 *     key, and went back to "Updating booking…" when the guest confirmed B.
 *
 * An episode is the slice of transcript one card owns, anchored on the card's
 * own `confirm_modify_booking` toolCallId:
 *   - backward to the start of its user turn, or to an earlier
 *     `confirm_modify_booking` / `update_booking` (the previous episode's end),
 *     whichever is nearer — this holds the `find_booking_by_id` and
 *     `edit_modify_booking` the step machine forced before the card;
 *   - forward to the next `confirm_modify_booking` — this holds the
 *     `update_booking` attempts that settle the card, including a "Retry" sent
 *     in a later user turn.
 *
 * Only the first occurrence of a toolCallId counts: a call AG-UI replays into
 * a later continuation is not a new position in the flow, so it neither moves
 * a card's anchor nor closes another card's episode.
 */
import { MESSAGE_ROLE, TOOL_KEYS, TOOL_PURPOSE } from "@repo/constants";

import {
  selectFindBookingRow,
  selectProbedModifyStay,
  toConfirmModifyStaySnapshot,
  type ConfirmModifyStaySnapshot,
  type FindBookingByIdResultLike,
  type FindBookingByIdRow,
} from "./confirm-modify-stay.js";
import { parseToolResult } from "./format.js";

export type ModifyEpisodeToolCall = {
  id?: string;
  name?: string;
  function?: { name?: string; arguments?: unknown };
};

/** Minimal AG-UI / CopilotKit transcript message the episode reads. */
export type ModifyEpisodeMessage = {
  role?: string;
  toolCallId?: string;
  content?: unknown;
  toolCalls?: ModifyEpisodeToolCall[];
};

/** The booking this episode's own `find_booking_by_id` resolved. */
export type ModifyEpisodeBooking<TRoom> = {
  bookingId: string;
  roomId?: string;
  room?: TRoom;
  /** Booking's current stay — the "before" of the diff. */
  original: ConfirmModifyStaySnapshot;
  /** Merged stay of a stated change (absent on the edit-form path). */
  proposed?: ConfirmModifyStaySnapshot;
};

export type ModifyEpisodeEdit = {
  /** toolCallId of this episode's `edit_modify_booking` — keys its stay stash. */
  toolCallId: string;
  /** Stay the guest confirmed in the form, when the transcript kept its result. */
  stay?: ConfirmModifyStaySnapshot;
};

export type ModifyEpisodeUpdate = {
  toolCallId: string;
  /** Raw tool result; `null` while the call is still running. */
  result: unknown;
};

export type ModifyEpisode<TRoom> = {
  /** Null when no `find_booking_by_id(modify)` in this episode resolved one booking. */
  booking: ModifyEpisodeBooking<TRoom> | null;
  /** Null on the stated-change path (no edit form in this episode). */
  edit: ModifyEpisodeEdit | null;
  /** Latest `update_booking` attempt for this card, or null before the guest confirms. */
  update: ModifyEpisodeUpdate | null;
};

type ToolCallEvent = {
  messageIndex: number;
  id: string;
  name: string;
  arguments: unknown;
};

type EpisodeWindow = {
  /** In-episode tool calls BEFORE the card, nearest first. */
  before: ToolCallEvent[];
  /** In-episode tool calls AFTER the card, oldest first. */
  after: ToolCallEvent[];
  results: ReadonlyMap<string, unknown>;
};

/** Calls that end an earlier modify episode when scanning back from a card. */
const EPISODE_BOUNDARY_TOOLS: ReadonlySet<string> = new Set([
  TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
  TOOL_KEYS.BOOKING.UPDATE_BOOKING,
]);

/** Every tool call in transcript order, first occurrence of each id only. */
const listToolCallEvents = (
  messages: readonly ModifyEpisodeMessage[],
): ToolCallEvent[] => {
  const events: ToolCallEvent[] = [];
  const seen = new Set<string>();

  messages.forEach((message, messageIndex) => {
    for (const toolCall of message?.toolCalls ?? []) {
      const name = toolCall?.function?.name ?? toolCall?.name;
      if (!toolCall?.id || !name || seen.has(toolCall.id)) {
        continue;
      }

      seen.add(toolCall.id);
      events.push({
        messageIndex,
        id: toolCall.id,
        name,
        arguments: toolCall.function?.arguments,
      });
    }
  });

  return events;
};

const indexToolResults = (
  messages: readonly ModifyEpisodeMessage[],
): Map<string, unknown> => {
  const results = new Map<string, unknown>();

  for (const message of messages) {
    if (
      message?.role === MESSAGE_ROLE.TOOL &&
      message.toolCallId &&
      message.content != null
    ) {
      results.set(message.toolCallId, message.content);
    }
  }

  return results;
};

const locateEpisodeWindow = (
  messages: readonly ModifyEpisodeMessage[] | undefined,
  toolCallId: string | undefined,
): EpisodeWindow | null => {
  if (!messages?.length || !toolCallId) {
    return null;
  }

  const events = listToolCallEvents(messages);
  const cardPosition = events.findIndex((event) => event.id === toolCallId);
  const card = events[cardPosition];
  if (!card) {
    return null;
  }

  let turnStartIndex = 0;
  for (let index = card.messageIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === MESSAGE_ROLE.USER) {
      turnStartIndex = index;
      break;
    }
  }

  const before: ToolCallEvent[] = [];
  for (let position = cardPosition - 1; position >= 0; position -= 1) {
    const event = events[position]!;
    if (
      event.messageIndex < turnStartIndex ||
      EPISODE_BOUNDARY_TOOLS.has(event.name)
    ) {
      break;
    }
    before.push(event);
  }

  const after: ToolCallEvent[] = [];
  for (let position = cardPosition + 1; position < events.length; position += 1) {
    const event = events[position]!;
    if (event.name === TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING) {
      break;
    }
    after.push(event);
  }

  return { before, after, results: indexToolResults(messages) };
};

type JsonRecord = Record<string, unknown>;

const parseRecord = (raw: unknown): JsonRecord | null => {
  const parsed = parseToolResult<JsonRecord>(
    raw as JsonRecord | string | null | undefined,
  );
  return parsed && !Array.isArray(parsed) ? parsed : null;
};

const readTrimmed = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/** A cancel lookup never belongs to a modify episode; unreadable args stay eligible. */
const isModifyLookup = (event: ToolCallEvent): boolean => {
  const purpose = parseRecord(event.arguments)?.purpose;
  return purpose === undefined || purpose === TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY;
};

/**
 * Merged stay for a stated change. A free probe is authoritative. When the
 * probe call itself failed there is no `availability` block, yet the step
 * machine still forces the confirm — rebuild the stay the probe would have
 * checked from the `requested*` values the lookup echoed (it already turned a
 * relative "one more night" into an absolute check-out).
 */
const selectEpisodeProposedStay = (
  result: FindBookingByIdResultLike<unknown>,
  row: FindBookingByIdRow,
): ConfirmModifyStaySnapshot | undefined => {
  if (result.availability) {
    return selectProbedModifyStay(result, row) ?? undefined;
  }

  if (result.stayUnchanged === true) {
    return undefined;
  }

  const checkInDate = readTrimmed(result.requestedCheckInDate);
  const checkOutDate = readTrimmed(result.requestedCheckOutDate);
  const guests =
    typeof result.requestedGuests === "number" ? result.requestedGuests : undefined;
  if (!checkInDate && !checkOutDate && guests === undefined) {
    return undefined;
  }

  return {
    checkInDate: checkInDate ?? row.checkInDate,
    checkOutDate: checkOutDate ?? row.checkOutDate,
    guests: guests ?? row.guests,
  };
};

/**
 * The nearest `find_booking_by_id(modify)` before the card that resolved
 * exactly one booking — the lookup the step machine forced this card (or its
 * edit form) from. `bookingHint` (the model's `args.bookingId`) only chooses
 * between several lookups in one episode; it never selects another episode's
 * booking, and a hint the episode does not contain is ignored — the tool
 * chain, not the model, resolves which booking is being modified.
 */
const selectEpisodeBooking = <TRoom extends { id?: string }>(
  window: EpisodeWindow,
  bookingHint: string | undefined,
): ModifyEpisodeBooking<TRoom> | null => {
  let nearest: ModifyEpisodeBooking<TRoom> | null = null;

  for (const event of window.before) {
    if (event.name !== TOOL_KEYS.BOOKING.FIND_BY_ID || !isModifyLookup(event)) {
      continue;
    }

    const result = parseRecord(window.results.get(event.id)) as
      | FindBookingByIdResultLike<TRoom>
      | null;
    if (!result || result.bookings?.length !== 1) {
      continue;
    }

    const row = selectFindBookingRow(result);
    const bookingId = readTrimmed(row?.bookingId);
    if (!row || !bookingId) {
      continue;
    }

    const booking: ModifyEpisodeBooking<TRoom> = {
      bookingId,
      roomId: readTrimmed(row.roomId) ?? readTrimmed(result.room?.id),
      room: result.room,
      original: toConfirmModifyStaySnapshot(row),
      proposed: selectEpisodeProposedStay(result, row),
    };

    if (!bookingHint || bookingId === bookingHint) {
      return booking;
    }

    nearest ??= booking;
  }

  return nearest;
};

const selectEpisodeEdit = (window: EpisodeWindow): ModifyEpisodeEdit | null => {
  const event = window.before.find(
    (candidate) => candidate.name === TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
  );
  if (!event) {
    return null;
  }

  const result = parseRecord(window.results.get(event.id));
  const checkInDate = readTrimmed(result?.checkInDate);
  const checkOutDate = readTrimmed(result?.checkOutDate);
  const guests = result?.guests;
  const stay =
    result?.confirmed === true &&
    checkInDate &&
    checkOutDate &&
    typeof guests === "number" &&
    guests > 0
      ? { checkInDate, checkOutDate, guests }
      : undefined;

  return { toolCallId: event.id, ...(stay ? { stay } : {}) };
};

/**
 * Latest `update_booking` attempt that settles this card — the newest attempt
 * decides, so a pending Retry reads as submitting again. The call's args may
 * be empty (update_booking is force-called and reads the confirmed stay from a
 * request-context pin), so ownership is positional; the RESULT's booking id —
 * what was actually written — only rules out another booking's update.
 */
const selectEpisodeUpdate = (
  window: EpisodeWindow,
  bookingId: string | undefined,
): ModifyEpisodeUpdate | null => {
  for (let position = window.after.length - 1; position >= 0; position -= 1) {
    const event = window.after[position]!;
    if (event.name !== TOOL_KEYS.BOOKING.UPDATE_BOOKING) {
      continue;
    }

    const result = window.results.get(event.id) ?? null;
    const writtenBookingId = readTrimmed(parseRecord(result)?.id);
    if (bookingId && writtenBookingId && writtenBookingId !== bookingId) {
      continue;
    }

    return { toolCallId: event.id, result };
  }

  return null;
};

/** confirm_modify_booking HITL args the card reads — model-authored, verified before use. */
export type ConfirmModifyCardArgs<TRoom> = {
  bookingId?: string;
  room?: TRoom;
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
  originalCheckInDate?: string;
  originalCheckOutDate?: string;
  originalGuests?: number;
};

/** Stay the guest confirmed in this episode's edit form (the booking-store stash). */
export type ConfirmModifyEditStash = ConfirmModifyStaySnapshot & {
  bookingId: string;
  original: ConfirmModifyStaySnapshot;
};

export type ConfirmModifyCardView<TRoom> = {
  /** Booking the card shows — and the one its Confirm sends to update_booking. */
  bookingId: string;
  room?: TRoom;
  /** Proposed stay; empty / 0 when nothing (not even the args) supplied it. */
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  /** Current stay for the before → after diff; null when unknown. */
  original: ConfirmModifyStaySnapshot | null;
};

const readArgsOriginal = (
  args: ConfirmModifyCardArgs<unknown>,
): ConfirmModifyStaySnapshot | null => {
  const checkInDate = readTrimmed(args.originalCheckInDate);
  const checkOutDate = readTrimmed(args.originalCheckOutDate);
  const guests = args.originalGuests;

  return checkInDate && checkOutDate && typeof guests === "number" && guests > 0
    ? { checkInDate, checkOutDate, guests }
    : null;
};

/**
 * What a `confirm_modify_booking` card shows and confirms. Booking-scoped
 * values come from the card's own episode; the model's args only fill a gap
 * the episode leaves, and `args.room` only when it is that booking's room — a
 * model that just modified room A re-sends A's room on the next card.
 *   - bookingId: episode lookup → args
 *   - room: episode lookup → args (only without a lookup, or same roomId)
 *   - proposed stay: edit-form stash → edit result → stated-change stay → args
 *   - original: episode lookup → edit-form stash → args `original*`
 *
 * `editStash` must be the stash written by THIS episode's edit form (keyed by
 * `episode.edit.toolCallId`); it is also dropped when its booking differs.
 */
export const selectConfirmModifyCardView = <TRoom extends { id?: string }>({
  episode,
  args,
  editStash,
}: {
  episode: ModifyEpisode<TRoom> | null | undefined;
  args: ConfirmModifyCardArgs<TRoom>;
  editStash?: ConfirmModifyEditStash | null;
}): ConfirmModifyCardView<TRoom> => {
  const lookup = episode?.booking ?? null;
  const bookingId = lookup?.bookingId ?? readTrimmed(args.bookingId) ?? "";
  const argsRoomIsBookingRoom =
    !lookup || (args.room?.id != null && args.room.id === lookup.roomId);
  const room = lookup?.room ?? (argsRoomIsBookingRoom ? args.room : undefined);
  const stash = editStash?.bookingId === bookingId ? editStash : null;
  const proposed = stash ?? episode?.edit?.stay ?? lookup?.proposed ?? null;

  return {
    bookingId,
    room,
    checkInDate: proposed?.checkInDate ?? args.checkInDate ?? "",
    checkOutDate: proposed?.checkOutDate ?? args.checkOutDate ?? "",
    guests:
      proposed?.guests ?? (typeof args.guests === "number" ? args.guests : 0),
    original:
      lookup?.original ??
      (stash ? toConfirmModifyStaySnapshot(stash.original) : null) ??
      readArgsOriginal(args),
  };
};

/**
 * Everything a `confirm_modify_booking` card may read from the transcript,
 * limited to its own episode. Null when the card's toolCallId is not in the
 * transcript (nothing is borrowed from other cards in that case either).
 */
export const selectModifyEpisode = <TRoom extends { id?: string }>(
  messages: readonly ModifyEpisodeMessage[] | undefined,
  { toolCallId, bookingId }: { toolCallId?: string; bookingId?: string },
): ModifyEpisode<TRoom> | null => {
  const window = locateEpisodeWindow(messages, toolCallId);
  if (!window) {
    return null;
  }

  const bookingHint = readTrimmed(bookingId);
  const booking = selectEpisodeBooking<TRoom>(window, bookingHint);

  return {
    booking,
    edit: selectEpisodeEdit(window),
    update: selectEpisodeUpdate(window, booking?.bookingId ?? bookingHint),
  };
};
