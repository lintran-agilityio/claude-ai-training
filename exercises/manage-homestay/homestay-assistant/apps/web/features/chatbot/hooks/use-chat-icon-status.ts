"use client";

// Libs
import { useEffect, useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

// Features
import {
  getChatIconCompletedDisplayMs,
  isCountableAssistantMessage,
  resolveChatIconStatus,
  type ChatIconStatus,
} from "@/features/chatbot/utils/chat-icon-status";

type UseChatIconStatusInput = {
  agentId: string;
  isChatOpen: boolean;
  /** Active thread; resets unread when the user switches conversations. */
  threadId?: string | null;
};

/**
 * Derives the collapsed chat-toggle status (typing / processing / unread / completed).
 *
 * Unread only counts assistant messages that arrive during a live run while the
 * chat is closed — thread hydration and history are ignored.
 *
 * @param input - Agent id, open state, and active thread
 * @returns Status for the closed-chat icon badge
 */
export const useChatIconStatus = ({
  agentId,
  isChatOpen,
  threadId,
}: UseChatIconStatusInput): ChatIconStatus => {
  const { agent } = useAgent({ agentId });
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCompleted, setShowCompleted] = useState(false);

  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const unreadMessageIdsRef = useRef<Set<string>>(new Set());
  const wasRunningRef = useRef(false);
  const completedTimeoutRef = useRef<number | null>(null);
  const previousThreadIdRef = useRef<string | null | undefined>(threadId);

  // Thread switch: drop prior unread; seed known ids from whatever is loaded.
  useEffect(() => {
    if (previousThreadIdRef.current === threadId) {
      return;
    }

    previousThreadIdRef.current = threadId;
    knownMessageIdsRef.current = new Set(
      agent.messages.map((message) => message.id),
    );
    unreadMessageIdsRef.current = new Set();
    setUnreadCount(0);
    setShowCompleted(false);

    if (completedTimeoutRef.current !== null) {
      window.clearTimeout(completedTimeoutRef.current);
      completedTimeoutRef.current = null;
    }
  }, [agent.messages, threadId]);

  // While open, everything on screen is read.
  useEffect(() => {
    if (!isChatOpen) {
      return;
    }

    knownMessageIdsRef.current = new Set(
      agent.messages.map((message) => message.id),
    );
    unreadMessageIdsRef.current = new Set();
    setUnreadCount(0);
    setShowCompleted(false);

    if (completedTimeoutRef.current !== null) {
      window.clearTimeout(completedTimeoutRef.current);
      completedTimeoutRef.current = null;
    }
  }, [agent.messages, isChatOpen]);

  // While closed, only live run activity can create unread.
  useEffect(() => {
    if (isChatOpen) {
      return;
    }

    let changed = false;

    for (const message of agent.messages) {
      if (knownMessageIdsRef.current.has(message.id)) {
        continue;
      }

      knownMessageIdsRef.current.add(message.id);

      const arrivedDuringLiveRun =
        agent.isRunning || wasRunningRef.current || showCompleted;

      if (
        arrivedDuringLiveRun &&
        isCountableAssistantMessage(message, agent.messages)
      ) {
        unreadMessageIdsRef.current.add(message.id);
        changed = true;
      }
    }

    if (changed) {
      setUnreadCount(unreadMessageIdsRef.current.size);
    }
  }, [agent.isRunning, agent.messages, isChatOpen, showCompleted]);

  // After a run finishes while closed, flash the completed checkmark.
  useEffect(() => {
    const wasRunning = wasRunningRef.current;
    wasRunningRef.current = agent.isRunning;

    if (isChatOpen || agent.isRunning || !wasRunning) {
      return;
    }

    setShowCompleted(true);

    if (completedTimeoutRef.current !== null) {
      window.clearTimeout(completedTimeoutRef.current);
    }

    completedTimeoutRef.current = window.setTimeout(() => {
      setShowCompleted(false);
      completedTimeoutRef.current = null;
    }, getChatIconCompletedDisplayMs());

    return () => {
      if (completedTimeoutRef.current !== null) {
        window.clearTimeout(completedTimeoutRef.current);
        completedTimeoutRef.current = null;
      }
    };
  }, [agent.isRunning, isChatOpen]);

  return resolveChatIconStatus({
    isChatOpen,
    isRunning: agent.isRunning,
    messages: agent.messages,
    unreadCount,
    showCompleted,
  });
};
