import {
  getBookingCancelDisplayText,
  getBookingFormDisplayText,
  getBookingModifyDisplayText,
  getBookingStayDisplayText,
  isBookingCancelPrompt,
  isBookingFormPrompt,
  isBookingModifyPrompt,
  isBookingStayPrompt,
  MESSAGE_ROLE,
  PAGE_ROOMS_PROMPT_PREFIX,
  TOOL_KEYS,
  TOOL_PURPOSE,
} from "@repo/constants";
import { getUiActionPromptDisplayText, parseToolResult } from "@repo/utils";

import {
  getLatestFindRoomToolCallIdInCurrentTurn,
  readResolvedFindRoomResult,
  resolveBookResolveUnavailable,
} from "@/features/room/utils";
import {
  readResolvedFindBookingByIdResult,
  resolveModifyResolveUnavailable,
} from "@/features/booking/utils";
import {
  hasLaterToolCallInTurn,
  ROOM_COMPARISON_TOOL_NAMES,
} from "@/features/chatbot/utils/normalize-messages";
import type { MessageLike, ToolCallLike } from "@/features/chatbot/types";

const { ACTION, BOOKING, GET } = TOOL_KEYS;

/** Mastra backend tools — LLM registration keys. */
const MASTRA_BACKEND_TOOL_NAMES = [
  BOOKING.FIND_BY_ID,
  BOOKING.FIND,
  BOOKING.GET,
  BOOKING.CANCEL,
  BOOKING.CREATE_BOOKING,
  BOOKING.UPDATE_BOOKING,
  GET.ROOMS,
  GET.FIND_ROOM,
  GET.COMPARE_ROOMS,
  BOOKING.GET_ROOM_BY_ID,
] as const;

/** Backend tools rendered in chat via useRenderTool. */
const RENDER_BACKEND_TOOLS = [
  BOOKING.GET,
  BOOKING.CANCEL,
  BOOKING.CREATE_BOOKING,
  BOOKING.UPDATE_BOOKING,
  BOOKING.GET_ROOM_BY_ID,
  GET.FIND_ROOM,
  // Renders nothing except a BookingUnavailable card when a MODIFY stated-change
  // availability probe fails (see FindBookingByIdNotice); silent otherwise.
  BOOKING.FIND_BY_ID,
] as const;

/** Legacy kebab/camel ids — kept so old streams stay hidden from chat. */
const LEGACY_HIDDEN_TOOL_NAMES = [
  "create-booking",
  "check-room-availability",
  "get-room",
  "get-rooms",
  "get-bookings",
  "cancelBooking",
  "createBooking",
  "getRoomById",
  "checkRoomAvailability",
  "findBookingById",
  "getBookings",
  "getRooms",
] as const;

/**
 * Room/data tools and page UI actions - hidden from chat; effects render on the
 * page. RoomComparison tools are painted by the auto-mounted A2UI renderer on
 * the `a2ui-surface` activity, so their raw calls never draw a chat row.
 */
export const CHAT_HIDDEN_TOOLS = new Set<string>([
  ACTION.UPDATE_ROOM_LIST,
  GET.ROOMS,
  ...ROOM_COMPARISON_TOOL_NAMES,
  ...LEGACY_HIDDEN_TOOL_NAMES,
  ...MASTRA_BACKEND_TOOL_NAMES.filter(
    (name) => !(RENDER_BACKEND_TOOLS as readonly string[]).includes(name),
  ),
]);

export const CHAT_VISIBLE_GENERATIVE_TOOLS = new Set([
  ACTION.CONFIRM_BOOKING,
  ACTION.EDIT_MODIFY_BOOKING,
  ACTION.CONFIRM_MODIFY_BOOKING,
  BOOKING.SHOW_CANCEL_DIALOG_CONFIRM,
  BOOKING.SHOW_MODIFY_DIALOG_SELECT,
  ...RENDER_BACKEND_TOOLS,
]);

