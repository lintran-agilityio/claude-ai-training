"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CalendarCheck } from "lucide-react";
import {
  ToolCallStatus,
  useAgent,
  useCopilotKit,
} from "@copilotkit/react-core/v2";
import {
  AGENT_KEYS,
  HOMESTAY_AGENT_TASK_STATUS,
  HOMESTAY_AGENT_TASK_TYPE,
} from "@repo/constants";
import { parseToolResult } from "@repo/utils";
import { describeBookingUnavailableIssue } from "@repo/schemas";

import { Button } from "@/components/ui/button";
import { EmbeddedWidget } from "@/features/chatbot/components";
import {
  useReportHomestayAgentUiFocus,
  useSupersedeHitlOnNewInteraction,
} from "@/features/chatbot/hooks";
import {
  isHitlDecisionTerminal,
  isHitlToolRespondable,
  resolveHitlDecisionStatus,
  shouldRenderHitlCard,
  useHitlRespondOnce,
  type HitlDecisionStatus,
} from "@/features/booking/utils";
import type {
  EditModifyBookingArgs,
  EditModifyBookingResult,
} from "@repo/schemas";
import type { HitlToolResult } from "@/features/booking/types";
import { useBookingStore } from "@/features/booking/stores/booking-store";
import {
  RoomBookingDates,
  RoomBookingEstimatedTotal,
  RoomBookingGuests,
  RoomBookingPreviewCard,
} from "@/features/room/components";
import { useRoomAvailability, useRoomBookingEstimate } from "@/features/room/hooks";
import { resolveCheckOutAfterCheckInChange } from "@/features/room/utils";
import { HITL_DECISION_STATUS } from "@/constants";

type EditModifyBookingModalProps = {
  status: ToolCallStatus;
  args: Partial<EditModifyBookingArgs>;
  respond?: (result: EditModifyBookingResult) => Promise<void>;
  result?: HitlToolResult<EditModifyBookingResult>;
  toolCallId?: string;
};

const hasRequiredArgs = (args: Partial<EditModifyBookingArgs>) =>
  Boolean(
    args.bookingId?.trim() &&
      args.room?.id?.trim() &&
      args.room?.name?.trim() &&
      typeof args.room?.capacity === "number" &&
      typeof args.room?.pricePerNight === "number" &&
      args.checkInDate?.trim() &&
      args.checkOutDate?.trim() &&
      typeof args.guests === "number" &&
      args.guests > 0,
  );

// APPROVED is handled by an earlier return (the form hides itself once the
// guest confirms — see the confirm_modify_booking hand-off above), so this
// only ever renders REJECTED or EXPIRED settled copy.
const getSettledCopy = (
  decisionStatus: HitlDecisionStatus,
  roomName: string,
): { title: string; description: ReactNode } => {
  if (decisionStatus === HITL_DECISION_STATUS.REJECTED) {
    return {
      title: "Cancelled by you",
      description: (
        <>
          You kept the current booking for{" "}
          <span className="font-medium text-foreground">{roomName}</span>.
        </>
      ),
    };
  }

  return {
    title: "Confirmation expired",
    description: (
      <>
        This modify confirmation for{" "}
        <span className="font-medium text-foreground">{roomName}</span> is no
        longer available.
      </>
    ),
  };
};

