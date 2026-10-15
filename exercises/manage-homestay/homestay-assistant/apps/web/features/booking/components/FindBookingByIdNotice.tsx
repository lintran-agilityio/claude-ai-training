"use client";

import { ToolCallStatus, useAgent } from "@copilotkit/react-core/v2";

import { AGENT_KEYS } from "@repo/constants";
import { parseToolResult } from "@repo/utils";
import { resolveBookingUnavailableReason } from "@repo/schemas";

import { BookingUnavailable } from "@/components/confirm-modal";
import { EmbeddedWidget } from "@/features/chatbot/components";
import type { MessageLike } from "@/features/chatbot/types";
import { hasLaterToolCallInTurn } from "@/features/chatbot/utils";
import { resolveModifyResolveUnavailable } from "@/features/booking/utils";
import type {
  FindBookingByIdResult,
  FindBookingByIdToolProps,
} from "@/features/booking/types";

/**
 * `find_booking_by_id` renders nothing in chat for CANCEL, the no-stated-change
 * MODIFY path, or a free stated-change probe — a forced HITL owns the turn and
 * the row is dropped as a silent internal lookup (see `isSilentResolveToolCall`
 * in page-generative-ui.ts). The one case it must draw: a MODIFY
 * **stated-change** probe (the flow's replacement for a `check_room_availability`
 * tool call, which was removed) that came back taken / over capacity — the step
 * machine stops the turn, so this renders `BookingUnavailable`.
 */
export const FindBookingByIdNotice = ({
  status,
  result,
  toolCallId,
}: FindBookingByIdToolProps) => {
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });

  if (status !== ToolCallStatus.Complete) {
    return null;
  }

  const parsed = parseToolResult<FindBookingByIdResult>(result);
  const unavailable = resolveModifyResolveUnavailable(parsed);
  const booking = parsed?.bookings?.[0];
  const room = parsed?.room;
  const roomName = room?.name?.trim() || booking?.roomName?.trim();

  if (
    !unavailable ||
    !roomName ||
    hasLaterToolCallInTurn(
      agent.messages as MessageLike[] | undefined,
      toolCallId,
    )
  ) {
    return null;
  }

  return (
    <EmbeddedWidget>
      <BookingUnavailable
        roomId={room?.id ?? booking?.roomId}
        roomName={roomName}
        checkInDate={unavailable.checkInDate}
        checkOutDate={unavailable.checkOutDate}
        guests={unavailable.guests}
        reason={
          // Unreachable in practice — resolveModifyResolveUnavailable already
          // required capacity or dates to be false — the fallback is only
          // for the type checker.
          resolveBookingUnavailableReason(unavailable) ?? "dates_unavailable"
        }
        capacity={room?.capacity}
      />
    </EmbeddedWidget>
  );
};