/**
 * Backend tools whose `useRenderTool` component is a headless bridge (always
 * renders null; publishes outcome to a HITL card store instead of drawing
 * chat UI). Their render fn must still mount — that is what runs the side
 * effects — but they must not claim an avatar row / top spacing, or the
 * timeline shows a blank gap where their "widget" would be.
 */
export const CHAT_HEADLESS_MOUNT_TOOLS = new Set([
  BOOKING.CANCEL,
  BOOKING.UPDATE_BOOKING,
  BOOKING.CREATE_BOOKING,
]);

/**
 * Chat-visible tools whose renderer paints a skeleton / spinner as soon as the
 * tool call streams in (status `InProgress`), so the global typing cursor is a
 * duplicate indicator while they run.
 *
 * HITL tools are deliberately excluded: their modal renders nothing until
 * status `Executing` (see hitl-status.ts), so the cursor must stay visible
 * until then — otherwise there is a blank gap between "sent" and the dialog.
 * The cursor suppression falls back to the executing / complete signal for
 * those (see ChatLoadingCursor).
 */
export const CHAT_TOOLS_WITH_INLINE_LOADING = new Set<string>([
  GET.FIND_ROOM,
  BOOKING.GET,
  BOOKING.GET_ROOM_BY_ID,
]);

/**
 * `purpose` values that turn an inline-loading tool into a silent internal
 * lookup: the Notice suppresses its skeleton while running (FindRoomNotice /
 * MyBookingsNotice), so the call must NOT count as an on-screen widget.
 */
const SILENT_RESOLVE_PURPOSES = new Set<string>([
  TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
  TOOL_PURPOSE.FIND_ROOM.RESOLVE,
  TOOL_PURPOSE.GET_BOOKINGS.RESOLVE,
]);

export { PAGE_ROOMS_PROMPT_PREFIX };

export const isPageOnlyGenerativeTool = (toolName: string) =>
  CHAT_HIDDEN_TOOLS.has(toolName);

const readToolCallArgs = (toolCall: ToolCallLike): Record<string, unknown> =>
  parseToolResult<Record<string, unknown>>(
    (toolCall.function?.arguments ?? toolCall.arguments ?? toolCall.args) as
      | Record<string, unknown>
      | string
      | null
      | undefined,
  ) ?? {};

/** Matches `purpose` once its quoted enum value has fully streamed in. */
const STREAMED_PURPOSE_RE =
  /"purpose"\s*:\s*"(search|recommend|book_resolve|resolve|list)"/;

/**
 * `purpose` of a find_room / get_bookings call, tolerant of args that are
 * still streaming. `purpose` is the FIRST property of findRoomInputSchema /
 * getBookingsInputSchema (schema order + strict mode), so it reaches the head
 * of the streamed args JSON well before the object closes — but
 * `parseToolResult` (JSON.parse) only reads complete JSON. Fall back to a
 * literal scan of the raw args string so an internal book_resolve / resolve
 * lookup is identified mid-stream, before its chat row can paint.
 */
const readToolCallPurpose = (toolCall: ToolCallLike): string | undefined => {
  const parsed = readToolCallArgs(toolCall).purpose;
  if (typeof parsed === "string") {
    return parsed;
  }

  const raw = toolCall.function?.arguments ?? toolCall.arguments ?? toolCall.args;
  return typeof raw === "string"
    ? (STREAMED_PURPOSE_RE.exec(raw)?.[1] ?? undefined)
    : undefined;
};

/**
 * True when a tool call draws its own in-progress placeholder the instant it
 * streams in — so the global typing cursor is a duplicate while it runs.
 * `find_room` / `get_bookings` resolve lookups are excluded: they render
 * nothing until (and unless) they resolve.
 */
