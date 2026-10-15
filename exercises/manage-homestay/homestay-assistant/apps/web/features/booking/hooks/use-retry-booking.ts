"use client";

import { useCallback } from "react";

import {
  HOMESTAY_AGENT_TASK_STATUS,
  HOMESTAY_AGENT_TASK_TYPE,
} from "@repo/constants";
import { MODEL_NAME } from "@repo/types";

import { useHomestayAgentUiStore } from "@/features/chatbot/stores/homestay-agent-ui-store";
import { FLOW_KEY } from "@/constants";
import { useSendAgentMessage } from "@/features/chatbot/hooks";
import { useBookingStore } from "../stores";
import { getRetryMessage } from "../constants";

// Request Booking
export const useRequestRoomBooking = () => {
  const { sendMessage, isSending } = useSendAgentMessage({
    onBeforeSend: () => {
      const { roomId } = useBookingStore.getState();
      if (roomId) {
        useHomestayAgentUiStore.getState().pushUiFocus({
          key: FLOW_KEY.BOOK,
          task: {
            type: HOMESTAY_AGENT_TASK_TYPE.BOOK,
            status: HOMESTAY_AGENT_TASK_STATUS.IN_PROGRESS,
          },
          focus: { type: "room", id: roomId },
        });
      }
    },
    onError: (error) => {
      console.error("Failed to start booking flow", error);
    },
  });

  const requestRoomBooking = useCallback(
    (message = "Book this room") => sendMessage(message),
    [sendMessage],
  );

  return {
    requestRoomBooking,
    isRequesting: isSending,
  };
};

/**
 * Retry cancel after HITL failure: send a normal user message so the agent
 * decides whether to call cancel_booking again (never call the tool from UI).
 */
export const useRetryCancelBooking = () => {
  const { sendMessage, isSending } = useSendAgentMessage({
    onError: (error) => {
      console.error("Failed to retry cancel booking", error);
    },
  });

  const retryCancelBooking = useCallback(
    () => sendMessage(getRetryMessage(MODEL_NAME.CANCEL)),
    [sendMessage],
  );

  return { retryCancelBooking, isRetrying: isSending };
};

/**
 * Retry create after HITL failure: send a normal user message so the agent
 * decides whether to call create_booking again (never call the tool from UI).
 */
export const useRetryCreateBooking = () => {
  const { sendMessage, isSending } = useSendAgentMessage({
    onError: (error) => {
      console.error("Failed to retry create booking", error);
    },
  });

  const retryCreateBooking = useCallback(
    () => sendMessage(getRetryMessage(MODEL_NAME.CREATE)),
    [sendMessage],
  );

  return { retryCreateBooking, isRetrying: isSending };
};

/**
 * Retry modify after HITL failure: send a normal user message so the agent
 * decides whether to call update_booking again (never call the tool from UI).
 */
export const useRetryModifyBooking = () => {
  const { sendMessage, isSending } = useSendAgentMessage({
    onError: (error) => {
      console.error("Failed to retry modify booking", error);
    },
  });

  const retryModifyBooking = useCallback(
    () => sendMessage(getRetryMessage(MODEL_NAME.MODIFY)),
    [sendMessage],
  );

  return { retryModifyBooking, isRetrying: isSending };
};
