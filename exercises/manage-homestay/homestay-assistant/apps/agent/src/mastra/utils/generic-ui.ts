/**
 * Model-facing replyHint builders for Generic UI turns.
 * Kept free of path aliases so unit tests can import without the Mastra loader.
 */
import {
  TOOL_PURPOSE,
  type FindRoomPurpose,
  type GetBookingsPurpose,
} from "@repo/constants";

export type FindRoomReplyPurpose = FindRoomPurpose | undefined;
export type FindBookingsReplyStatus = "not_found" | "resolved" | "ambiguous";

/** Companion copy after Room Detail / Booking Form renders. */
export const REPLY_HINT_GET_ROOM_BY_ID =
  'Room Detail / Booking Form Generic UI is already rendered. Reply with exactly ONE very short sentence in the guest\'s language acknowledging that the details are ready or offering help. Do NOT mention the room name, price, capacity, amenities, description, dates, guests, controls, or any previous result. Do NOT use bullets or markdown. English example: "The room details are ready; let me know if you need help."';

/**
 * Companion copy when get_room_by_id resolved a stated guest count that
 * exceeds room.capacity — GetRoomByIdNotice renders BookingUnavailable
 * instead of the Booking Form, mirroring find_room(book_resolve)'s
 * BOOK_RESOLVE_UNAVAILABLE_REPLY_HINT. Reached whenever a named-room BOOK
 * request's roomId is already known (so the model calls get_room_by_id
 * directly instead of find_room(book_resolve)) — e.g. the room was already
 * shown earlier in the conversation — so the same over-capacity guard has to
 * exist here too, not only on the find_room path.
 */
export const REPLY_HINT_GET_ROOM_BY_ID_UNAVAILABLE =
  'BookingUnavailable Generic UI is already rendered and the turn is stopping. Reply with exactly ONE very short sentence in the guest\'s language offering to help — fewer guests, different dates, or another room, whichever fits. Do NOT repeat the room name, reason, capacity, dates, guests, or any availability value — the card shows them. English example: "I can help with a different guest count, other dates, or another room."';

/** Companion copy after compare_rooms paints the RoomComparison surface. */
export const REPLY_HINT_COMPARE_ROOMS_RENDERED =
  'RoomComparison is already rendered from the rooms the guest searched, and the turn is stopping. Reply with exactly ONE very short sentence in the guest\'s language that only points at the comparison. Do NOT mention any room name, price, capacity, availability, amenity, or count. Do NOT use bullets, markdown, or a table. English: "Here is the room comparison." Vietnamese: "Đây là bảng so sánh phòng."';

/** compare_rooms had no searched rooms on screen to compare. */
export const REPLY_HINT_COMPARE_ROOMS_NO_CANDIDATES =
  'Nothing was rendered — no searched rooms are on screen to compare yet. If the guest described what they want (dates / guests / level), call find_room with purpose "search" for it; otherwise reply with ONE short sentence in the guest\'s language asking which rooms they would like to compare. Never call get_room_by_id or invent rooms.';

const buildResolveReplyHint = (matchCount: number): string => {
  switch (matchCount) {
    case 0:
      return (
        "No room matched that name — Room List is suppressed. " +
        "Reply with ONE short sentence that no room by that name exists; " +
        "do NOT call get_bookings. Do NOT invent a roomId."
      );
    case 1:
      return (
        "Room resolved for a booking lookup — Room List is suppressed (do NOT say cards were shown). " +
        "Use rooms[0].id as roomId and continue the pending get_bookings call in the SAME turn — " +
        "do NOT ask the guest to confirm the room name first. " +
        "(Cancel/Modify never take this path — they resolve directly via find_bookings({ roomName }), never find_room.)"
      );
    default:
      return (
        `Multiple rooms matched that name (${matchCount}) — Room List is suppressed. ` +
        "Reply with ONE short sentence naming the matching rooms and asking which one they mean; " +
        "do NOT call get_bookings until they pick."
      );
  }
};

const buildBookResolveReplyHint = (matchCount: number): string => {
  switch (matchCount) {
    case 0:
      return (
        "No room matched that booking name. " +
        "Reply with ONE short sentence that nothing matched; suggest a different room name. " +
        "Do NOT invent rooms."
      );
    case 1:
      return (
        "Room resolved for booking — Room List is suppressed (do NOT say cards were shown). " +
        "The platform already probed availability for this room and deterministically forces the next step " +
        "— you cannot choose a different one: " +
        "confirm_booking when check-in date AND guest count are both known and the room is free (result.availability present with available:true) — " +
        "pass { roomId, checkInDate, guests } from result.availability plus a checkOutDate reflecting any stay length " +
        "stated in the LATEST message (default result.availability.checkOutDate when none was stated); " +
        "OR get_room_by_id to open the Booking Form when either check-in date or guest count is still unknown " +
        "(no result.availability) — pass whichever of checkInDate/guests IS stated as its args so the form opens prefilled. " +
        "Never call check_room_availability — that tool no longer exists. " +
        "When the forced follow-up renders guest-visible Generic UI, include exactly one very short " +
        "companion sentence in the guest's language. Never list room details in text."
      );
    default:
      return (
        `Multiple rooms matched (${matchCount}) — Room cards are rendered so the guest can pick one. ` +
        "Do NOT call any booking tool until a specific room is selected. " +
        "Reply with ONE short sentence asking them to choose. Never list room names in text."
      );
  }
};