export const isChatInlineLoadingToolCall = (toolCall: ToolCallLike): boolean => {
  const toolName = toolCall.function?.name;

  if (!toolName || !CHAT_TOOLS_WITH_INLINE_LOADING.has(toolName)) {
    return false;
  }

  if (toolName === GET.FIND_ROOM || toolName === BOOKING.GET) {
    const purpose = readToolCallPurpose(toolCall);
    if (typeof purpose === "string" && SILENT_RESOLVE_PURPOSES.has(purpose)) {
      return false;
    }
  }

  return true;
};

export const isChatHeadlessMountTool = (toolName?: string) =>
  Boolean(toolName) && CHAT_HEADLESS_MOUNT_TOOLS.has(toolName as string);

/** Minimal tool-call shape used by chat rendering. */
export type ChatVisibleToolCall = ToolCallLike;

type ChatMessageForToolVisibility = Pick<
  MessageLike,
  "id" | "role" | "toolCalls" | "content" | "toolCallId"
>;

/**
 * Row count from a resolved find_room / get_bookings `tool` message.
 * `undefined` = no result yet (still resolving) or an unparseable payload.
 */
const readResolvedToolRowCount = (
  toolCallId: string | undefined,
  messages: ChatMessageForToolVisibility[] | undefined,
  key: "rooms" | "bookings",
): number | undefined => {
  if (!toolCallId || !messages) {
    return undefined;
  }

  const resultMessage = messages.find(
    (message) =>
      message.role === MESSAGE_ROLE.TOOL && message.toolCallId === toolCallId,
  );

  if (!resultMessage) {
    return undefined;
  }

  const parsed = parseToolResult<Record<string, unknown>>(
    resultMessage.content as Record<string, unknown> | string | null | undefined,
  );
  const rows = parsed?.[key];

  return Array.isArray(rows) ? rows.length : undefined;
};

/** True once a `tool` result message exists for this tool call. */
const hasResolvedToolResult = (
  toolCallId: string | undefined,
  messages: ChatMessageForToolVisibility[] | undefined,
): boolean =>
  Boolean(
    toolCallId &&
      messages?.some(
        (message) =>
          message.role === MESSAGE_ROLE.TOOL &&
          message.toolCallId === toolCallId,
      ),
  );

/**
 * `confirmed` flag off a resolved HITL `tool` result message, or `undefined`
 * while the call is still awaiting the guest / has no result yet.
 */
const readResolvedHitlConfirmed = (
  toolCallId: string | undefined,
  messages: ChatMessageForToolVisibility[] | undefined,
): boolean | undefined => {
  if (!toolCallId || !messages) {
    return undefined;
  }

  const resultMessage = messages.find(
    (message) =>
      message.role === MESSAGE_ROLE.TOOL && message.toolCallId === toolCallId,
  );

  if (!resultMessage) {
    return undefined;
  }

  const parsed = parseToolResult<{ confirmed?: boolean }>(
    resultMessage.content as
      | { confirmed?: boolean }
      | string
      | null
      | undefined,
  );

  return typeof parsed?.confirmed === "boolean" ? parsed.confirmed : undefined;
};

/**
 * MODIFY-flow HITL tools whose card hides itself the moment the guest approves
 * (`confirmed: true`) because a forced follow-up step is the turn's real
 * response:
 *   - `show_modify_dialog_select` → hidden on a pick; `find_booking_by_id` →
 *     `edit_modify_booking` / `confirm_modify_booking` follows.
 *   - `edit_modify_booking` → hidden on confirm; `confirm_modify_booking`
 *     follows.
 * The declined / kept-all / expired outcomes still render settled copy, so this
 * is scoped to the confirmed path only.
 */
const SELF_HIDING_MODIFY_HANDOFF_TOOLS = new Set<string>([
  BOOKING.SHOW_MODIFY_DIALOG_SELECT,
  ACTION.EDIT_MODIFY_BOOKING,
]);

/**
 * A self-hiding MODIFY hand-off call the guest has already approved: the card
 * renders no DOM, so treat it as a silent internal step — its avatar row
 * collapses and the typing cursor keeps bridging the gap to the next card
 * instead of the chat sitting visibly silent through the resume round-trip.
 */
