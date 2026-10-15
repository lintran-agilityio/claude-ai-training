"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ToolCallStatus } from "@copilotkit/react-core/v2";
import { parseToolResult } from "@repo/utils";

import { useBooking } from "@/features/booking/hooks";
import {
  CreateBookingResult,
  CreateBookingToolProps,
} from "@/features/booking/types";
import { useCreateBookingCardStore } from "@/features/booking/stores/create-booking-card-store";
import {
  buildCreateStayCorrelationKey,
  getCreateBookingFailureMessage,
  isCreateBookingSuccess,
} from "@/features/booking/utils";
import { useArtifactStore } from "@/features/chatbot/stores/artifact-store";
import { useHomestayAgentUiStore } from "@/features/chatbot/stores/homestay-agent-ui-store";
import { useRoomStore } from "@/features/room/stores/room-store";

/**
 * Headless create_booking bridge: publishes outcome to the confirm HITL card
 * store and runs success side effects. Does not render a separate success card.
 */
export const CreateBookingNotice = ({
  status,
  result,
  parameters,
}: CreateBookingToolProps) => {
  const queryClient = useQueryClient();
  const resetBooking = useBooking((state) => state.resetBooking);
  const setBookingJustCompleted = useHomestayAgentUiStore(
    (state) => state.setBookingJustCompleted,
  );
  const finalizeBookingForms = useArtifactStore(
    (state) => state.finalizeBookingForms,
  );
  const markSubmitting = useCreateBookingCardStore(
    (state) => state.markSubmitting,
  );
  const markSuccess = useCreateBookingCardStore((state) => state.markSuccess);
  const markFailed = useCreateBookingCardStore((state) => state.markFailed);
  const resolveTargetCorrelationKey = useCreateBookingCardStore(
    (state) => state.resolveTargetCorrelationKey,
  );
  const sideEffectBookingId = useRef<string | null>(null);
  const lastPublishedKey = useRef<string | null>(null);

  useEffect(() => {
    const fromParams = buildCreateStayCorrelationKey(parameters ?? {});
    const parsedResult = parseToolResult<CreateBookingResult>(result);
    const fromResult = buildCreateStayCorrelationKey({
      roomId: parsedResult?.roomId,
      checkInDate: parsedResult?.checkInDate,
      checkOutDate: parsedResult?.checkOutDate,
      guests: parsedResult?.guests,
    });
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

    if (isCreateBookingSuccess(result)) {
      const parsed = parseToolResult<CreateBookingResult>(result);
      const bookingId = parsed?.id?.trim();
      if (!bookingId) {
        return;
      }

      const successCorrelationKey =
        resolveTargetCorrelationKey(
          buildCreateStayCorrelationKey({
            roomId: parsed?.roomId ?? parameters?.roomId,
            checkInDate: parsed?.checkInDate ?? parameters?.checkInDate,
            checkOutDate: parsed?.checkOutDate ?? parameters?.checkOutDate,
            guests: parsed?.guests ?? parameters?.guests,
          }),
        ) ?? correlationKey;

      const publishKey = `${successCorrelationKey}:success:${bookingId}`;
      if (lastPublishedKey.current !== publishKey) {
        lastPublishedKey.current = publishKey;
        markSuccess(successCorrelationKey, {
          bookingId,
          totalPrice:
            typeof parsed?.totalPrice === "number"
              ? parsed.totalPrice
              : undefined,
        });
      }

      if (sideEffectBookingId.current !== bookingId) {
        sideEffectBookingId.current = bookingId;
        finalizeBookingForms("success");
        resetBooking();
        setBookingJustCompleted(true);
        useRoomStore.getState().clearAgentRoomSearch();
        void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      }
      return;
    }

    const failureMessage = getCreateBookingFailureMessage(result);
    const publishKey = `${correlationKey}:failed:${failureMessage}`;
    if (lastPublishedKey.current !== publishKey) {
      lastPublishedKey.current = publishKey;
      markFailed(correlationKey, failureMessage);
    }
  }, [
    status,
    result,
    parameters,
    finalizeBookingForms,
    markFailed,
    markSubmitting,
    markSuccess,
    queryClient,
    resetBooking,
    resolveTargetCorrelationKey,
    setBookingJustCompleted,
  ]);

  return null;
};
