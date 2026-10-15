"use client";

// Libs
import type { ReactNode } from "react";
import {
  Check,
  MessageSquare,
  MessageSquareMore,
  Zap,
} from "lucide-react";

// Features
import { CHAT_ICON_STATUS } from "@/features/chatbot/constants";
import type { ChatIconStatus } from "@/features/chatbot/utils/chat-icon-status";

/**
 * Builds the accessible label for the collapsed/expanded chat toggle.
 *
 * @param isChatOpen - Whether the chat sidebar is expanded
 * @param status - Closed-chat activity status
 * @returns Aria label string
 */
export const getChatToggleAriaLabel = (
  isChatOpen: boolean,
  status: ChatIconStatus,
) => {
  if (isChatOpen) {
    return "Close assistant";
  }

  switch (status.kind) {
    case CHAT_ICON_STATUS.UNREAD:
      return `Open assistant, ${status.count} unread`;
    case CHAT_ICON_STATUS.PROCESSING:
      return "Open assistant, processing";
    case CHAT_ICON_STATUS.TYPING:
      return "Open assistant, AI is typing";
    case CHAT_ICON_STATUS.COMPLETED:
      return "Open assistant, completed";
    case CHAT_ICON_STATUS.IDLE:
    default:
      return "Open assistant";
  }
};

/**
 * Formats the unread badge text (caps at 9+).
 *
 * @param count - Unread assistant message count
 * @returns Display string for the badge
 */
export const formatUnreadCount = (count: number) =>
  count > 9 ? "9+" : String(count);

/**
 * Renders the closed-chat status icon for the current status kind.
 *
 * @param status - Derived closed-chat status
 * @returns Icon node for the toggle face
 */
export const renderClosedChatIcon = (status: ChatIconStatus): ReactNode => {
  switch (status.kind) {
    case CHAT_ICON_STATUS.PROCESSING:
      return (
        <Zap className="size-5 fill-amber-400 text-amber-400" aria-hidden />
      );
    case CHAT_ICON_STATUS.TYPING:
      return (
        <MessageSquareMore
          className="size-5 animate-pulse text-primary-foreground"
          aria-hidden
        />
      );
    case CHAT_ICON_STATUS.COMPLETED:
      return (
        <span
          className="flex size-5 items-center justify-center rounded-full bg-primary-foreground/20"
          aria-hidden
        >
          <Check className="size-3 stroke-[3] text-primary-foreground" />
        </span>
      );
    case CHAT_ICON_STATUS.UNREAD:
    case CHAT_ICON_STATUS.IDLE:
    default:
      return <MessageSquare className="size-5" aria-hidden />;
  }
};

/**
 * Renders the unread count badge when status is unread.
 *
 * @param status - Derived closed-chat status
 * @returns Badge node, or null when not unread
 */
export const renderUnreadBadge = (status: ChatIconStatus): ReactNode => {
  switch (status.kind) {
    case CHAT_ICON_STATUS.UNREAD:
      return (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-semibold leading-none text-gold-foreground ring-2 ring-background"
          aria-hidden
        >
          {formatUnreadCount(status.count)}
        </span>
      );
    default:
      return null;
  }
};