const isSettledModifyHandoffToolCall = (
  toolCall: ChatVisibleToolCall,
  messages: ChatMessageForToolVisibility[] | undefined,
): boolean => {
  const toolName = toolCall.function?.name;
  if (!toolName || !SELF_HIDING_MODIFY_HANDOFF_TOOLS.has(toolName)) {
    return false;
  }

  const confirmed = readResolvedHitlConfirmed(toolCall.id, messages);

  if (confirmed === true) {
    return true;
  }

  // The result briefly reconciles away after respond(); once the flow has
  // already stepped to the next forced tool the card is gone for good,
  // whatever the hand-off call's own result currently reads.
  return (
    confirmed !== false &&
    hasLaterToolCallInTurn(messages as MessageLike[] | undefined, toolCall.id)
  );
};

/**
 * True when the newest turn is stalled on a self-hiding MODIFY hand-off: the
 * guest approved the pick / edit, the card has hidden itself, and the forced
 * follow-up (`find_booking_by_id` → `edit_modify_booking` /
 * `confirm_modify_booking`) has not streamed in yet. Without a bridge the chat
 * shows nothing — no card, no typing row — for the whole resume round-trip,
 * which reads as the assistant having silently dropped the request.
 * `ChatLoadingCursor` keeps the typing row up while this holds.
 */
export const isAwaitingForcedModifyHandoff = (
  messages: ChatMessageForToolVisibility[] | undefined,
): boolean => {
  if (!messages?.length) {
    return false;
  }

  const turnOwner = [...messages]
    .reverse()
    .find((message) => message.role !== MESSAGE_ROLE.TOOL);

  if (turnOwner?.role !== MESSAGE_ROLE.ASSISTANT) {
    return false;
  }

  return (turnOwner.toolCalls ?? []).some((toolCall) => {
    const toolName = toolCall.function?.name;
    if (!toolName || !SELF_HIDING_MODIFY_HANDOFF_TOOLS.has(toolName)) {
      return false;
    }

    return (
      readResolvedHitlConfirmed(toolCall.id, messages) === true &&
      !hasLaterToolCallInTurn(
        messages as MessageLike[] | undefined,
        toolCall.id,
      )
    );
  });
};

/**
 * True when a chat-visible backend tool call is an internal resolve lookup its
 * Notice renders nothing for — mirrors FindRoomNotice / MyBookingsNotice /
 * FindBookingByIdNotice:
 *
 * - `purpose: "resolve"` (find_room room→id, get_bookings target lookup) — the
 *   Notice is always silent; the HITL / next step is the turn's response.
 * - find_room `purpose: "book_resolve"` — silent while resolving and on exactly
 *   one match (the platform then forces the Booking Form / Confirm card). A
 *   "no match" notice (0), a disambiguation list (>1), or a probe that came
 *   back unavailable (BookingUnavailable card) still renders, so those stay
 *   visible.
 * - `find_booking_by_id` — silent for CANCEL and every MODIFY outcome except a
 *   stated-change availability probe that came back taken / over capacity, when
 *   FindBookingByIdNotice renders BookingUnavailable and the turn stops.
 *
 * Dropping these from getChatVisibleToolCalls collapses the otherwise-empty
 * assistant row (avatar + empty widget slot) deterministically, and lets the
 * typing cursor bridge the gap — instead of leaning on a CSS `:empty` rule that
 * Chromium does not reliably re-evaluate after a skeleton→null transition.
 */
