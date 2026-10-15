import {
  CopilotChatView,
  useCopilotChatConfiguration,
} from "@copilotkit/react-core/v2";

import { ChatAgentAvatar } from "@/features/chatbot/components/ChatAvatars";
import { ConversationItem } from "@/features/chatbot/components/ConversationItem";

import { cn } from "@repo/utils";

type ChatWelcomeScreenProps = React.ComponentProps<
  typeof CopilotChatView.WelcomeScreen
>;

export const ChatWelcomeScreen = ({
  input,

  suggestionView,

  className,
}: ChatWelcomeScreenProps) => {
  const labels = useCopilotChatConfiguration()?.labels;

  return (
    <div
      data-testid="copilot-welcome-screen"
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      <div
        data-chat-messages
        className="app-scrollbar min-h-0 flex-1 overflow-y-auto pt-6"
      >
        <div
          data-chat-message-row="assistant"
          className="flex items-start gap-3 px-3"
        >
          <ChatAgentAvatar />

          <ConversationItem role="assistant">
            {labels?.welcomeMessageText}
          </ConversationItem>
        </div>
      </div>

      <div
        data-chat-footer
        className="shrink-0 border-t border-border bg-card"
      >
        {suggestionView}

        {input}
      </div>
    </div>
  );
};
