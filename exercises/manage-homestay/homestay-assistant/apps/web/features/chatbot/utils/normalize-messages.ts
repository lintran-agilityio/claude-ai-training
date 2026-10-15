import {
  HITL_TOOL_NAMES,
  MESSAGE_ROLE,
  MessageRole,
  TOOL_KEYS,
  VIETNAMESE_LETTER,
} from "@repo/constants";
import { getCurrentTurnStartIndex, parseToolResult } from "@repo/utils";
import type {
  ChatToolCall,
  MessageLike,
  ToolArgumentsLike,
  ToolCallLike,
} from "@/features/chatbot/types";

const EMPTY_JSON_OBJECT = "{}";

const toArgumentsString = (value: ToolArgumentsLike) => {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined || value === null) {
    return EMPTY_JSON_OBJECT;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return EMPTY_JSON_OBJECT;
};

const extractFirstJsonObject = (args: string): string => {
  const start = args.indexOf("{");

  if (start === -1) {
    return EMPTY_JSON_OBJECT;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < args.length; index += 1) {
    const char = args[index];

    if (inString) {
      if (char === '"' && !escaped) {
        inString = false;
      }

      escaped = char === "\\" && !escaped;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return args.slice(start, index + 1);
      }
    }
  }

  return EMPTY_JSON_OBJECT;
};

const sanitizeToolArguments = (value: ToolArgumentsLike) => {
  const args = toArgumentsString(value).trim();

  if (!args) {
    return EMPTY_JSON_OBJECT;
  }

  try {
    JSON.parse(args);
    return args;
  } catch {
    const candidate = extractFirstJsonObject(args);

    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      return EMPTY_JSON_OBJECT;
    }
  }
};

const isNormalizedToolCall = (
  toolCall: ToolCallLike,
): toolCall is ChatToolCall =>
  typeof toolCall.id === "string" &&
  toolCall.type === "function" &&
  typeof toolCall.function === "object" &&
  toolCall.function !== null &&
  typeof toolCall.function.name === "string" &&
  typeof toolCall.function.arguments === "string";

const normalizeToolCall = (
  toolCall: ToolCallLike | null | undefined,
): ChatToolCall | null => {
  if (!toolCall || typeof toolCall !== "object") {
    return null;
  }

  const id = toolCall.id;

  if (typeof id !== "string") {
    return null;
  }

  if (toolCall.function && typeof toolCall.function === "object") {
    const fn = toolCall.function;

    if (typeof fn.name === "string") {
      const argumentsValue = sanitizeToolArguments(fn.arguments);

      // Already in AG-UI shape — keep the original reference so repeated
      // normalize passes do not churn object identity / JSON key order.
      if (isNormalizedToolCall(toolCall) && fn.arguments === argumentsValue) {
        return toolCall;
      }

      return {
        id,
        type: "function",
        function: {
          name: fn.name,
          arguments: argumentsValue,
        },
      };
    }
  }

  if (typeof toolCall.name === "string") {
    return {
      id,
      type: "function",
      function: {
        name: toolCall.name,
        arguments: sanitizeToolArguments(toolCall.arguments ?? toolCall.args),
      },
    };
  }

  return null;
};

const normalizeMessage = <TMessage extends MessageLike>(
  message: TMessage,
): TMessage => {
  const rawToolCalls = message.toolCalls;

  if (message.role !== MESSAGE_ROLE.ASSISTANT || !Array.isArray(rawToolCalls)) {
    return message;
  }

  // AG-UI often materializes `toolCalls: []`. Deleting that key made
  // AgentMessagesSanitizer fight the runtime (setMessages → empty array
  // restored → normalize again → Maximum update depth exceeded).
  if (rawToolCalls.length === 0) {
    return message;
  }

  const toolCalls = rawToolCalls
    .map(normalizeToolCall)
    .filter((toolCall): toolCall is ChatToolCall => toolCall !== null);

  if (!toolCalls.length) {
    return message;
  }

  const unchanged =
    toolCalls.length === rawToolCalls.length &&
    toolCalls.every((toolCall, index) => toolCall === rawToolCalls[index]);

  if (unchanged) {
    return message;
  }

  return {
    ...message,
    toolCalls,
  } as TMessage;
};