export const isSilentResolveToolCall = (
  toolCall: ChatVisibleToolCall,
  messages: ChatMessageForToolVisibility[] | undefined,
): boolean => {
  const toolName = toolCall.function?.name;

  // find_booking_by_id renders nothing for CANCEL / the no-stated-change MODIFY
  // path / a free stated-change probe (a forced HITL owns the turn). The one
  // visible case: a stated-change probe that came back taken / over capacity →
  // FindBookingByIdNotice renders BookingUnavailable and the turn stops.
  if (toolName === BOOKING.FIND_BY_ID) {
    if (
      !resolveModifyResolveUnavailable(
        readResolvedFindBookingByIdResult(toolCall.id, messages),
      )
    ) {
      return true;
    }
    return hasLaterToolCallInTurn(
      messages as MessageLike[] | undefined,
      toolCall.id,
    );
  }

  if (toolName !== GET.FIND_ROOM && toolName !== BOOKING.GET) {
    return false;
  }

  const purpose = readToolCallPurpose(toolCall);

  if (typeof purpose !== "string" || !SILENT_RESOLVE_PURPOSES.has(purpose)) {
    return false;
  }

  if (purpose !== TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE) {
    return true;
  }

  // The probe came back taken / over capacity → FindRoomNotice renders
  // BookingUnavailable, so keep the row.
  if (
    resolveBookResolveUnavailable(
      readResolvedFindRoomResult(toolCall.id, messages),
    )
  ) {
    return false;
  }

  const roomCount = readResolvedToolRowCount(toolCall.id, messages, "rooms");

  return roomCount === undefined || roomCount === 1;
};

/**
 * Tools whose Notice shows a skeleton while `InProgress` and can then resolve
 * to `null` — the skeleton→null transition the CSS `:empty` backstop does not
 * reliably collapse. When the turn already stepped past such a call (a later
 * tool call exists) its Notice renders nothing, so the row must be dropped.
 *
 * `get_room_by_id` / `find_booking_by_id` are deliberately NOT here: they
 * render `null` from the first paint on the "keep going" path (no transition,
 * so CSS collapses them), and `FindBookingByIdNotice` carries a
 * useLayoutEffect that must still mount for the MODIFY flow.
 */
const SKELETON_ROUTING_TOOLS = new Set<string>([GET.FIND_ROOM, BOOKING.GET]);

/**
 * True when a chat-visible backend tool call produces no visible DOM, so its
 * assistant row would render as just an avatar next to an empty widget slot
 * ("bong bóng rỗng"). Covers:
 *   1. internal resolve lookups (see isSilentResolveToolCall),
 *   2. a skeleton-routing tool the turn already stepped past (a later tool
 *      call exists) — the later step owns the card, and
 *   3. a self-hiding MODIFY HITL hand-off the guest already approved
 *      (see isSettledModifyHandoffToolCall) — its card returns null on
 *      `confirmed: true` while the forced follow-up step runs.
 *
 * Excluding these from getChatVisibleToolCalls collapses the row
 * deterministically and keeps the typing cursor visible to bridge the gap —
 * instead of relying on the CSS `:empty` backstop, which Chromium does not
 * reliably re-evaluate after a skeleton→null transition.
 *
 * Case 2 also has a streaming window: while a routing call's args are
 * still arriving and it has no result yet, `purpose` may not have streamed far
 * enough to tell an internal book_resolve / resolve lookup from a real FIND /
 * RECOMMEND search. Stay silent until it either confirms a list purpose or
 * resolves — a genuine search then renders its Room List on Complete, an
 * internal lookup stays dropped. Without this the row paints a Room List
 * skeleton (issue 1) then an empty avatar row / "bong bóng rỗng" (issue 2)
 * for the ~1 render tick before `purpose` lands.
 */
export const isSilentIntermediateToolCall = (
  toolCall: ChatVisibleToolCall,
  messages: ChatMessageForToolVisibility[] | undefined,
): boolean => {
  if (isSilentResolveToolCall(toolCall, messages)) {
    return true;
  }

  if (isSettledModifyHandoffToolCall(toolCall, messages)) {
    return true;
  }

  const toolName = toolCall.function?.name;

  if (!toolName || !SKELETON_ROUTING_TOOLS.has(toolName)) {
    return false;
  }

  if (
    hasLaterToolCallInTurn(messages as MessageLike[] | undefined, toolCall.id)
  ) {
    return true;
  }

  const purpose = readToolCallPurpose(toolCall);
  const isConfirmedListPurpose =
    purpose === TOOL_PURPOSE.FIND_ROOM.SEARCH ||
    purpose === TOOL_PURPOSE.FIND_ROOM.RECOMMEND ||
    purpose === TOOL_PURPOSE.GET_BOOKINGS.LIST;

  return (
    !isConfirmedListPurpose && !hasResolvedToolResult(toolCall.id, messages)
  );
};

