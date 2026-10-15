"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ToolCallStatus } from "@copilotkit/react-core/v2";
import { parseToolResult } from "@repo/utils";

import type { CancelBookingToolProps } from "@/features/booking/types";
import { useCancelBookingCardStore } from "@/features/booking/stores/cancel-booking-card-store";
import {
  buildCancelBookingCorrelationKey,
  getCancelBookingFailureMessage,
  isCancelBookingSuccess,
} from "@/features/booking/utils";

/**
 * Headless cancel_booking bridge: publishes outcome to the confirm HITL card
 * store and runs success side effects. Does not render a separate success card.
 */
export const CancelBookingNotice = ({
  status,
  result,
  parameters,
}: CancelBookingToolProps) => {
  const queryClient = useQueryClient();
  const markSubmitting = useCancelBookingCardStore(
    (state) => state.markSubmitting,
  );
  const markSuccess = useCancelBookingCardStore((state) => state.markSuccess);
  const markFailed = useCancelBookingCardStore((state) => state.markFailed);
  const resolveTargetCorrelationKey = useCancelBookingCardStore(
    (state) => state.resolveTargetCorrelationKey,
  );
  const sideEffectBookingId = useRef<string | null>(null);
  const lastPublishedKey = useRef<string | null>(null);

  useEffect(() => {
    const fromParams = buildCancelBookingCorrelationKey(parameters?.bookingId);
    const parsedResult = parseToolResult<{ id?: string }>(result);
    const fromResult = buildCancelBookingCorrelationKey(parsedResult?.id);
    const correlationKey = resolveTargetCorrelationKey(
      fromParams ?? fromResult,
    );

    if (!correlationKey) {
      return;
    }

    if (
      status === ToolCallStatus.Executing ||
      status === ToolCallStatus.InProgress
    ) {
      const publishKey = `${correlationKey}:submitting`;
      if (lastPublishedKey.current !== publishKey) {
        lastPublishedKey.current = publishKey;
        markSubmitting(correlationKey);
      }
      return;
    }

    if (status !== ToolCallStatus.Complete) {
      return;
    }

    if (isCancelBookingSuccess(result)) {
      const parsed = parseToolResult<{ id?: string }>(result);
      const bookingId = parsed?.id?.trim() ?? parameters?.bookingId?.trim();
      if (!bookingId) {
        return;
      }

      const successCorrelationKey =
        resolveTargetCorrelationKey(
          buildCancelBookingCorrelationKey(bookingId),
        ) ?? correlationKey;

      const publishKey = `${successCorrelationKey}:success:${bookingId}`;
      if (lastPublishedKey.current !== publishKey) {
        lastPublishedKey.current = publishKey;
        markSuccess(successCorrelationKey, { bookingId });
      }

      if (sideEffectBookingId.current !== bookingId) {
        sideEffectBookingId.current = bookingId;
        void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      }
      return;
    }

    const failureMessage = getCancelBookingFailureMessage(result);
    const publishKey = `${correlationKey}:failed:${failureMessage}`;
    if (lastPublishedKey.current !== publishKey) {
      lastPublishedKey.current = publishKey;
      markFailed(correlationKey, failureMessage);
    }
  }, [
    status,
    result,
    parameters,
    markFailed,
    markSubmitting,
    markSuccess,
    queryClient,
    resolveTargetCorrelationKey,
  ]);

  return null;
};