export const EditModifyBookingModal = ({
  status,
  args,
  respond,
  result,
  toolCallId,
}: EditModifyBookingModalProps) => {
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });
  const { copilotkit } = useCopilotKit();
  const { respondOnce, canRespond: canRespondHitl } =
    useHitlRespondOnce<EditModifyBookingResult>(respond);
  const stashPendingModifyStay = useBookingStore(
    (state) => state.stashPendingModifyStay,
  );

  const supersedeDismiss = useCallback(() => {
    void respondOnce({ confirmed: false });
  }, [respondOnce]);

  const { isActionable, expiredBySupersede } = useSupersedeHitlOnNewInteraction({
    toolCallId,
    canRespond: canRespondHitl,
    onSupersede: supersedeDismiss,
  });

  const hasArgs = hasRequiredArgs(args);
  const decisionStatus = expiredBySupersede
    ? HITL_DECISION_STATUS.EXPIRED
    : resolveHitlDecisionStatus(status, result);
  const isComplete = isHitlDecisionTerminal(decisionStatus);
  const ready =
    isHitlToolRespondable(status, respond) &&
    hasArgs &&
    !isComplete &&
    isActionable;

  const bookingId = args.bookingId ?? "";
  const parsedResult = parseToolResult<EditModifyBookingResult>(
    result as EditModifyBookingResult | string | null | undefined,
  );

  useReportHomestayAgentUiFocus(
    ready,
    "modify-flow",
    {
      type: HOMESTAY_AGENT_TASK_TYPE.MANAGE,
      status: HOMESTAY_AGENT_TASK_STATUS.IN_PROGRESS,
    },
    ready ? { type: "booking", id: bookingId } : undefined,
  );
  const room = args.room;
  const initialCheckIn =
    (parsedResult?.confirmed
      ? parsedResult.checkInDate
      : args.checkInDate)?.trim() || null;
  const initialCheckOut =
    (parsedResult?.confirmed
      ? parsedResult.checkOutDate
      : args.checkOutDate)?.trim() || null;
  const initialGuests =
    parsedResult?.confirmed && typeof parsedResult.guests === "number"
      ? parsedResult.guests
      : typeof args.guests === "number" && args.guests > 0
        ? args.guests
        : 1;

  const [checkInDate, setCheckInDate] = useState<string | null>(initialCheckIn);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(
    initialCheckOut,
  );
  const [guests, setGuests] = useState(initialGuests);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [datesSeed, setDatesSeed] = useState(
    `${initialCheckIn ?? ""}:${initialCheckOut ?? ""}`,
  );

  useEffect(() => {
    if (!hasArgs || !initialCheckIn || !initialCheckOut || !room) {
      return;
    }

    const nextSeed = `${initialCheckIn}:${initialCheckOut}`;
    setCheckInDate(initialCheckIn);
    setCheckOutDate(initialCheckOut);
    setGuests(Math.min(Math.max(1, initialGuests), room.capacity));
    setErrorMessage(null);
    setDatesSeed(nextSeed);
  }, [hasArgs, initialCheckIn, initialCheckOut, initialGuests, room]);

  const canRespondToCurrentHitl = canRespondHitl && ready && room != null;
  const isAgentBusy = agent.isRunning && !canRespondToCurrentHitl;
  const canRespond = canRespondToCurrentHitl && !isAgentBusy;

  const { canProceed, estimatedTotal } = useRoomBookingEstimate({
    checkInDate,
    checkOutDate,
    pricePerNight: room?.pricePerNight,
    guests,
    capacity: room?.capacity ?? 0,
  });

  // Client-side availability check — the MODIFY flow has no
  // check_room_availability tool call, so the form flags a taken date before it
  // confirms. excludeBookingId keeps the booking's own current dates from
  // reading as taken. update_booking still re-checks server-side.
  const availability = useRoomAvailability({
    roomId: room?.id,
    checkInDate,
    checkOutDate,
    guests,
    excludeBookingId: bookingId || null,
    enabled: !isComplete,
  });
  const isDatesUnavailable = availability.isAvailable === false;

  const hasStayChanges =
    checkInDate !== (args.checkInDate?.trim() || null) ||
    checkOutDate !== (args.checkOutDate?.trim() || null) ||
    guests !== args.guests;

  const canSubmit =
    canRespond &&
    canProceed &&
    hasStayChanges &&
    !isDatesUnavailable &&
    !availability.isChecking;

  if (!shouldRenderHitlCard(status, hasArgs) || !room) {
    return null;
  }

  if (isComplete && decisionStatus === HITL_DECISION_STATUS.APPROVED) {
    // After the guest confirms new dates/guests, hide this form — the
    // confirm_modify_booking diff card is the next step (no leftover
    // "Confirmed by you" card stacked above it).
    return null;
  }

  const handleCancel = async () => {
    if (!canRespond) {
      return;
    }

    await respondOnce({ confirmed: false });
    copilotkit.stopAgent({ agent });
  };

  const handleCheckInChange = (dateKey: string) => {
    if (isComplete) {
      return;
    }

    const next = resolveCheckOutAfterCheckInChange(dateKey, checkOutDate);
    setCheckInDate(next.checkInDate);
    if (next.checkOutDate !== checkOutDate) {
      setCheckOutDate(next.checkOutDate);
    }
  };

  const handleConfirm = async () => {
    if (!canSubmit || !checkInDate || !checkOutDate) {
      return;
    }

    const originalCheckInDate = args.checkInDate?.trim();
    const originalCheckOutDate = args.checkOutDate?.trim();
    const originalGuests = args.guests;
    if (
      !originalCheckInDate ||
      !originalCheckOutDate ||
      typeof originalGuests !== "number" ||
      originalGuests <= 0
    ) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Persist the guest-selected stay + originals so confirm_modify_booking
      // can render before→after diffs without trusting stale LLM args. Keyed
      // by this form's toolCallId: only the confirm card of the same modify
      // episode reads it (see selectModifyEpisode).
      if (toolCallId) {
        stashPendingModifyStay(toolCallId, {
          bookingId,
          checkInDate,
          checkOutDate,
          guests,
          original: {
            checkInDate: originalCheckInDate,
            checkOutDate: originalCheckOutDate,
            guests: originalGuests,
          },
        });
      }
      await respondOnce({
        confirmed: true,
        bookingId,
        roomId: room.id,
        checkInDate,
        checkOutDate,
        guests,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to continue booking update",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionsDisabled = !canRespond || isSubmitting || isComplete;
  const fieldsDisabled = actionsDisabled;
  const settled = isComplete ? getSettledCopy(decisionStatus, room.name) : null;

  return (
    <EmbeddedWidget>
      <div className="space-y-3 p-3.5 text-foreground">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-foreground">
            {settled?.title ?? "Modify your booking"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {settled?.description ?? (
                <>
                  Update check-in, check-out, or guests for{" "}
                  <span className="font-medium text-foreground">{room.name}</span>
                  . The room stays the same.
                </>
              )}
            </p>
          </div>

          <div className="space-y-3">
            <RoomBookingPreviewCard
              name={room.name}
              imageUrl={room.imageUrl}
              capacity={room.capacity}
              pricePerNight={room.pricePerNight}
            />

            <RoomBookingDates
              key={datesSeed}
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              disabled={fieldsDisabled}
              onCheckInChange={handleCheckInChange}
              onCheckOutChange={
                fieldsDisabled ? () => undefined : setCheckOutDate
              }
            />

            <RoomBookingGuests
              guests={guests}
              capacity={room.capacity}
              disabled={fieldsDisabled}
              onGuestsChange={setGuests}
            />

            <RoomBookingEstimatedTotal estimatedTotal={estimatedTotal} />

            {!isComplete && isDatesUnavailable && availability.reason ? (
              <p className="text-xs text-destructive">
                {describeBookingUnavailableIssue(availability.reason, room.capacity)}
              </p>
            ) : !isComplete && availability.isChecking ? (
              <p className="text-xs text-muted-foreground">
                Checking availability…
              </p>
            ) : null}

            {errorMessage ? (
              <p className="text-xs text-destructive">{errorMessage}</p>
            ) : null}
          </div>

          {isComplete ? null : (
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={actionsDisabled}
                onClick={handleCancel}
              >
                Keep current booking
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 cursor-pointer"
                disabled={!canSubmit || isSubmitting}
                onClick={handleConfirm}
              >
                <CalendarCheck className="size-3.5" />
                {isSubmitting ? "Continuing…" : "Continue"}
              </Button>
            </div>
          )}
        </div>
      </EmbeddedWidget>
  );
};
