"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAgent, ToolCallStatus } from "@copilotkit/react-core/v2";
import {
  AGENT_KEYS,
  HOMESTAY_AGENT_TASK_STATUS,
  HOMESTAY_AGENT_TASK_TYPE,
} from "@repo/constants";
import { MODEL_NAME } from "@repo/types";
import { selectConfirmModifyCardView } from "@repo/utils";
import type {
  ConfirmBookingArgs,
  ConfirmBookingResult,
  ConfirmModifyBookingArgs,
  ConfirmModifyBookingResult,
} from "@repo/schemas";

import {
  ConfirmCreateHitlCard,
  ConfirmModifyHitlCard,
} from "@/components/confirm-modal";
import { EmbeddedWidget } from "@/features/chatbot/components";
import {
  BOOKINGS_PAGE_PATH,
  CONFIRM_BOOKING,
  HITL_CARD_PHASE,
} from "@/features/booking/constants";
import {
  useConfirmBookingRoom,
  useHitlConfirmDialog,
  useModifyBookingEpisode,
  useRetryCreateBooking,
  useRetryModifyBooking,
} from "@/features/booking/hooks";
import { useBookingStore } from "@/features/booking/stores/booking-store";
import { useCreateBookingCardStore } from "@/features/booking/stores/create-booking-card-store";
import { useModifyBookingCardStore } from "@/features/booking/stores/modify-booking-card-store";
import { useArtifactStore } from "@/features/chatbot/stores/artifact-store";
import { useReportHomestayAgentUiFocus } from "@/features/chatbot/hooks";
import {
  buildCreateStayCorrelationKey,
  buildModifyChangeRows,
  coalesceBookingCardOutcome,
  deriveCreateBookingOutcomeFromMessages,
  deriveModifyOutcomeFromEpisodeUpdate,
  hasRequiredCreateArgs,
  hasRoomStayFields,
  resolveHitlCardPhase,
  shouldRenderHitlCard,
} from "@/features/booking/utils";
import type {
  HitlToolResult,
  ModifyCardRoom,
} from "@/features/booking/types";

type HitlConfirmStayModalProps =
  | {
      variant: MODEL_NAME.CREATE;
      status: ToolCallStatus;
      args: Partial<ConfirmBookingArgs>;
      respond?: (result: ConfirmBookingResult) => Promise<void>;
      result?: HitlToolResult<ConfirmBookingResult>;
      toolCallId?: string;
    }
  | {
      variant: MODEL_NAME.MODIFY;
      status: ToolCallStatus;
      args: Partial<ConfirmModifyBookingArgs>;
      respond?: (result: ConfirmModifyBookingResult) => Promise<void>;
      result?: HitlToolResult<ConfirmModifyBookingResult>;
      toolCallId?: string;
    };