/**
 * Filters toolCalls for chat rendering.
 * When `messages` is provided, keeps only the latest `find_room` in the
 * current turn (`getCurrentTurn` via `getLatestFindRoomToolCallIdInCurrentTurn`)
 * so continuations that replay find_room with a new toolCallId do not stack
 * duplicate cards.
 */
export const getChatVisibleToolCalls = <T extends ChatVisibleToolCall>(
  toolCalls?: T[],
  messages?: ChatMessageForToolVisibility[],
): T[] => {
  if (!toolCalls?.length) {
    return [];
  }

  const seen = new Set<string>();
  const visible = toolCalls.filter((toolCall) => {
    const toolName = toolCall.function?.name;

    if (!toolName || toolCall.function?.arguments === undefined) {
      return false;
    }

    if (isPageOnlyGenerativeTool(toolName)) {
      return false;
    }

    if (!CHAT_VISIBLE_GENERATIVE_TOOLS.has(toolName)) {
      return false;
    }

    if (isSilentIntermediateToolCall(toolCall, messages)) {
      return false;
    }

    if (!toolCall.id || seen.has(toolCall.id)) {
      return false;
    }

    seen.add(toolCall.id);
    return true;
  });

  // Soft-book / find continuations can replay find_room with a new toolCallId —
  // keep only the last find_room card in the current turn (or this message).
  const lastFindRoomId =
    getLatestFindRoomToolCallIdInCurrentTurn(messages) ??
    [...visible]
      .reverse()
      .find((toolCall) => toolCall.function?.name === GET.FIND_ROOM)?.id;

  if (!lastFindRoomId) {
    return visible;
  }

  return visible.filter(
    (toolCall) =>
      toolCall.function?.name !== GET.FIND_ROOM ||
      toolCall.id === lastFindRoomId,
  );
};

export const isHiddenAgentPrompt = (content: string) =>
  content.startsWith(PAGE_ROOMS_PROMPT_PREFIX) ||
  content.startsWith("Load all rooms.") ||
  /^Load rooms for \d{4}-\d{2}-\d{2}\./.test(content);

/**
 * Extracts plain text from AG-UI message content.
 * Handles string, text-part arrays, and missing content (common on tool-only turns).
 *
 * @param content - Message content from the agent runtime
 * @returns Concatenated text, or an empty string when content is absent
 */
export const getMessageTextContent = (content?: unknown) => {
  if (typeof content === "string") {
    return content;
  }

  // Streaming / tool-only assistant turns often omit content entirely.
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((part) => {
      if (!part || typeof part !== "object") {
        return false;
      }

      const candidate = part as { type?: string; text?: string };
      return candidate.type === "text" && Boolean(candidate.text);
    })
    .map((part) => String((part as { text: string }).text))
    .join("");
};

export const getUserVisibleMessageContent = (content: string) => {
  if (isBookingCancelPrompt(content)) {
    return getBookingCancelDisplayText(content);
  }

  if (isBookingModifyPrompt(content)) {
    return getBookingModifyDisplayText(content);
  }

  if (isBookingFormPrompt(content)) {
    return getBookingFormDisplayText(content);
  }

  if (isBookingStayPrompt(content)) {
    return getBookingStayDisplayText(content);
  }

  const uiActionLabel = getUiActionPromptDisplayText(content);
  if (uiActionLabel) {
    return uiActionLabel;
  }

  return content;
};
