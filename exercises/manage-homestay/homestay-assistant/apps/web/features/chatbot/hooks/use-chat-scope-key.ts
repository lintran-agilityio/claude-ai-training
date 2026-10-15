"use client";

import { useUser } from "@clerk/nextjs";
import { getAgentResourceId } from "@repo/utils";

export const useChatScopeKey = (agentId: string) => {
  const { user, isLoaded } = useUser();
  const scopeKey =
    isLoaded && user?.id ? getAgentResourceId(user.id, agentId) : null;

  return {
    scopeKey,
    isReady: Boolean(scopeKey),
  };
};
