import {
  CopilotChatAssistantMessage,
  CopilotChatToolCallsView,
  type CopilotChatAssistantMessageProps,
  type CopilotChatToolCallsViewProps,
} from "@copilotkit/react-core/v2";

import {
  MESSAGE_ROLE,
  isProcessorBlockAssistantContent,
} from "@repo/constants";

import {
  getChatVisibleToolCalls,
  getMessageTextContent,
  isChatHeadlessMountTool,
  isHiddenAgentPrompt,
  isPageOnlyGenerativeTool,
} from "@/features/chatbot/declarative-ui/config";

import { ChatAgentAvatar } from "@/features/chatbot/components/ChatAvatars";
import { ConversationItem } from "@/features/chatbot/components/ConversationItem";

import {
  compareCompanionText,
  getAssistantDisplayContent,
  getMessageTopSpacing,
  isComparisonPointerMessage,
  messageHasRoomComparisonCall,
  turnRendersRoomComparison,
} from "@/features/chatbot/utils";

import { cn } from "@repo/utils";

const isResponseToHiddenPrompt = (
  messages: CopilotChatAssistantMessageProps["messages"],

  messageId: string,
) => {
  const index = messages?.findIndex((item) => item.id === messageId) ?? -1;

  if (index <= 0 || !messages) {
    return false;
  }

  const previousMessage = messages[index - 1];

  if (previousMessage?.role !== MESSAGE_ROLE.USER) {
    return false;
  }

  return isHiddenAgentPrompt(
    getMessageTextContent(
      previousMessage.content as
        | string
        | Array<{ type: string; text?: string }>,
    ),
  );
};

const ChatToolCallsView = ({
  message,
  messages,
}: CopilotChatToolCallsViewProps) => {
  const visibleToolCalls = getChatVisibleToolCalls(message.toolCalls, messages);

  if (!visibleToolCalls.length) {
    return null;
  }

  return (
    <CopilotChatToolCallsView
      message={{ ...message, toolCalls: visibleToolCalls }}
      messages={messages}
    />
  );
};

export const ChatAssistantMessage = ({
  className,

  message,

  messages,

  toolbarVisible = false,

  ...props
}: CopilotChatAssistantMessageProps) => {
  if (isResponseToHiddenPrompt(messages, message.id)) {
    return null;
  }

  const chatToolCalls = getChatVisibleToolCalls(message.toolCalls, messages);

  const rawTextContent = getMessageTextContent(message.content).trim();
  const displayTextContent = isProcessorBlockAssistantContent(message.content)
    ? getAssistantDisplayContent(message.content).trim()
    : rawTextContent;

  const hasHiddenToolCalls = message.toolCalls?.some((toolCall) => {
    const toolName = toolCall.function?.name;

    return toolName ? isPageOnlyGenerativeTool(toolName) : false;
  });

  // COMPARE turn: the RoomComparison A2UI surface owns every room fact. The
  // message that fired `compare_rooms` renders no chat line at all — the
  // painted surface sits in its own timeline slot, and the fixed
  // "Here is the room comparison." pointer renders on the first assistant
  // reply AFTER it (so the pointer lands below the card, like the Room List's
  // text sits below its card). Any further re-listing lines are dropped.
  // A `compare_rooms` that painted nothing (`no_candidates`) is not a
  // comparison turn — the model's own reply shows.
  const messagesForTurn = messages as Parameters<
    typeof turnRendersRoomComparison
  >[0];
  const messageRendersComparison = messageHasRoomComparisonCall(
    message as Parameters<typeof messageHasRoomComparisonCall>[0],
    messagesForTurn,
  );
  const inComparisonTurn = turnRendersRoomComparison(
    messagesForTurn,
    message.id,
  );
  const isComparisonPointer = isComparisonPointerMessage(
    messagesForTurn,
    message.id,
  );

  if (messageRendersComparison && !chatToolCalls.length) {
    return null;
  }

  if (
    inComparisonTurn &&
    !messageRendersComparison &&
    !isComparisonPointer &&
    !chatToolCalls.length
  ) {
    return null;
  }

  const textContent = isComparisonPointer
    ? compareCompanionText(messagesForTurn, message.id)
    : displayTextContent;

  const hasVisibleContent = Boolean(textContent) || chatToolCalls.length > 0;

  if (!hasVisibleContent && !hasHiddenToolCalls) {
    return null;
  }

  const hasConversation = Boolean(textContent);

  // Headless bridge tools (cancel/update/create_booking notices) always
  // render null — they must still mount (their useEffect drives the HITL
  // card store + cache invalidation) but must not claim an avatar row.
  const visibleWidgetToolCalls = chatToolCalls.filter(
    (toolCall) => !isChatHeadlessMountTool(toolCall.function?.name),
  );
  const hasWidgets = visibleWidgetToolCalls.length > 0;
  // Use the raw tool-call count, not chatToolCalls.length: a turn made up
  // entirely of page-only tools (get_rooms) or silent internal lookups
  // (find_room/get_bookings resolve, a free/no-op find_booking_by_id) is
  // filtered out of chatToolCalls (isPageOnlyGenerativeTool /
  // isSilentIntermediateToolCall) before it reaches here, so
  // chatToolCalls.length would read 0 and this turn would wrongly fall
  // through to the normal avatar row — an empty tool-content div CSS can't
  // always be relied on to collapse.
  const isHeadlessOnlyTurn =
    Boolean(message.toolCalls?.length) && !hasWidgets && !hasConversation;

  const displayMessage =
    textContent && textContent !== rawTextContent
      ? { ...message, content: textContent }
      : message;

  return (
    <CopilotChatAssistantMessage
      {...props}
      message={displayMessage}
      messages={messages}
      toolbarVisible={toolbarVisible}
      className={cn("!bg-transparent p-0", className)}
      toolCallsView={ChatToolCallsView}
    >
      {({ markdownRenderer, toolCallsView }) =>
        isHeadlessOnlyTurn ? (
          // Only a headless bridge tool (cancel/update/create_booking notice)
          // fired this turn — mount it so its side effects run, but claim no
          // timeline space: no avatar row, no top spacing.
          <div hidden aria-hidden data-chat-timeline-entry="assistant-headless">
            {toolCallsView}
          </div>
        ) : (
          <div
            data-chat-timeline-entry="assistant"
            className={cn(
              "flex flex-col gap-2.5",

              getMessageTopSpacing(messages, message.id, "assistant", {
                widgetOnly: hasWidgets && !hasConversation,
              }),
            )}
          >
            {toolCallsView && chatToolCalls.length > 0 ? (
              hasConversation ? (
                <div data-chat-embedded-slot className="w-full">
                  {toolCallsView}
                </div>
              ) : (
                <div
                  data-chat-embedded-slot
                  data-chat-message-row="assistant"
                  data-chat-tool-only-row
                  className="flex items-start justify-start gap-3 px-3"
                >
                  <ChatAgentAvatar />
                  <div data-chat-tool-content className="min-w-0 flex-1">
                    {toolCallsView}
                  </div>
                </div>
              )
            ) : null}

            {hasConversation && markdownRenderer ? (
              <div
                data-chat-message-row="assistant"
                className="flex items-start justify-start gap-3 px-3"
              >
                <ChatAgentAvatar />
                <ConversationItem role="assistant">
                  {markdownRenderer}
                </ConversationItem>
              </div>
            ) : null}
          </div>
        )
      }
    </CopilotChatAssistantMessage>
  );
};
