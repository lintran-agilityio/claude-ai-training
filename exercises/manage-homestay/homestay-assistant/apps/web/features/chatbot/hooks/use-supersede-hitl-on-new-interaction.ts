"use client";

import { useEffect, useRef, useState } from "react";

import { useGenericUiInteraction } from "@/features/chatbot/hooks/use-generic-ui-interaction";

type UseSupersedeHitlOnNewInteractionArgs = {
  toolCallId?: string;
  /** True while HITL can still call respond(). */
  canRespond: boolean;
  /** Dismiss payload — typically `{ confirmed: false }`. Runs once when superseded. */
  onSupersede: () => void | Promise<void>;
};

/**
 * When a new user request starts, pending HITL from a prior interaction is
 * auto-dismissed (`onSupersede`) and treated as expired for presentation.
 */
export const useSupersedeHitlOnNewInteraction = ({
  toolCallId,
  canRespond,
  onSupersede,
}: UseSupersedeHitlOnNewInteractionArgs) => {
  const { isActionable, isSuperseded } = useGenericUiInteraction(toolCallId);
  const [expiredBySupersede, setExpiredBySupersede] = useState(false);
  const onSupersedeRef = useRef(onSupersede);
  const didSupersedeRef = useRef(false);

  useEffect(() => {
    onSupersedeRef.current = onSupersede;
  }, [onSupersede]);

  useEffect(() => {
    if (!isSuperseded || !canRespond || didSupersedeRef.current) {
      return;
    }

    didSupersedeRef.current = true;
    setExpiredBySupersede(true);
    void onSupersedeRef.current();
  }, [isSuperseded, canRespond]);

  return {
    isActionable,
    isSuperseded,
    /** Presentation: show EXPIRED instead of review / cancelled-by-supersede. */
    expiredBySupersede,
  };
};