const buildBrowseReplyHint = (matchCount: number): string => {
  if (!matchCount) {
    return (
      "No rooms matched. Reply with ONE short sentence that nothing matched and suggest changing " +
      "name/date/guests/level. Do NOT invent rooms. Do NOT say rooms are ready to browse."
    );
  }

  return (
    "Room cards are already rendered in chat — do NOT call find_room again this turn or call update_room_list. " +
    "Reply with exactly ONE very short sentence in the guest's language acknowledging the options. " +
    "Do NOT mention the match count, room names, prices, dates, guests, amenities, or any other card detail. " +
    'Do NOT use bullets or markdown. English example: "Here are the matching rooms."'
  );
};

/**
 * Model-facing hint after find_room. book_resolve + 1 match must not claim
 * cards were rendered (FE suppresses Room List) and must continue BOOK.
 */
export const buildFindRoomReplyHint = (
  matchCount: number,
  purpose: FindRoomReplyPurpose,
): string => {
  switch (purpose) {
    case TOOL_PURPOSE.FIND_ROOM.RESOLVE:
      return buildResolveReplyHint(matchCount);

    case TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE:
      return buildBookResolveReplyHint(matchCount);

    default:
      return buildBrowseReplyHint(matchCount);
  }
};

export type GetBookingsReplyPurpose = GetBookingsPurpose | undefined;

/**
 * Model-facing hint after get_bookings. purpose:"resolve" means the FE
 * suppresses the booking-list card since the HITL that follows (confirm
 * dialog or picker) is the response — not a guest-facing VIEW/LIST turn.
 */
export const buildGetBookingsReplyHint = (
  bookingCount: number,
  purpose: GetBookingsReplyPurpose,
): string => {
  if (purpose === TOOL_PURPOSE.GET_BOOKINGS.RESOLVE) {
    if (!bookingCount) {
      return "No active bookings matched — the booking-list card is suppressed. Reply with ONE short sentence that there are no matching active bookings. Do NOT invent one from chat history.";
    }
    return "Booking-list card is suppressed for this internal resolve fetch — do NOT say cards were shown or list booking details in text. CANCEL: a single match is already fully resolved — go straight to show_cancel_dialog_confirm, do NOT call find_booking_by_id again. MODIFY: call find_booking_by_id (purpose: modify) on a single match to apply the not-modifiable gate. Multiple matches (either workflow) → hand off to the HITL picker (show_cancel_dialog_confirm / show_modify_dialog_select) with all matches — never guess.";
  }

  if (!bookingCount) {
    return "No matching active bookings. Reply with ONE short sentence that there are no matching active bookings.";
  }

  return 'Booking cards are already rendered in chat. Reply with exactly ONE very short sentence in the guest\'s language acknowledging the list or offering help. Do NOT mention the count or restate names, dates, guests, prices, statuses, or IDs. Do NOT use bullets or markdown. English example: "Your current bookings are shown; let me know if you need help."';
};

/**
 * Model-facing hint after find_bookings — the internal cancel/modify booking
 * target resolver. It never renders its own UI; the HITL that follows
 * (show_cancel_dialog_confirm / show_modify_dialog_select, or find_booking_by_id
 * for a single modify match) is the response.
 */
export const buildFindBookingsReplyHint = (
  status: FindBookingsReplyStatus,
  matchCount: number,
): string => {
  switch (status) {
    case "not_found":
      return "No active bookings matched — reply with ONE short sentence that there are no matching active bookings. Do NOT invent one from chat history.";
    case "resolved":
      return "Exactly one active booking matched (result.booking) — this is the resolved target, not a rendered card. CANCEL: go straight to show_cancel_dialog_confirm with this booking, do NOT call find_booking_by_id again. MODIFY: call find_booking_by_id (purpose: modify) with this booking's id to apply the not-modifiable gate.";

    default:
      return `${matchCount} active bookings matched (result.bookings) — never guess. Hand off to the HITL picker (show_cancel_dialog_confirm / show_modify_dialog_select) with all of them and wait.`;
  }
};