const getMessageContent = (message: Pick<MessageLike, "content">) => {
  if (typeof message.content === "string") {
    return message.content;
  }

  return "";
};

const hasToolCalls = (message: Pick<MessageLike, "toolCalls">) =>
  Array.isArray(message.toolCalls) && message.toolCalls.length > 0;

const toolCallName = (call: ToolCallLike): string | undefined =>
  call.function?.name ?? call.name;

export const normalize = (value: string) => {
  return value
    .trim()
    .replace(/[^\w\s]/g, "")
    .toLocaleLowerCase();
};

type IdentifiedMessage = MessageLike & { id: string };

const mergeAssistantDuplicates = <TMessage extends IdentifiedMessage>(
  existing: TMessage,
  incoming: TMessage,
): TMessage => {
  const existingContent = getMessageContent(existing).trim();
  const incomingContent = getMessageContent(incoming).trim();
  // Prefer non-empty text so hydration/live races do not wipe a finished reply.
  const content =
    incomingContent ||
    existingContent ||
    getMessageContent(incoming) ||
    getMessageContent(existing);

  const existingToolCalls = Array.isArray(existing.toolCalls)
    ? existing.toolCalls
    : undefined;
  const incomingToolCalls = Array.isArray(incoming.toolCalls)
    ? incoming.toolCalls
    : undefined;
  const toolCalls =
    (incomingToolCalls?.length ? incomingToolCalls : undefined) ??
    (existingToolCalls?.length ? existingToolCalls : undefined);

  return {
    ...existing,
    ...incoming,
    content,
    ...(toolCalls ? { toolCalls } : {}),
  };
};

/**
 * Collapse same-id rows (stream + reconnect/hydration can append a duplicate
 * with the same id). Assistant pairs keep the richer content/toolCalls.
 * Preserves first-seen order.
 */
export const dedupeMessagesById = <TMessage extends MessageLike>(
  messages: TMessage[],
): TMessage[] => {
  const result: TMessage[] = [];
  const indexById = new Map<string, number>();

  for (const message of messages) {
    if (typeof message.id !== "string" || !message.id) {
      result.push(message);
      continue;
    }

    const existingIndex = indexById.get(message.id);

    if (existingIndex === undefined) {
      indexById.set(message.id, result.length);
      result.push(message);
      continue;
    }

    const existing = result[existingIndex]!;

    if (
      message.role === MESSAGE_ROLE.ASSISTANT &&
      existing.role === MESSAGE_ROLE.ASSISTANT
    ) {
      result[existingIndex] = mergeAssistantDuplicates(
        existing as TMessage & IdentifiedMessage,
        message as TMessage & IdentifiedMessage,
      );
      continue;
    }

    result[existingIndex] = message;
  }

  return result;
};

/**
 * Drop consecutive assistant text twins (stream split / replay) that share the
 * same normalized text and have no toolCalls. Distinct tool turns stay intact.
 */
export const collapseConsecutiveIdenticalAssistants = <
  TMessage extends MessageLike,
>(
  messages: TMessage[],
): TMessage[] => {
  if (messages.length < 2) {
    return messages;
  }

  const result: TMessage[] = [];

  for (const message of messages) {
    const previous = result.at(-1);

    if (
      previous?.role === MESSAGE_ROLE.ASSISTANT &&
      message.role === MESSAGE_ROLE.ASSISTANT &&
      !hasToolCalls(previous) &&
      !hasToolCalls(message)
    ) {
      const previousText = normalize(getMessageContent(previous));
      const nextText = normalize(getMessageContent(message));

      if (previousText.length > 0 && previousText === nextText) {
        // Keep the later row (usually the completed stream).
        result[result.length - 1] = message;
        continue;
      }
    }

    result.push(message);
  }

  return result;
};

/**
 * Merge live agent messages with hydrated thread history.
 * Same-id assistant rows keep the richer content/toolCalls instead of
 * letting an empty hydration payload overwrite a finished reply.
 */
