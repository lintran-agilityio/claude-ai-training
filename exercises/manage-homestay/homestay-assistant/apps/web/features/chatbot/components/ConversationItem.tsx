import type { ReactNode } from "react";

import { cn } from "@repo/utils";
import { MESSAGE_ROLE, type MessageRole } from "@repo/constants";

type ConversationItemProps = {
  children: ReactNode;
  role: Extract<MessageRole, "user" | "assistant">;
  className?: string;
  /**
   * Optional banner above the bubble body (e.g. blocked-message notice).
   */
  banner?: ReactNode;
};

/**
 * Chat conversation bubble — User / Assistant text only.
 * Tool UIs must use EmbeddedWidget instead.
 *
 * Layout chrome (alignment, horizontal padding) belongs on the timeline row.
 */
export const ConversationItem = ({
  children,
  role,
  className,
  banner,
}: ConversationItemProps) => {
  const isUser = role === MESSAGE_ROLE.USER;

  return (
    <div
      data-chat-conversation-item={role}
      data-chat-message-ui
      className={cn(
        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
        isUser
          ? "border border-primary/15 bg-primary/10 text-foreground"
          : "chat-assistant-bubble border border-border bg-card text-foreground",
        className,
      )}
    >
      {banner}
      {children}
    </div>
  );
};