const HitlConfirmCreateStayModal = ({
  status,
  args,
  respond,
  result,
  toolCallId,
}: {
  status: ToolCallStatus;
  args: Partial<ConfirmBookingArgs>;
  respond?: (result: ConfirmBookingResult) => Promise<void>;
  result?: HitlToolResult<ConfirmBookingResult>;
  toolCallId?: string;
}) => {
  const router = useRouter();
  const {
    title: CREATE_TITLE,
    label: CREATE_LABEL,
    error: CREATE_ERROR,
  } = CONFIRM_BOOKING.CREATE;

  const resetBooking = useBookingStore((state) => state.resetBooking);
  const finalizeBookingForms = useArtifactStore(
    (state) => state.finalizeBookingForms,
  );
  const markSubmitting = useCreateBookingCardStore(
    (state) => state.markSubmitting,
  );
  const { retryCreateBooking, isRetrying } = useRetryCreateBooking();
  const {
    shouldRender,
    isSubmitting,
    errorMessage,
    canRespond,
    isActionable,
    expiredBySupersede,
    decisionStatus,
    handleDismiss,
    confirm,
  } = useHitlConfirmDialog(
    status,
    respond,
    CREATE_ERROR.confirm,
    result,
    toolCallId,
  );

  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });
  // A transport may keep isRunning true while HITL awaits respond(). Keep the
  // current prompt usable, then lock it as soon as respond() is consumed.
  const isAgentBusy = agent.isRunning && !canRespond;
  const hasArgs = hasRequiredCreateArgs(args);
  // confirm_booking args carry only roomId — hydrate the room (Booking Form
  // stash, or the find_room/get_room_by_id result in the transcript).
  const room = useConfirmBookingRoom(hasArgs ? args.roomId : undefined);
  const canRenderCard =
    hasArgs && room != null && typeof room.pricePerNight === "number";
  const correlationKey = hasArgs
    ? buildCreateStayCorrelationKey({
        roomId: args.roomId,
        checkInDate: args.checkInDate,
        checkOutDate: args.checkOutDate,
        guests: args.guests,
      })
    : null;
  const storeCreateOutcome = useCreateBookingCardStore((state) =>
    correlationKey
      ? (state.outcomesByCorrelationKey[correlationKey] ?? null)
      : null,
  );
  const createOutcome = coalesceBookingCardOutcome(
    storeCreateOutcome,
    deriveCreateBookingOutcomeFromMessages(agent.messages, correlationKey),
  );
  const createPhase = expiredBySupersede
    ? HITL_CARD_PHASE.EXPIRED
    : resolveHitlCardPhase({
        status: decisionStatus,
        isHitlSubmitting: isSubmitting,
        outcome: createOutcome,
      });

  const handleCancel = () => {
    if (isAgentBusy) {
      return;
    }

    finalizeBookingForms("cancelled");
    resetBooking();
    handleDismiss();
  };

  const handleConfirm = () => {
    if (isAgentBusy || !hasArgs || !correlationKey) {
      return;
    }

    markSubmitting(correlationKey);
    void confirm({
      confirmed: true,
      roomId: args.roomId,
      checkInDate: args.checkInDate,
      checkOutDate: args.checkOutDate,
      guests: args.guests,
    });
  };

  const handleRetry = () => {
    if (isAgentBusy || !correlationKey || isRetrying || !isActionable) {
      return;
    }

    markSubmitting(correlationKey);
    retryCreateBooking();
  };

  const handleViewBookings = () => {
    if (isAgentBusy) {
      return;
    }

    router.push(BOOKINGS_PAGE_PATH);
  };

  useReportHomestayAgentUiFocus(
    shouldRender && canRenderCard && canRespond,
    "confirm-booking",
    {
      type: HOMESTAY_AGENT_TASK_TYPE.BOOK,
      status: HOMESTAY_AGENT_TASK_STATUS.AWAITING_CONFIRMATION,
    },
    hasArgs ? { type: "room", id: args.roomId } : undefined,
  );

  if (
    !shouldRenderHitlCard(status, canRenderCard) ||
    !shouldRender ||
    !hasArgs ||
    room == null ||
    typeof room.pricePerNight !== "number"
  ) {
    return null;
  }

  const { checkInDate, checkOutDate, guests } = args;

  return (
    <EmbeddedWidget>
      <ConfirmCreateHitlCard
        roomName={room.name}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        guests={guests}
        pricePerNight={room.pricePerNight}
        title={CREATE_TITLE.review}
        confirmLabel={CREATE_LABEL.confirm}
        submittingLabel={CREATE_LABEL.submitting}
        isSubmitting={
          isSubmitting || createPhase === HITL_CARD_PHASE.SUBMITTING
        }
        canRespond={canRespond}
        decisionStatus={decisionStatus}
        createPhase={createPhase}
        failureReason={createOutcome?.errorMessage}
        totalPriceOverride={
          createPhase === HITL_CARD_PHASE.SUCCESS
            ? createOutcome?.totalPrice
            : undefined
        }
        errorMessage={errorMessage}
        allActionsDisabled={isAgentBusy}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        onViewBookings={handleViewBookings}
        onRetry={handleRetry}
        viewBookingsDisabled={!isActionable}
        retryDisabled={!isActionable}
      />
    </EmbeddedWidget>
  );
};