export const mergeHydratedMessages = <TMessage extends IdentifiedMessage>(
  liveMessages: TMessage[],
  hydratedMessages: TMessage[],
): TMessage[] => {
  if (!liveMessages.length) {
    return hydratedMessages;
  }

  if (!hydratedMessages.length) {
    return liveMessages;
  }

  const byId = new Map<string, TMessage>();

  for (const message of hydratedMessages) {
    byId.set(message.id, message);
  }

  for (const message of liveMessages) {
    const existing = byId.get(message.id);

    if (!existing) {
      byId.set(message.id, message);
      continue;
    }

    if (
      message.role === MESSAGE_ROLE.ASSISTANT &&
      existing.role === MESSAGE_ROLE.ASSISTANT
    ) {
      byId.set(message.id, mergeAssistantDuplicates(existing, message));
      continue;
    }

    byId.set(message.id, message);
  }

  const orderedIds: string[] = [];
  const seen = new Set<string>();

  for (const message of [...hydratedMessages, ...liveMessages]) {
    if (seen.has(message.id)) {
      continue;
    }

    seen.add(message.id);
    orderedIds.push(message.id);
  }

  return orderedIds.map((id) => byId.get(id)!);
};

/**
 * Strip unanswered HITL calls from past turns. An unanswered HITL call *is* an
 * open dialog; one left by a Stop can never be answered once the guest moves
 * on, and would re-open beside the next turn's reply. The current turn is kept.
 */
const dropAbandonedHitlToolCalls = <TMessage extends MessageLike>(
  messages: TMessage[],
): TMessage[] => {
  const turnStartIndex = getCurrentTurnStartIndex(messages);

  if (turnStartIndex <= 0) {
    return messages;
  }

  const answeredToolCallIds = new Set<string>();

  for (const message of messages) {
    if (message.role === MESSAGE_ROLE.TOOL && message.toolCallId) {
      answeredToolCallIds.add(message.toolCallId);
    }
  }

  const isAbandonedHitlCall = (call: ToolCallLike) => {
    const name = toolCallName(call);

    return (
      !!name &&
      HITL_TOOL_NAMES.has(name) &&
      !(call.id && answeredToolCallIds.has(call.id))
    );
  };

  const result: TMessage[] = [];
  let changed = false;

  messages.forEach((message, index) => {
    const toolCalls = message.toolCalls ?? [];

    if (
      index >= turnStartIndex ||
      message.role !== MESSAGE_ROLE.ASSISTANT ||
      !toolCalls.some(isAbandonedHitlCall)
    ) {
      result.push(message);
      return;
    }

    changed = true;
    const keptToolCalls = toolCalls.filter(
      (call) => !isAbandonedHitlCall(call),
    );

    // A tool-only row with nothing left renders as an empty bubble — drop it.
    if (!keptToolCalls.length && !getMessageContent(message).trim()) {
      return;
    }

    result.push({ ...message, toolCalls: keptToolCalls } as TMessage);
  });

  return changed ? result : messages;
};

export const normalizeMessages = <TMessage extends MessageLike>(
  messages: TMessage[],
): TMessage[] =>
  dropAbandonedHitlToolCalls(
    collapseConsecutiveIdenticalAssistants(
      dedupeMessagesById(messages.map(normalizeMessage)),
    ),
  );

type ChatMessageLike = {
  id: string;
  role: string;
};

const GROUPED_TOP_SPACING = "pt-1.5";
const DEFAULT_TOP_SPACING = "pt-4";
/** Embedded widgets sit slightly apart from conversation bubbles. */
const WIDGET_TOP_SPACING = "pt-3";

const isSameSenderGroup = (
  currentRole: Extract<MessageRole, "user" | "assistant">,
  previousRole: ChatMessageLike["role"] | undefined,
) => {
  if (!previousRole) {
    return false;
  }

  if (currentRole === MESSAGE_ROLE.USER) {
    return previousRole === MESSAGE_ROLE.USER;
  }

  return (
    previousRole === MESSAGE_ROLE.ASSISTANT || previousRole === "reasoning"
  );
};

type MessageTopSpacingOptions = {
  /** Tool-only assistant turn — treat as widget block, not a grouped bubble. */
  widgetOnly?: boolean;
};

