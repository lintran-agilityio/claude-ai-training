"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ToolCallStatus } from "@copilotkit/react-core/v2";
import { parseToolResult } from "@repo/utils";

import type {
  UpdateBookingResult,
  UpdateBookingToolProps,
} from "@/features/booking/types";
import { isUpdateBookingSuccess } from "@/features/booking/utils";

/**
 * Headless update_booking bridge: refreshes the bookings list after a
 * successful update. Renders nothing — the confirm_modify_booking card that
 * owns this update reads its submitting/success/failed phase from its own
 * episode in the transcript (see selectModifyEpisode), so this bridge never
 * publishes phases into shared card state.
 */
export const UpdateBookingNotice = ({
  status,
  result,
}: UpdateBookingToolProps) => {
  const queryClient = useQueryClient();
  const refreshedBookingId = useRef<string | null>(null);

  useEffect(() => {
    if (status !== ToolCallStatus.Complete || !isUpdateBookingSuccess(result)) {
      return;
    }

    const bookingId = parseToolResult<UpdateBookingResult>(result)?.id?.trim();
    if (!bookingId || refreshedBookingId.current === bookingId) {
      return;
    }

    refreshedBookingId.current = bookingId;
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
  }, [status, result, queryClient]);

  return null;
};
