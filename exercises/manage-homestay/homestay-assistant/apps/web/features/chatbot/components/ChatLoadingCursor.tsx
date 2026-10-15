"use client";

import type { HTMLAttributes } from "react";
import {
  useAgent,
  useCopilotChatConfiguration,
  useCopilotKit,
} from "@copilotkit/react-core/v2";

import { ChatAgentAvatar } from "@/features/chatbot/components/ChatAvatars";
import { ConversationItem } from "@/features/chatbot/components/ConversationItem";
import type { MessageLike } from "@/features/chatbot/types";
import {
  getChatVisibleToolCalls,
  getMessageTextContent,
  isAwaitingForcedModifyHandoff,
  isChatInlineLoadingToolCall,
} from "@/features/chatbot/declarative-ui/config";
import { cn } from "@repo/utils";
import { MESSAGE_ROLE } from "@repo/constants";

const hasVisibleAssistantText = (
  message: Pick<MessageLike, "role" | "content">,
) => {
  if (message.role !== MESSAGE_ROLE.ASSISTANT) {
    return false;
  }

  return Boolean(getMessageTextContent(message.content).trim());
};

/** The assistant-style typing row (avatar + three bouncing dots). */
const renderLoadingRow = (
  className: string | undefined,
  props: HTMLAttributes<HTMLDivElement>,
) => (
  <div
    {...props}
    data-testid="copilot-loading-cursor"
    data-chat-timeline-entry="assistant-loading"
    role="status"
    aria-live="polite"
    aria-label="Assistant is responding"
    className={cn("flex items-start justify-start gap-3 px-3 pb-1", className)}
  >
    <ChatAgentAvatar />
    <ConversationItem
      role={MESSAGE_ROLE.ASSISTANT}
      className="flex min-h-9 items-center gap-1.5 py-3"
    >
      <span className="sr-only">Assistant is responding</span>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden
          className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${index * 150}ms` }}
        />
      ))}
    </ConversationItem>
  </div>
);

/**
 * Agent-running indicator for the CopilotChat message list `cursor` slot.
 * Replaces CopilotKit's default single pulse dot with an assistant-style typing row.
 *
 * Hidden only when the latest turn ALREADY shows its own indicator, so the dots
 * are never a duplicate and never replace an otherwise-empty gap:
 *   - visible streaming assistant text, or
 *   - a chat-visible tool call that is actually on screen right now:
 *       • an inline-loading tool (find_room / get_bookings / get_room_by_id) —
 *         its skeleton paints from `InProgress`, or
 *       • any visible tool that has reached `Executing` (HITL modal mounted) or
 *         `Complete` (result card / unavailable notice).
 *
 * Still shown while the agent is "thinking, nothing rendered yet": a fresh user
 * turn, a page-only tool (get_rooms), a silent internal lookup
 * (find_room/get_bookings resolve, find_booking_by_id), or a HITL tool still in
 * `InProgress` (modal not yet mounted) — exactly the cases the screenshots
 * flagged as a confusing blank.
 *
 * Always returns an Element (never null) — CopilotChat's cursor slot requires that.
 */
export const ChatLoadingCursor = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  const agentId = useCopilotChatConfiguration()?.agentId;
  const { agent } = useAgent({ agentId });
  const { executingToolCallIds } = useCopilotKit();
  const messages = agent.messages as MessageLike[];
  const lastMessage = messages.at(-1);

  // The guest just picked a stay / confirmed an edit and that HITL card hid
  // itself, but the forced follow-up step (find_booking_by_id → edit / confirm)
  // has not streamed in yet. Keep the typing row up through the resume
  // round-trip — otherwise the chat goes blank and looks like the request was
  // dropped. Must win over the "turn owner has visible text" check below: the
  // text on that turn is the picker's companion sentence, not the reply.
  if (isAwaitingForcedModifyHandoff(messages)) {
    return renderLoadingRow(className, props);
  }

  if (lastMessage && hasVisibleAssistantText(lastMessage)) {
    return <div hidden aria-hidden {...props} />;
  }

  // Walk back past trailing `tool` results to the message that owns the current
  // turn. A trailing user message (fresh turn, still thinking) falls through and
  // keeps the dots.
  const turnOwner = [...messages]
    .reverse()
    .find((message) => message.role !== MESSAGE_ROLE.TOOL);

  // An A2UI surface (RoomComparison) is mid-generation or freshly painted: its
  // own skeleton / card is the running indicator, so the dots would be a
  // duplicate sitting right under it.
  if (turnOwner?.role === "activity") {
    return <div hidden aria-hidden {...props} />;
  }

  // The turn owner already has visible text (a `tool` result was appended after
  // it, so `lastMessage` above missed it) — the reply is on screen, no dots.
  if (turnOwner && hasVisibleAssistantText(turnOwner)) {
    return <div hidden aria-hidden {...props} />;
  }

  if (turnOwner?.role === MESSAGE_ROLE.ASSISTANT) {
    const resolvedToolCallIds = new Set(
      messages
        .filter((message) => message.role === MESSAGE_ROLE.TOOL)
        .map((message) => message.toolCallId)
        .filter(Boolean),
    );

    const hasRenderedWidget = getChatVisibleToolCalls(
      turnOwner.toolCalls,
      messages,
    ).some((toolCall) => {
      if (!toolCall.id) {
        return false;
      }

      // Complete (result card) or Executing (HITL modal / frontend handler up).
      if (
        resolvedToolCallIds.has(toolCall.id) ||
        executingToolCallIds.has(toolCall.id)
      ) {
        return true;
      }

      // Skeleton tools paint from InProgress, before the run reports Executing.
      return isChatInlineLoadingToolCall(toolCall);
    });

    if (hasRenderedWidget) {
      return <div hidden aria-hidden {...props} />;
    }
  }

  return renderLoadingRow(className, props);
};
