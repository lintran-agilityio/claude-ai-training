import { MESSAGE_ROLE } from "@repo/constants";

// Features
import { CHAT_ICON_STATUS } from "@/features/chatbot/constants";
import {
  getMessageTextContent,
  isHiddenAgentPrompt,
} from "@/features/chatbot/declarative-ui/config";

// Types
import type { ChatIconStatusKind } from "@/features/chatbot/constants";
import type { MessageLike } from "@/features/chatbot/types";

export type { ChatIconStatusKind };

export type ChatIconStatus =
  | { kind: typeof CHAT_ICON_STATUS.IDLE }
  | { kind: typeof CHAT_ICON_STATUS.UNREAD; count: number }
  | { kind: typeof CHAT_ICON_STATUS.PROCESSING }
  | { kind: typeof CHAT_ICON_STATUS.TYPING }
  | { kind: typeof CHAT_ICON_STATUS.COMPLETED };

type ChatIconMessage = MessageLike & { id: string };

const COMPLETED_DISPLAY_MS = 2500;

const hasToolCalls = (message: Pick<ChatIconMessage, "toolCalls">) =>
  Boolean(message.toolCalls?.length);

/**
 * How long the completed checkmark stays visible after a run finishes.
 *
 * @returns Display duration in milliseconds
 */
export const getChatIconCompletedDisplayMs = () => COMPLETED_DISPLAY_MS;

/**
 * Returns true when an assistant message is a reply to a hidden system prompt.
 *
 * @param messages - Full message list for neighbor lookup
 * @param messageId - Assistant message id to inspect
 * @returns Whether the message should be hidden from unread counts
 */
const isResponseToHiddenPrompt = (
  messages: ChatIconMessage[],
  messageId: string,
) => {
  const index = messages.findIndex((item) => item.id === messageId);
  if (index <= 0) {
    return false;
  }

  const previousMessage = messages[index - 1];
  if (previousMessage?.role !== MESSAGE_ROLE.USER) {
    return false;
  }

  return isHiddenAgentPrompt(getMessageTextContent(previousMessage.content));
};

/**
 * Returns true when a message should contribute to unread / activity status.
 *
 * @param message - Candidate message
 * @param messages - Full list for hidden-prompt detection
 * @returns Whether the message is user-visible assistant activity
 */
export const isCountableAssistantMessage = (
  message: ChatIconMessage,
  messages: ChatIconMessage[],
) => {
  if (message.role !== MESSAGE_ROLE.ASSISTANT) {
    return false;
  }

  if (isResponseToHiddenPrompt(messages, message.id)) {
    return false;
  }

  const text = getMessageTextContent(message.content).trim();

  return Boolean(text) || hasToolCalls(message);
};

/**
 * Counts assistant messages that arrived after the last time the chat was opened.
 *
 * @param messages - Current agent messages
 * @param seenMessageIds - Message ids already acknowledged while chat was open
 * @returns Unread assistant message count
 */
export const countUnreadAssistantMessages = (
  messages: ChatIconMessage[],
  seenMessageIds: ReadonlySet<string>,
) =>
  messages.filter(
    (message) =>
      isCountableAssistantMessage(message, messages) &&
      !seenMessageIds.has(message.id),
  ).length;

/**
 * Returns true when the latest agent activity looks like tool work, not typing.
 *
 * @param messages - Current agent messages
 * @returns Whether processing (tools) should take priority over typing
 */
export const hasActiveToolProcessing = (messages: ChatIconMessage[]) => {
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    return false;
  }

  const { role, content } = lastMessage;

  if (role === MESSAGE_ROLE.TOOL) {
    return true;
  }

  if (role !== MESSAGE_ROLE.ASSISTANT) {
    return false;
  }

  if (!hasToolCalls(lastMessage)) {
    return false;
  }

  const text = getMessageTextContent(content).trim();

  // Tool-only / tool-first turns read as processing; text replies as typing.
  return !text;
};

/**
 * Resolves the closed-chat icon status from agent activity and unread count.
 *
 * Priority: processing → typing → completed → unread → idle.
 *
 * @param input - Live agent flags and unread/completed signals
 * @returns Status to render on the collapsed chat toggle
 */
export const resolveChatIconStatus = (input: {
  isChatOpen: boolean;
  isRunning: boolean;
  messages: ChatIconMessage[];
  unreadCount: number;
  showCompleted: boolean;
}): ChatIconStatus => {
  const { isChatOpen, isRunning, messages, unreadCount, showCompleted } = input;

  if (isChatOpen) {
    return { kind: CHAT_ICON_STATUS.IDLE };
  }

  if (isRunning) {
    if (hasActiveToolProcessing(messages)) {
      return { kind: CHAT_ICON_STATUS.PROCESSING };
    }

    return { kind: CHAT_ICON_STATUS.TYPING };
  }

  if (showCompleted) {
    return { kind: CHAT_ICON_STATUS.COMPLETED };
  }

  if (unreadCount > 0) {
    return { kind: CHAT_ICON_STATUS.UNREAD, count: unreadCount };
  }

  return { kind: CHAT_ICON_STATUS.IDLE };
};
