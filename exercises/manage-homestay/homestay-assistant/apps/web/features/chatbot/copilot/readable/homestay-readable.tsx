"use client";

import { useMemo } from "react";
import { useAgentContext } from "@copilotkit/react-core/v2";

import { HOMESTAY_AGENT_CONTEXT_READABLE_DESCRIPTION } from "@repo/constants";

import { useHomestayAgentContext } from "@/features/chatbot/hooks/use-homestay-agent-context";

export const HomestayReadable = () => {
  const context = useHomestayAgentContext();
  // Pass a stable string so useAgentContext does not add/remove on object identity churn.
  const value = useMemo(() => JSON.stringify(context), [context]);

  useAgentContext({
    description: HOMESTAY_AGENT_CONTEXT_READABLE_DESCRIPTION,
    value,
  });

  return null;
};