export const getMessageTopSpacing = (
  messages: ChatMessageLike[] | undefined,
  messageId: string,
  role: Extract<MessageRole, "user" | "assistant">,
  options?: MessageTopSpacingOptions,
) => {
  if (!messages?.length) {
    return options?.widgetOnly ? WIDGET_TOP_SPACING : DEFAULT_TOP_SPACING;
  }

  const index = messages.findIndex((message) => message.id === messageId);
  if (index <= 0) {
    return options?.widgetOnly ? WIDGET_TOP_SPACING : DEFAULT_TOP_SPACING;
  }

  if (options?.widgetOnly) {
    return WIDGET_TOP_SPACING;
  }

  // `reasoning` rows render nothing in this chat (see ChatReasoningMessage), so
  // walk back past them to the real previous bubble — otherwise a reply lands
  // tight under an invisible row instead of a normal gap below the user turn.
  let previousIndex = index - 1;
  while (previousIndex >= 0 && messages[previousIndex]?.role === "reasoning") {
    previousIndex -= 1;
  }

  const previousRole = messages[previousIndex]?.role;
  return isSameSenderGroup(role, previousRole)
    ? GROUPED_TOP_SPACING
    : DEFAULT_TOP_SPACING;
};

/**
 * True when another tool ran later in the same turn (before the next user
 * message) after the given tool call. A guest-facing answer (Room List,
 * booking-list) is always the LAST tool call of its turn; an internal
 * resolve-style lookup (find_room / get_bookings with purpose:"resolve") is
 * always followed by more tool activity (get_bookings, find_booking_by_id, a
 * picker, a confirm dialog, ...) once its result comes back. Used as a
 * determinism fallback so a resolve-purpose card stays hidden even if a call
 * forgot to pass purpose.
 *
 * Only counts activity in a LATER assistant message, never a co-occurring
 * call in the same message: every real resolve chain needs the previous
 * step's result (a roomId, a bookingId) before the next tool can be called,
 * so it can never be emitted as a parallel call alongside this one — a
 * parallel call in the same message is always an unrelated request (e.g.
 * "show rooms and my bookings" batching find_room + get_bookings together),
 * not evidence this call was a resolve lookup.
 */
