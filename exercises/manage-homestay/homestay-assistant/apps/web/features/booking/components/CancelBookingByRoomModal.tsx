"use client";

import { useState } from "react";
import { ToolCallStatus, useAgent } from "@copilotkit/react-core/v2";
import {
  AGENT_KEYS,
  HOMESTAY_AGENT_TASK_STATUS,
  HOMESTAY_AGENT_TASK_TYPE,
} from "@repo/constants";

import { EmbeddedWidget } from "@/features/chatbot/components";
import { useReportHomestayAgentUiFocus } from "@/features/chatbot/hooks";
import {
  hasBookingPickerFields,
  resolvePickerCompletedTitle,
  shouldRenderHitlCard,
} from "@/features/booking/utils";
import { useBookingPickerHitl } from "@/features/booking/hooks";
import type {
  CancelBookingByRoomArgs,
  CancelBookingByRoomResult,
} from "@repo/schemas";
import type { BookingDetails, HitlToolResult } from "@/features/booking/types";
import { PICKER_BOOKING } from "@/features/booking/constants";
import { BookingPickerCard } from "./BookingPickerCard";
import { ConfirmCancelBookingModal } from "./ConfirmCancelBookingModal";
import { HITL_DECISION_STATUS } from "@/constants";

type CancelBookingByRoomModalProps = {
  status: ToolCallStatus;
  args: Partial<CancelBookingByRoomArgs>;
  respond?: (result: CancelBookingByRoomResult) => Promise<void>;
  result?: HitlToolResult<CancelBookingByRoomResult>;
  toolCallId?: string;
};

type BookingItem = CancelBookingByRoomArgs["bookings"][number];

const toBookingDetails = (booking: BookingItem): BookingDetails => ({
  bookingId: booking.bookingId,
  roomName: booking.roomName,
  checkInDate: booking.checkInDate,
  checkOutDate: booking.checkOutDate,
  guests: booking.guests,
  totalPrice: booking.totalPrice,
});

export const CancelBookingByRoomModal = ({
  status,
  args,
  respond,
  result,
  toolCallId,
}: CancelBookingByRoomModalProps) => {
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });
  const [selectedBooking, setSelectedBooking] = useState<BookingDetails | null>(
    null,
  );
  const {
    respondOnce,
    canRespond,
    expiredBySupersede,
    decisionStatus,
    isComplete,
    isAwaiting: isAwaitingCancel,
    parsedResult,
    handleKeepBookings,
  } = useBookingPickerHitl<CancelBookingByRoomResult>(
    status,
    respond,
    toolCallId,
    result,
  );
  const isAgentBusy = agent.isRunning && !canRespond;

  const bookings = (args.bookings ?? []).filter(hasBookingPickerFields);
  const hasArgs = bookings.length > 0;
  const {
    CANCEL: { completed, title, description, keepLabel },
  } = PICKER_BOOKING;

  useReportHomestayAgentUiFocus(isAwaitingCancel, "cancel-flow", {
    type: HOMESTAY_AGENT_TASK_TYPE.CANCEL,
    status: HOMESTAY_AGENT_TASK_STATUS.AWAITING_CONFIRMATION,
  });

  if (!shouldRenderHitlCard(status, hasArgs)) {
    return null;
  }

  const confirmRespond = (bookingItem: BookingDetails) =>
    canRespond
      ? async (cancelResult: { confirmed: boolean; bookingId?: string }) => {
          if (isAgentBusy) {
            return;
          }

          if (cancelResult.confirmed && cancelResult.bookingId) {
            await respondOnce({
              confirmed: true,
              bookingId: cancelResult.bookingId,
              roomName: bookingItem.roomName,
            });
            return;
          }

          await respondOnce({ confirmed: false, reason: "declined" });
        }
      : undefined;

  const handleSelectBooking = (booking: BookingDetails) => {
    if (!canRespond || isAgentBusy) {
      return;
    }

    setSelectedBooking(booking);
  };

  const handleKeepBookingsWhenIdle = () => {
    if (!isAgentBusy) {
      handleKeepBookings();
    }
  };

  // After completion, prefer the confirmed booking card when we know which one.
  if (isComplete) {
    const completedBooking =
      parsedResult?.confirmed && parsedResult.bookingId
        ? bookings.find((b) => b.bookingId === parsedResult.bookingId)
        : bookings.length === 1
          ? bookings[0]
          : null;

    if (completedBooking) {
      return (
        <ConfirmCancelBookingModal
          status={status}
          bookingItem={toBookingDetails(completedBooking)}
          result={result}
          toolCallId={toolCallId}
          forceExpired={expiredBySupersede}
        />
      );
    }

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
              ? completed.expiredBody(args.queryName ?? "")
              : decisionStatus === HITL_DECISION_STATUS.REJECTED
                ? completed.keptAll(args.queryName ?? "")
                : completed.multiMatch(args.queryName ?? "")
          }
          bookings={bookings.map(toBookingDetails)}
        />
      </EmbeddedWidget>
    );
  }

  if (bookings.length === 1 && bookings[0]) {
    return (
      <ConfirmCancelBookingModal
        status={status}
        bookingItem={toBookingDetails(bookings[0])}
        respond={confirmRespond(toBookingDetails(bookings[0]))}
        result={result}
        toolCallId={toolCallId}
      />
    );
  }

  if (selectedBooking) {
    return (
      <ConfirmCancelBookingModal
        status={status}
        bookingItem={selectedBooking}
        respond={confirmRespond(selectedBooking)}
        result={result}
        toolCallId={toolCallId}
      />
    );
  }

  return (
    <EmbeddedWidget>
      <BookingPickerCard
        title={title}
        description={description(args.queryName ?? "")}
        bookings={bookings.map(toBookingDetails)}
        disabled={!canRespond || isAgentBusy}
        onSelect={handleSelectBooking}
        keepLabel={keepLabel}
        onKeep={handleKeepBookingsWhenIdle}
      />
    </EmbeddedWidget>
  );
};
