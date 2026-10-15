"use client";

import { createContext, forwardRef, useContext, type ComponentProps } from "react";
import {
  CopilotChatInput,
  type CopilotChatInputProps,
} from "@copilotkit/react-core/v2";

import { cn } from "@repo/utils";
import { useChatStore } from "@/features/chatbot/stores/chat-store";
import { shouldBlockChatSendKeyDown } from "@/features/chatbot/utils";

const ChatInputRunningContext = createContext(false);

const GuardedTextArea = forwardRef<
  HTMLTextAreaElement,
  ComponentProps<typeof CopilotChatInput.TextArea>
>(function GuardedTextArea({ onKeyDown, ...props }, ref) {
  const isRunning = useContext(ChatInputRunningContext);

  return (
    <CopilotChatInput.TextArea
      {...props}
      ref={ref}
      onKeyDown={(event) => {
        // While the agent runs, Enter must not start a second request. Swallow
        // it silently — no busy notice — the way ChatGPT does. Shift+Enter and
        // IME composition still fall through to the textarea.
        if (
          shouldBlockChatSendKeyDown({
            key: event.key,
            shiftKey: event.shiftKey,
            isComposing: event.nativeEvent.isComposing,
            isRunning,
          })
        ) {
          event.preventDefault();
          return;
        }

        onKeyDown?.(event);
      }}
    />
  );
});

/**
 * Chat composer: while the agent runs the send button becomes Stop and
 * Enter / Send cannot start a second request. Blocked submits are silent
 * (no busy notice), matching ChatGPT.
 */
export const ChatInput = ({
  isRunning = false,
  onSubmitMessage,
  className,
  ...props
}: CopilotChatInputProps) => {
  const handleSubmit = (value: string) => {
    // The Stop button replaces Send while running, but guard the submit path
    // too so a race (click as the run starts) cannot queue a second run.
    if (isRunning) {
      return;
    }

    useChatStore.getState().clearActionError();
    onSubmitMessage?.(value);
  };

  return (
    <ChatInputRunningContext.Provider value={isRunning}>
      <CopilotChatInput
        {...props}
        isRunning={isRunning}
        onSubmitMessage={handleSubmit}
        textArea={GuardedTextArea}
        showDisclaimer={false}
        bottomAnchored={false}
        className={cn("pointer-events-auto m-4 mt-0 rounded-2xl", className)}
      />
    </ChatInputRunningContext.Provider>
  );
};