export const hasLaterToolCallInTurn = (
  messages: MessageLike[] | undefined,
  toolCallId: string | undefined,
): boolean => {
  if (!messages?.length || !toolCallId) {
    return false;
  }

  const callIndex = messages.findIndex(
    (message) =>
      message.role === MESSAGE_ROLE.ASSISTANT &&
      (message.toolCalls ?? []).some((call) => call.id === toolCallId),
  );

  if (callIndex < 0) {
    return false;
  }

  for (let index = callIndex + 1; index < messages.length; index += 1) {
    const message = messages[index];
    if (message?.role === MESSAGE_ROLE.USER) {
      return false;
    }
    if (
      message?.role === MESSAGE_ROLE.ASSISTANT &&
      (message.toolCalls ?? []).length > 0
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Tool calls whose turn paints the RoomComparison A2UI surface (the only
 * catalog surface). `compare_rooms` returns the surface as an
 * `a2ui_operations` envelope the auto-mounted A2UI renderer paints on the
 * `a2ui-surface` activity; `generate_a2ui` / `render_a2ui` are the retired
 * designer path, kept so older threads still hide their raw calls. None of
 * them may draw their own chat row.
 */
export const ROOM_COMPARISON_TOOL_NAMES: ReadonlySet<string> = new Set([
  TOOL_KEYS.GET.COMPARE_ROOMS,
  "generate_a2ui",
  "render_a2ui",
]);

/**
 * A `compare_rooms` call whose result came back `no_candidates` — nothing was
 * painted (no search on screen yet), so the model's own reply must show, not
 * the fixed comparison pointer. Unresolved calls still count as comparisons.
 */
const isUnpaintedCompareCall = (
  call: ToolCallLike,
  messages: MessageLike[] | undefined,
): boolean => {
  if (toolCallName(call) !== TOOL_KEYS.GET.COMPARE_ROOMS || !call.id) {
    return false;
  }

  const resultMessage = messages?.find(
    (message) =>
      message.role === MESSAGE_ROLE.TOOL && message.toolCallId === call.id,
  );
  const result = parseToolResult<{ status?: unknown }>(
    resultMessage?.content as { status?: unknown } | string | null | undefined,
  );

  return result?.status === "no_candidates";
};

/**
 * True when this one message carries a RoomComparison tool call. Pass the
 * transcript so a `compare_rooms` that painted nothing is not counted.
 */
export const messageHasRoomComparisonCall = (
  message: MessageLike | undefined,
  messages?: MessageLike[],
): boolean =>
  (message?.toolCalls ?? []).some((call) => {
    const name = toolCallName(call);
    return (
      !!name &&
      ROOM_COMPARISON_TOOL_NAMES.has(name) &&
      !isUnpaintedCompareCall(call, messages)
    );
  });

/**
 * True when a RoomComparison call painted in the same turn as `messageId`
 * (scanning back to the previous user message). RoomComparison is the only
 * surface, so the assistant's chat line on that turn is replaced with a fixed
 * short pointer (see `compareCompanionText`) — the model is told to keep it to
 * one sentence but still sometimes re-lists the rooms.
 */
export const turnRendersRoomComparison = (
  messages: MessageLike[] | undefined,
  messageId: string | undefined,
): boolean => {
  if (!messages?.length || !messageId) {
    return false;
  }

  const index = messages.findIndex((message) => message.id === messageId);
  if (index < 0) {
    return false;
  }

  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const message = messages[cursor];

    if (cursor !== index && message?.role === MESSAGE_ROLE.USER) {
      return false;
    }

    if (
      message?.role === MESSAGE_ROLE.ASSISTANT &&
      messageHasRoomComparisonCall(message, messages)
    ) {
      return true;
    }
  }

  return false;
};

const ROOM_COMPARISON_POINTER = {
  en: "Here is the room comparison.",
  vi: "Đây là bảng so sánh phòng.",
};

const lastUserMessageText = (
  messages: MessageLike[] | undefined,
  messageId: string | undefined,
): string => {
  if (!messages?.length || !messageId) {
    return "";
  }

  const index = messages.findIndex((message) => message.id === messageId);
  const from = index < 0 ? messages.length - 1 : index;

  for (let cursor = from; cursor >= 0; cursor -= 1) {
    const message = messages[cursor];
    if (message?.role !== MESSAGE_ROLE.USER) {
      continue;
    }
    const { content } = message;
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((part) =>
          part && typeof part === "object" && "text" in part
            ? String((part as { text?: unknown }).text ?? "")
            : "",
        )
        .join(" ");
    }
    return "";
  }

  return "";
};

/**
 * Fixed short chat line for a RoomComparison turn — the surface shows every
 * room fact, so the transcript only points at it. Language follows the guest's
 * latest message (Vietnamese vs. English), matching the agent's LANGUAGE rule.
 */
export const compareCompanionText = (
  messages: MessageLike[] | undefined,
  messageId: string | undefined,
): string =>
  VIETNAMESE_LETTER.test(lastUserMessageText(messages, messageId))
    ? ROOM_COMPARISON_POINTER.vi
    : ROOM_COMPARISON_POINTER.en;

/**
 * The message that should carry the "Here is the room comparison." pointer —
 * the FIRST assistant message that lands after the `compare_rooms` call in the
 * same turn (the model's own closing line, replaced with the fixed pointer).
 *
 * Placing it here (rather than on the call-carrying message) keeps the pointer
 * BELOW the painted surface, matching how the Room List renders its card first
 * and its text underneath. `tool` / `activity` rows between the call and the
 * reply are skipped. Until that reply streams in, no message qualifies and the
 * surface stands on its own heading.
 */
export const isComparisonPointerMessage = (
  messages: MessageLike[] | undefined,
  messageId: string | undefined,
): boolean => {
  if (!messages?.length || !messageId) {
    return false;
  }

  const index = messages.findIndex((message) => message.id === messageId);
  if (index <= 0) {
    return false;
  }

  const message = messages[index];
  if (
    message?.role !== MESSAGE_ROLE.ASSISTANT ||
    messageHasRoomComparisonCall(message, messages)
  ) {
    return false;
  }

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previous = messages[cursor];

    if (previous?.role === MESSAGE_ROLE.USER) {
      return false;
    }

    if (previous?.role === MESSAGE_ROLE.ASSISTANT) {
      // First assistant reply after the call → this is the pointer row.
      // An earlier non-call assistant message already took that slot → not this one.
      return messageHasRoomComparisonCall(previous, messages);
    }
  }

  return false;
};
