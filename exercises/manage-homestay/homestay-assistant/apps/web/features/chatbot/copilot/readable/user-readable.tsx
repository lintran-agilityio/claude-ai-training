"use client";

import { useUser } from "@clerk/nextjs";
import { useAgentContext } from "@copilotkit/react-core/v2";
import { useMemo } from "react";

export const UserReadable = () => {
  const { user, isLoaded } = useUser();

  const contextValue = useMemo(() => {
    if (!isLoaded) {
      return { isLoaded: false as const, userId: null, email: null };
    }

    if (!user?.id) {
      return { isLoaded: true as const, userId: null, email: null };
    }

    return {
      isLoaded: true as const,
      userId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? null,
    };
  }, [isLoaded, user?.id, user?.primaryEmailAddress?.emailAddress]);

  useAgentContext({
    description:
      "Signed-in user for booking operations. userId is set when isLoaded is true and the user is authenticated.",
    value: contextValue,
  });

  return null;
};
