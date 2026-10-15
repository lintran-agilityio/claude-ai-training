import { useCallback, useState } from "react";
import { ToolCallStatus } from "@copilotkit/react-core/v2";

import { useSupersedeHitlOnNewInteraction } from "@/features/chatbot/hooks";
import type {
  HitlConfirmDialogResult,
  HitlToolResult,
} from "@/features/booking/types/hitl-result";
import {
  isHitlToolFinished,
  isHitlToolRespondable,
  resolveHitlDecisionStatus,
  useHitlRespondOnce,
  type HitlDecisionStatus,
} from "@/features/booking/utils";

export type { HitlConfirmDialogResult } from "@/features/booking/types/hitl-result";

export const useHitlConfirmDialog = <
  TResult extends HitlConfirmDialogResult,
>(
  status: ToolCallStatus,
  respond: ((result: TResult) => Promise<void>) | undefined,
  defaultErrorMessage: string,
  result?: HitlToolResult<TResult>,
  toolCallId?: string,
) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { respondOnce, canRespond: canRespondHitl } =
    useHitlRespondOnce<TResult>(respond);

  const isAwaiting = isHitlToolRespondable(status, respond);
  const isFinished = isHitlToolFinished(status);
  const shouldRender = isAwaiting || isFinished;
  const decisionStatus: HitlDecisionStatus = resolveHitlDecisionStatus(
    status,
    result,
  );

  const supersedeDismiss = useCallback(() => {
    void respondOnce({ confirmed: false } as TResult);
  }, [respondOnce]);

  const { isActionable, expiredBySupersede } = useSupersedeHitlOnNewInteraction({
    toolCallId,
    canRespond: canRespondHitl,
    onSupersede: supersedeDismiss,
  });

  const canRespond = canRespondHitl && isActionable;

  const handleDismiss = () => {
    if (!canRespond) {
      return;
    }

    void respondOnce({ confirmed: false } as TResult);
  };

  const confirm = async (
    confirmedResult: Extract<TResult, { confirmed: true }>,
  ) => {
    if (!canRespond) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await respondOnce(confirmedResult as TResult);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : defaultErrorMessage,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    shouldRender,
    isSubmitting,
    errorMessage,
    canRespond,
    isActionable,
    expiredBySupersede,
    decisionStatus,
    handleDismiss,
    confirm,
  };
};

/**
 * Shared HITL wiring for disambiguation pickers (cancel/modify): responds at
 * most once, and auto-declines with `declineResult` when a new interaction
 * supersedes this pending pick.
 */
export const useHitlPickerDismiss = <T>(
  respond: ((result: T) => Promise<void>) | undefined,
  toolCallId: string | undefined,
  declineResult: T,
) => {
  const { respondOnce, canRespond: canRespondHitl } =
    useHitlRespondOnce<T>(respond);

  const supersedeDismiss = useCallback(() => {
    void respondOnce(declineResult);
  }, [respondOnce, declineResult]);

  const { isActionable, expiredBySupersede } = useSupersedeHitlOnNewInteraction({
    toolCallId,
    canRespond: canRespondHitl,
    onSupersede: supersedeDismiss,
  });

  return {
    respondOnce,
    canRespond: canRespondHitl && isActionable,
    isActionable,
    expiredBySupersede,
  };
};