const HitlConfirmModifyStayModal = ({
  status,
  args,
  respond,
  result,
  toolCallId,
}: {
  status: ToolCallStatus;
  args: Partial<ConfirmModifyBookingArgs>;
  respond?: (result: ConfirmModifyBookingResult) => Promise<void>;
  result?: HitlToolResult<ConfirmModifyBookingResult>;
  toolCallId?: string;
}) => {
  const {
    title: MODIFY_TITLE,
    label: MODIFY_LABEL,
    error: MODIFY_ERROR,
  } = CONFIRM_BOOKING.MODIFY;
  const router = useRouter();

  const markSubmitting = useModifyBookingCardStore(
    (state) => state.markSubmitting,
  );
  const { retryModifyBooking, isRetrying } = useRetryModifyBooking();
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });
  const {
    shouldRender,
    isSubmitting,
    errorMessage,
    canRespond,
    isActionable,
    expiredBySupersede,
    decisionStatus,
    handleDismiss,
    confirm,
  } = useHitlConfirmDialog(
    status,
    respond,
    MODIFY_ERROR.confirm,
    result,
    toolCallId,
  );
  // Executing is the active user-decision phase, so its open run must not
  // disable the controls needed to resolve that run.
  const isAgentBusy = agent.isRunning && !canRespond;

  // Everything booking-scoped on this card comes from ITS OWN modify episode —
  // the find_booking_by_id / edit form / update_booking around this card's tool
  // call (see selectModifyEpisode). confirm_modify_booking args are
  // model-authored: a weak model copies the booking's original check-out into
  // `checkOutDate`, drops `room`, or re-sends the previous modify's booking —
  // and a whole-transcript scan let modify A's lookup answer modify B's card.
  const episode = useModifyBookingEpisode({
    toolCallId,
    bookingId: args.bookingId,
  });
  const editToolCallId = episode?.edit?.toolCallId;
  const editStash = useBookingStore((state) =>
    editToolCallId ? (state.pendingModifyStays[editToolCallId] ?? null) : null,
  );
  // `bookingId` is also what Confirm sends to update_booking, so the card can
  // never confirm one booking with another booking's stay.
  const {
    bookingId,
    room,
    checkInDate,
    checkOutDate,
    guests,
    original: episodeOriginal,
  } = selectConfirmModifyCardView<ModifyCardRoom>({
    episode,
    args,
    editStash,
  });

  const hasArgs =
    Boolean(bookingId) &&
    hasRoomStayFields({ room, checkInDate, checkOutDate, guests });

  // Phase is per card: the optimistic "submitting" mark is keyed by this
  // card's toolCallId and the settled outcome is the update_booking in its own
  // episode — confirming another card can never flip this one.
  const storeModifyOutcome = useModifyBookingCardStore((state) =>
    toolCallId ? (state.outcomesByCardId[toolCallId] ?? null) : null,
  );
  const modifyOutcome = coalesceBookingCardOutcome(
    storeModifyOutcome,
    deriveModifyOutcomeFromEpisodeUpdate(episode?.update),
  );
  const modifyPhase = expiredBySupersede
    ? HITL_CARD_PHASE.EXPIRED
    : resolveHitlCardPhase({
        status: decisionStatus,
        isHitlSubmitting: isSubmitting,
        outcome: modifyOutcome,
      });

  const original = hasArgs ? episodeOriginal : null;
  const hasNoFieldChanges =
    Boolean(original) &&
    hasArgs &&
    buildModifyChangeRows(
      original!,
      { checkInDate, checkOutDate, guests },
      room?.pricePerNight ?? 0,
    ).length === 0;

  const dismissedNoopRef = useRef(false);
  useEffect(() => {
    if (!hasNoFieldChanges || !canRespond || dismissedNoopRef.current) {
      return;
    }
    dismissedNoopRef.current = true;
    handleDismiss();
  }, [hasNoFieldChanges, canRespond, handleDismiss]);

  useReportHomestayAgentUiFocus(
    shouldRender && hasArgs && canRespond && !hasNoFieldChanges,
    "confirm-modify-booking",
    {
      type: HOMESTAY_AGENT_TASK_TYPE.MANAGE,
      status: HOMESTAY_AGENT_TASK_STATUS.AWAITING_CONFIRMATION,
    },
    hasArgs ? { type: "booking", id: bookingId } : undefined,
  );

  if (
    !shouldRenderHitlCard(status, hasArgs) ||
    !shouldRender ||
    !hasArgs ||
    !room ||
    typeof room.pricePerNight !== "number" ||
    hasNoFieldChanges
  ) {
    return null;
  }

  const description: ReactNode = (
    <>
      Review the changes for your stay at{" "}
      <span className="font-medium text-foreground">{room.name}</span> before
      saving.
    </>
  );

  const handleCancel = () => {
    if (isAgentBusy) {
      return;
    }

    handleDismiss();
  };

  const handleConfirm = () => {
    if (isAgentBusy) {
      return;
    }

    if (toolCallId) {
      markSubmitting(toolCallId);
    }
    void confirm({
      confirmed: true,
      bookingId,
      checkInDate,
      checkOutDate,
      guests,
    });
  };

  const handleRetry = () => {
    if (isAgentBusy || isRetrying || !isActionable) {
      return;
    }

    if (toolCallId) {
      markSubmitting(toolCallId);
    }
    retryModifyBooking();
  };

  const isPhaseSubmitting =
    isSubmitting || modifyPhase === HITL_CARD_PHASE.SUBMITTING;
  const viewBookings = () => {
    if (isAgentBusy) {
      return;
    }

    router.push(BOOKINGS_PAGE_PATH);
  };
  const retry = handleRetry;
  const isActionDisabled = !isActionable;

  // Without originals we cannot render before→after diffs — fall back to the
  // create-style summary of the proposed stay only.
  if (!original) {
    return (
      <EmbeddedWidget>
        <ConfirmCreateHitlCard
          roomName={room.name}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          guests={guests}
          pricePerNight={room.pricePerNight}
          title={MODIFY_TITLE.review}
          description={description}
          confirmLabel={MODIFY_LABEL.confirm}
          submittingLabel={MODIFY_LABEL.submitting}
          isSubmitting={isPhaseSubmitting}
          canRespond={canRespond}
          decisionStatus={decisionStatus}
          modifyPhase={modifyPhase}
          failureReason={modifyOutcome?.errorMessage}
          errorMessage={errorMessage}
          allActionsDisabled={isAgentBusy}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          onViewBookings={viewBookings}
          onRetry={retry}
          viewBookingsDisabled={isActionDisabled}
          retryDisabled={isActionDisabled}
        />
      </EmbeddedWidget>
    );
  }

  return (
    <EmbeddedWidget>
      <ConfirmModifyHitlCard
        roomName={room.name}
        pricePerNight={room.pricePerNight}
        original={original}
        next={{ checkInDate, checkOutDate, guests }}
        description={description}
        isSubmitting={isPhaseSubmitting}
        canRespond={canRespond}
        decisionStatus={decisionStatus}
        modifyPhase={modifyPhase}
        failureReason={modifyOutcome?.errorMessage}
        errorMessage={errorMessage}
        allActionsDisabled={isAgentBusy}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        onViewBookings={viewBookings}
        onRetry={retry}
        viewBookingsDisabled={isActionDisabled}
        retryDisabled={isActionDisabled}
      />
    </EmbeddedWidget>
  );
};

export const HitlConfirmStayModal = (props: HitlConfirmStayModalProps) => {
  const { variant, status, args, respond, result, toolCallId } = props || {
    variant: MODEL_NAME.MODIFY,
    status: ToolCallStatus.Complete,
    args: {},
    respond: undefined,
    result: undefined,
    toolCallId: undefined,
  };

  if (variant === MODEL_NAME.CREATE) {
    return (
      <HitlConfirmCreateStayModal
        status={status}
        args={args}
        respond={respond}
        result={result}
        toolCallId={toolCallId}
      />
    );
  }

  return (
    <HitlConfirmModifyStayModal
      status={status}
      args={args}
      respond={respond}
      result={result}
      toolCallId={toolCallId}
    />
  );
};
