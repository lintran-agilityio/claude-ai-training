"use client";

import {
  CopilotChat,
  CopilotChatAssistantMessage,
  CopilotChatInput,
  CopilotChatReasoningMessage,
  CopilotChatUserMessage,
} from "@copilotkit/react-core/v2";

import { cn } from "@repo/utils";
import { WELCOME_MESSAGE } from "@/features/chatbot/constants";
import { useChatSidebarState } from "@/features/chatbot/hooks";
import {
  HeaderChat,
  ChatUserMessage,
  ChatWelcomeScreen,
  ChatAssistantMessage,
  ChatReasoningMessage,
  ChatLoadingCursor,
  ChatRunErrorNotice,
} from "@/features/chatbot/components";
import { ChatInput } from "@/features/chatbot/components/ChatInput";
import { ChatSidebarProps } from "@/features/chatbot/components/ChatSidebar";
import { SuggestionBar } from "@/features/chatbot/components/suggestions";
import { ThreadLoadingStateView } from "@/features/chatbot/threads/components";

export const ChatSidebarContent = ({
  className,
  agentId,
}: ChatSidebarProps) => {
  const {
    suggestions,
    activeThreadId,
    displayedOnlineStatus,
    isThreadLoading,
    isThreadError,
    loadError,
    requestReload,
    resetConversation,
    stopGeneration,
    runStartError,
    isRetryingRun,
    retryRun,
    dismissRunStartError,
    actionError,
    actionErrorRetriable,
    clearActionError,
    handleChatError,
  } = useChatSidebarState({ agentId });

  const suggestionBar = (
    <SuggestionBar
      suggestions={suggestions}
      agentId={agentId}
      threadId={activeThreadId ?? undefined}
    />
  );

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <HeaderChat online={displayedOnlineStatus} onReset={resetConversation} />
      <div
        data-sidebar-chat
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          "[&_.copilotKitChat]:flex [&_.copilotKitChat]:h-full [&_.copilotKitChat]:min-h-0 [&_.copilotKitChat]:flex-col",
        )}
      >
        {isThreadLoading || isThreadError ? (
          <div className="absolute inset-0 z-10 bg-card">
            <ThreadLoadingStateView
              errorMessage={isThreadError ? loadError : null}
              onRetry={isThreadError ? requestReload : undefined}
            />
          </div>
        ) : null}
        {!activeThreadId ? (
          <ThreadLoadingStateView />
        ) : (
          <CopilotChat
            key={activeThreadId}
            agentId={agentId}
            threadId={activeThreadId}
            autoScroll="pin-to-bottom"
            className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
            // Square Stop → abort stream; drop incomplete assistant turn.
            onStop={stopGeneration}
            onError={handleChatError}
            // CopilotChat always injects autoSuggestions into scrollView when the
            // chat has messages. Hide that built-in strip — we render SuggestionBar
            // once in the footer (and on the welcome screen).
            scrollView={{
              className:
                "app-scrollbar min-h-0 flex-1 [&_[data-testid=copilot-suggestions]]:hidden",
            }}
            labels={{
              chatInputPlaceholder: "Ask me anything...",
              welcomeMessageText: WELCOME_MESSAGE,
            }}
            welcomeScreen={(props) => (
              <ChatWelcomeScreen {...props} suggestionView={suggestionBar} />
            )}
            messageView={{
              className: "px-0 mx-0",
              assistantMessage:
                ChatAssistantMessage as typeof CopilotChatAssistantMessage,
              userMessage: ChatUserMessage as typeof CopilotChatUserMessage,
              // Hide the "Thinking…" / "Thought for a few seconds" disclosure
              // that every provider (OpenAI / OpenRouter / Cerebras) emits.
              reasoningMessage:
                ChatReasoningMessage as unknown as typeof CopilotChatReasoningMessage,
              cursor: ChatLoadingCursor,
            }}
            input={ChatInput as typeof CopilotChatInput}
          >
            {({ scrollView, input }) => (
              <div
                data-testid="copilot-chat"
                className="copilotKitChat flex h-full min-h-0 flex-1 flex-col overflow-hidden"
              >
                <div
                  data-chat-messages
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  {scrollView}
                  <div data-chat-bottom aria-hidden="true" className="hidden" />
                </div>
                <div
                  data-chat-footer
                  className="shrink-0 border-t border-border bg-card pt-3"
                >
                  {runStartError ? (
                    <ChatRunErrorNotice
                      message={runStartError}
                      isRetrying={isRetryingRun}
                      onRetry={retryRun}
                      onDismiss={dismissRunStartError}
                    />
                  ) : actionError ? (
                    <ChatRunErrorNotice
                      message={actionError}
                      isRetrying={isRetryingRun}
                      onRetry={actionErrorRetriable ? retryRun : undefined}
                      onDismiss={clearActionError}
                    />
                  ) : null}
                  {suggestionBar}
                  {input}
                </div>
              </div>
            )}
          </CopilotChat>
        )}
      </div>
    </aside>
  );
};
