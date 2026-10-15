"use client";

import { useCallback } from "react";

import type { BookingResponse } from "@/features/booking/types/booking";
import { useBookingStore } from "@/features/booking/stores/booking-store";
import {
  buildBookingCancelMessage,
  buildBookingModifyMessage,
} from "@/features/booking/utils";
import { useSendAgentMessage } from "@/features/chatbot/hooks";

/** Selector hook over the module booking store. */
export const useBooking = useBookingStore;

const useBookingAgentAction = (
  buildMessage: (booking: BookingResponse) => string,
  label: string,
) => {
  const { sendMessage } = useSendAgentMessage({
    onError: (error) => {
      console.error(`Failed to start ${label} flow`, error);
    },
  });

  return useCallback(
    (booking: BookingResponse) => {
      if (!booking.id || !booking.room) {
        return;
      }

      sendMessage(buildMessage(booking));
    },
    [buildMessage, sendMessage],
  );
};

export const useCancelBooking = () =>
  useBookingAgentAction(buildBookingCancelMessage, "cancel booking");

export const useModifyBooking = () =>
  useBookingAgentAction(buildBookingModifyMessage, "modify booking");
