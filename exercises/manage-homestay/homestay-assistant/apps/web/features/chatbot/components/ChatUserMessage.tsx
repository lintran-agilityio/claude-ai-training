"use client";

import {
  CopilotChatUserMessage,
  type CopilotChatUserMessageProps,
  useAgent,
  useCopilotChatConfiguration,
} from "@copilotkit/react-core/v2";
import {
  isBookingFormPrompt,
  parseBookingFormArtifactId,
} from "@repo/constants";
import { cn } from "@repo/utils";

import { ConversationItem } from "@/features/chatbot/components/ConversationItem";
import { useArtifactStore } from "@/features/chatbot/stores/artifact-store";
import { isArtifactTerminal } from "@/features/chatbot/types/artifact";
import {
  getMessageTopSpacing,
  isUserMessageBlockedInTranscript,
} from "@/features/chatbot/utils";
import {
  getMessageTextContent,
  getUserVisibleMessageContent,
  isHiddenAgentPrompt,
} from "@/features/chatbot/declarative-ui/config";

export const ChatUserMessage = ({
  className,
  message,
  ...props
}: CopilotChatUserMessageProps) => {
  const agentId = useCopilotChatConfiguration()?.agentId;
  const { agent } = useAgent({ agentId });
  const topSpacing = getMessageTopSpacing(agent.messages, message.id, "user");

  const rawContent = getMessageTextContent(message.content);
  const bookingFormArtifactId = isBookingFormPrompt(rawContent)
    ? parseBookingFormArtifactId(rawContent)
    : null;
  const bookingFormStatus = useArtifactStore((state) =>
    bookingFormArtifactId
      ? state.artifacts[bookingFormArtifactId]?.status
      : undefined,
  );

  if (isHiddenAgentPrompt(rawContent)) {
    return null;
  }

  const displayContent = getUserVisibleMessageContent(rawContent);
  const isBlocked = isUserMessageBlockedInTranscript(
    agent.messages,
    message.id,
  );
  const isBookingFormDisabled = isArtifactTerminal(bookingFormStatus);

  return (
    <CopilotChatUserMessage
      {...props}
      message={message}
      className={cn("!bg-transparent !p-0", className)}
      messageRenderer={() => (
        <span className="whitespace-pre-wrap break-words">{displayContent}</span>
      )}
    >
      {({ messageRenderer }) => (
        <div
          data-chat-timeline-entry="user"
          data-chat-message-row="user"
          className={cn("flex items-start justify-end px-3", topSpacing)}
        >
          <ConversationItem
            role="user"
            className={cn(
              "app-scrollbar max-h-[400px] overflow-y-auto",
              isBlocked &&
                "border border-amber-500/40 bg-amber-500/10 text-foreground",
              isBookingFormDisabled &&
                "pointer-events-none opacity-45 saturate-50",
            )}
            banner={
              isBlocked ? (
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Blocked by security filter
                </p>
              ) : null
            }
          >
            {messageRenderer}
          </ConversationItem>
        </div>
      )}
    </CopilotChatUserMessage>
  );
};
