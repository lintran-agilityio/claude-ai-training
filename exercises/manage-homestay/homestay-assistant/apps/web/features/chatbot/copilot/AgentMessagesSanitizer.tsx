"use client";

/**
 * Temporary compatibility: collapses same-id / twin assistant rows that still
 * arrive from Intelligence reconnect. Prefer fixing uniqueness in AG-UI
 * (`stream-patch`) / memory, then remove this component.
 *
 * Blocked-message presentation is derived at render (see blocked-messages.ts),
 * not rewritten here via setMessages.
 */

import { useEffect, useRef } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { AGENT_KEYS } from "@repo/constants";
import { normalizeMessages } from "@/features/chatbot/utils";

export const AgentMessagesSanitizer = () => {
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });
  // Fingerprint of the last sanitized snapshot we wrote. Clears the
  // setMessages ↔ normalizeMessages oscillation that hits React's
  // "Maximum update depth exceeded" when the runtime reintroduces a shape
  // normalizeMessages rewrites (empty toolCalls, object args, etc.).
  const lastAppliedFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof agent.setMessages !== "function") {
      return;
    }

    const sanitized = normalizeMessages(agent.messages);
    const before = JSON.stringify(agent.messages);
    const after = JSON.stringify(sanitized);

    if (before === after) {
      lastAppliedFingerprintRef.current = after;
      return;
    }

    if (lastAppliedFingerprintRef.current === after) {
      return;
    }

    lastAppliedFingerprintRef.current = after;
    agent.setMessages(sanitized);
  }, [agent, agent.messages]);

  return null;
};