// Generic UI model
type MutationOutputRecord = {
  id?: string;
  roomId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
  totalPrice?: number;
  status?: string;
  room?: { name?: string } | null;
  message?: string;
};
enum BookingMutationOperation {
  CREATE = "create",
  UPDATE = "update",
  CANCEL = "cancel",
}

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const asMutationOutputRecord = (output: unknown): MutationOutputRecord => {
  if (!output || typeof output !== "object") {
    return {};
  }

  const record = output as Record<string, unknown>;
  const room =
    record.room && typeof record.room === "object"
      ? { name: asString((record.room as Record<string, unknown>).name) }
      : undefined;

  return {
    id: asString(record.id),
    roomId: asString(record.roomId),
    checkInDate: asString(record.checkInDate),
    checkOutDate: asString(record.checkOutDate),
    guests: asNumber(record.guests),
    totalPrice: asNumber(record.totalPrice),
    status: asString(record.status),
    room,
    message: asString(record.message),
  };
};

const isMutationSuccess = (output: MutationOutputRecord) =>
  typeof output.id === "string" && output.id.trim().length > 0;

/**
 * Fields the frontend needs to recover mutation outcome (bookingId,
 * correlation-key fields, error message) from `agent.messages` — the
 * *persisted* transcript, which carries this same toModelOutput value, not
 * the raw tool output. Included alongside `success`/`roomName`/`replyHint`
 * so CreateBookingNotice/UpdateBookingNotice and
 * deriveCreateBookingOutcomeFromMessages (apps/web) can resolve a booking id
 * after a refresh/remount clears the live Zustand outcome store — the model
 * is still told via replyHint not to narrate any of these.
 */
const pickMutationCorrelationFields = (
  output: MutationOutputRecord,
  success: boolean,
) => {
  const {
    id,
    roomId,
    checkInDate,
    checkOutDate,
    status,
    guests,
    message,
    totalPrice,
  } = output;

  return success
    ? {
        id,
        ...(roomId !== undefined ? { roomId } : {}),
        ...(checkInDate !== undefined ? { checkInDate } : {}),
        ...(checkOutDate !== undefined ? { checkOutDate } : {}),
        ...(guests !== undefined ? { guests } : {}),
        ...(totalPrice !== undefined ? { totalPrice } : {}),
        ...(status !== undefined ? { status } : {}),
      }
    : typeof message === "string"
      ? { message }
      : {};
};

const getMutationRoomName = (output: MutationOutputRecord) => {
  const name = output.room?.name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
};

const SUCCESS_COPY: Record<
  BookingMutationOperation,
  {
    instruction: string;
    withRoom: (roomName: string) => string;
    withoutRoom: string;
  }
> = {
  create: {
    instruction: "confirming that the booking succeeded",
    withRoom: (roomName) => `Your booking for ${roomName} was successful.`,
    withoutRoom: "Your booking was successful.",
  },
  update: {
    instruction: "confirming that the booking was updated",
    withRoom: (roomName) =>
      `Your booking for ${roomName} was successfully updated.`,
    withoutRoom: "Your booking was successfully updated.",
  },
  cancel: {
    instruction: "confirming that the booking was cancelled",
    withRoom: (roomName) =>
      `Your booking for ${roomName} was successfully cancelled.`,
    withoutRoom: "Your booking was successfully cancelled.",
  },
};

/** Success may name the room once; all other booking fields stay hidden. */
const toNamedBookingMutationModelOutput = (
  output: unknown,
  operation: BookingMutationOperation,
) => {
  const record = asMutationOutputRecord(output);
  const success = isMutationSuccess(record);
  const roomName = success ? getMutationRoomName(record) : undefined;
  const copy = SUCCESS_COPY[operation];

  return {
    type: "json" as const,
    value: {
      success,
      ...(roomName ? { roomName } : {}),
      ...pickMutationCorrelationFields(record, success),
      replyHint: success
        ? roomName
          ? `The existing HITL card already shows success. Reply with exactly ONE short sentence in the guest's language ${copy.instruction} and naming roomName exactly once. English pattern: "${copy.withRoom(roomName)}" Do NOT repeat dates, guests, total, status, IDs, or any other card field.`
          : `The existing HITL card already shows success. Reply with exactly ONE short sentence in the guest's language, such as "${copy.withoutRoom}" Do NOT invent a room name or repeat dates, guests, total, status, or IDs.`
        : "The existing HITL card already shows failure. Reply with exactly ONE short retry-oriented sentence in the guest's language. Do NOT repeat raw errors or any card details.",
    },
  };
};

export const toCreateBookingModelOutput = (output: unknown) =>
  toNamedBookingMutationModelOutput(output, BookingMutationOperation.CREATE);

export const toUpdateBookingModelOutput = (output: unknown) =>
  toNamedBookingMutationModelOutput(output, BookingMutationOperation.UPDATE);

export const toCancelBookingModelOutput = (output: unknown) =>
  toNamedBookingMutationModelOutput(output, BookingMutationOperation.CANCEL);
