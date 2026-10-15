"use client";

import { useMemo } from "react";
import { ToolCallStatus, useAgent } from "@copilotkit/react-core/v2";
import {
  AGENT_KEYS,
  HOMESTAY_AGENT_TASK_STATUS,
  HOMESTAY_AGENT_TASK_TYPE,
} from "@repo/constants";

import { EmbeddedWidget } from "@/features/chatbot/components";
import { useReportHomestayAgentUiFocus } from "@/features/chatbot/hooks";
import type { MessageLike } from "@/features/chatbot/types";
import {
  hasBookingPickerFields,
  resolveModifyPickerBookingsFromMessages,
  resolvePickerCompletedTitle,
  shouldRenderHitlCard,
} from "@/features/booking/utils";
import { useBookingPickerHitl } from "@/features/booking/hooks";
import type {
  ModifyBookingByRoomArgs,
  ModifyBookingByRoomResult,
} from "@repo/schemas";
import type { BookingDetails, HitlToolResult } from "@/features/booking/types";
import { PICKER_BOOKING } from "@/features/booking/constants";
import { BookingPickerCard } from "./BookingPickerCard";
import { HITL_DECISION_STATUS } from "@/constants";

type ModifyBookingByRoomModalProps = {
  status: ToolCallStatus;
  args: Partial<ModifyBookingByRoomArgs>;
  respond?: (result: ModifyBookingByRoomResult) => Promise<void>;
  result?: HitlToolResult<ModifyBookingByRoomResult>;
  toolCallId?: string;
};

const MODIFY_FOCUS_TASK = {
  type: HOMESTAY_AGENT_TASK_TYPE.MANAGE,
  status: HOMESTAY_AGENT_TASK_STATUS.AWAITING_CONFIRMATION,
} as const;

export const ModifyBookingByRoomModal = ({
  status,
  args,
  respond,
  result,
  toolCallId,
}: ModifyBookingByRoomModalProps) => {
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });
  const {
    respondOnce,
    canRespond,
    expiredBySupersede,
    decisionStatus,
    isComplete,
    isAwaiting: isAwaitingSelect,
    parsedResult,
    handleKeepBookings,
  } = useBookingPickerHitl<ModifyBookingByRoomResult>(
    status,
    respond,
    toolCallId,
    result,
  );
  const isAgentBusy = agent.isRunning && !canRespond;
  const { completed, title, description, keepLabel } = PICKER_BOOKING.MODIFY;


  const bookingsFromArgs = useMemo(
    () => (args.bookings ?? []).filter(hasBookingPickerFields),
    [args.bookings],
  );

  const bookingsFromMessages = useMemo(
    () =>
      resolveModifyPickerBookingsFromMessages(
        agent.messages as MessageLike[] | undefined,
        args.bookingIds,
      ),
    [agent.messages, args.bookingIds],
  );

  const bookings =
    bookingsFromArgs.length > 0 ? bookingsFromArgs : bookingsFromMessages;

  const hasArgs = bookings.length > 0;

  useReportHomestayAgentUiFocus(
    isAwaitingSelect,
    "modify-flow",
    MODIFY_FOCUS_TASK,
  );

  if (!shouldRenderHitlCard(status, hasArgs)) {
    return null;
  }

  const handleSelectBooking = (booking: BookingDetails) => {
    if (!canRespond || isAgentBusy) {
      return;
    }

    void respondOnce({
      confirmed: true,
      bookingId: booking.bookingId,
      roomName: booking.roomName,
    });
  };

  const handleKeepBookingsWhenIdle = () => {
    if (!isAgentBusy) {
      handleKeepBookings();
    }
  };

  if (isComplete) {
    // After the guest picks a stay, hide this picker — the modify confirm /
    // edit HITL is the response (no leftover "Selected by you" card).
    if (
      !expiredBySupersede &&
      decisionStatus === HITL_DECISION_STATUS.APPROVED
    ) {
      return null;
    }

    const completedBooking =
      parsedResult?.confirmed && parsedResult.bookingId
        ? bookings.find((b) => b.bookingId === parsedResult.bookingId)
        : bookings.length === 1
          ? bookings[0]
          : null;

    return (
      <EmbeddedWidget>
        <BookingPickerCard
          title={resolvePickerCompletedTitle(
            completed,
            decisionStatus,
            expiredBySupersede,
          )}
          description={
            expiredBySupersede
              ? completed.expiredBody(
                  args.queryName ?? "",
                )
              : decisionStatus === HITL_DECISION_STATUS.REJECTED
                ? completed.keptAll(args.queryName ?? "")
                : completedBooking
                  ? `${completedBooking.roomName} · ${completedBooking.checkInDate} → ${completedBooking.checkOutDate}`
                  : completed.multiMatch(
                      args.queryName ?? "",
                    )
          }
          bookings={completedBooking ? [] : bookings}
        />
      </EmbeddedWidget>
    );
  }

  return (
    <EmbeddedWidget>
      <BookingPickerCard
        title={title}
        description={description(args.queryName ?? "")}
        bookings={bookings}
        disabled={!canRespond || isAgentBusy}
        onSelect={handleSelectBooking}
        keepLabel={keepLabel}
        onKeep={handleKeepBookingsWhenIdle}
      />
    </EmbeddedWidget>
  );
};
