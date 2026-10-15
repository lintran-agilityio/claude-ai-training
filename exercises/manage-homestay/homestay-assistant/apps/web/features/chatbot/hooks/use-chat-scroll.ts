import { useEffect, useLayoutEffect, useRef } from "react";

import {
  getChatScrollContainer,
  scheduleScrollChatToEnd,
  scrollChatToEnd,
} from "@/features/chatbot/utils";

type UseChatScrollOptions = {
  messageCount: number;
  isRunning?: boolean;
  contentKey?: string;
};

/**
 * Force-pin chat to bottom on new user/assistant content.
 * Works with CopilotKit StickToBottom by targeting the real overflow scroller.
 */
export const useChatScroll = ({
  messageCount,
  isRunning = false,
  contentKey = "",
}: UseChatScrollOptions) => {
  const frameRef = useRef<number | null>(null);

  const pin = () => {
    scrollChatToEnd("auto");
  };

  const schedulePin = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = requestAnimationFrame(() => {
      pin();
      frameRef.current = requestAnimationFrame(() => {
        pin();
        frameRef.current = null;
      });
    });
  };

  useLayoutEffect(() => {
    scheduleScrollChatToEnd("auto");
  }, [messageCount, contentKey, isRunning]);

  useEffect(() => {
    schedulePin();

    const scroller = getChatScrollContainer();
    if (!scroller) {
      const retry = window.setTimeout(() => {
        scheduleScrollChatToEnd("auto");
      }, 50);
      return () => window.clearTimeout(retry);
    }

    const onGrow = () => schedulePin();

    const resizeObserver = new ResizeObserver(onGrow);
    resizeObserver.observe(scroller);
    if (scroller.firstElementChild) {
      resizeObserver.observe(scroller.firstElementChild);
    }

    const mutationObserver = new MutationObserver(() => {
      onGrow();
      if (scroller.firstElementChild) {
        resizeObserver.observe(scroller.firstElementChild);
      }
    });
    mutationObserver.observe(scroller, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [messageCount, contentKey, isRunning]);
};
