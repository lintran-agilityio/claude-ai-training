"use client";

import { AlertTriangle } from "lucide-react";

import { ConfirmHitlCard } from "@/components/confirm-modal/ConfirmHitlCard";
import { StaySummary } from "@/components/confirm-modal/StaySummary";
import {
  CONFIRM_BOOKING,
  getFailureMessage,
  HITL_CARD_PHASE,
  type HitlCardPhase,
} from "@/features/booking/constants";
import type { HitlDecisionStatus } from "@/features/booking/utils";
import type { BookingDetails } from "@/features/booking/types";
import { MODEL_NAME } from "@repo/types";

export type ConfirmCancelHitlCardProps = {
  booking: BookingDetails;
  isDeleting?: boolean;
  canRespond?: boolean;
  errorMessage?: string | null;
  decisionStatus?: HitlDecisionStatus;
  /**
   * When set, cancel-flow same-card phases own the UI (review → submitting →
   * success | failed | cancelled | expired).
   */
  cancelPhase?: HitlCardPhase;
  failureReason?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onViewBookings?: () => void;
  onRetry?: () => void;
  allActionsDisabled?: boolean;
  viewBookingsDisabled?: boolean;
  retryDisabled?: boolean;
};

const { title: CANCEL_TITLE, label: CANCEL_LABEL } = CONFIRM_BOOKING.CANCEL;

/**
 * Cancel HITL card. Inline chat card — not a modal overlay.
 */
export const ConfirmCancelHitlCard = ({
  booking,
  isDeleting = false,
  canRespond = true,
  errorMessage = null,
  cancelPhase,
  failureReason = null,
  onCancel,
  onConfirm,
  onViewBookings,
  onRetry,
  allActionsDisabled = false,
  viewBookingsDisabled = false,
  retryDisabled = false,
}: ConfirmCancelHitlCardProps) => {
  const actionsDisabled = !canRespond || isDeleting;
  const { roomName, checkInDate, checkOutDate, guests, totalPrice } = booking;
  const phase = cancelPhase ?? HITL_CARD_PHASE.REVIEW;

  return (
    <ConfirmHitlCard
      phase={phase}
      summary={
        <StaySummary
          roomName={roomName}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          guests={guests}
          totalPrice={totalPrice}
        />
      }
      accent="destructive"
      icon={AlertTriangle}
      confirmVariant="destructive"
      title={CANCEL_TITLE.review}
      description={
        <>
          This will cancel your reservation for{" "}
          <span className="font-medium text-foreground">{roomName}</span>. This
          action cannot be undone.
        </>
      }
      confirmLabel={CANCEL_LABEL.confirm}
      submittingLabel={CANCEL_LABEL.submitting}
      submittingTitle={CANCEL_TITLE.submitting}
      submittingDescription={
        <>
          Please wait while we cancel your stay at{" "}
          <span className="font-medium text-foreground">{roomName}</span>.
        </>
      }
      successTitle={CANCEL_TITLE.success}
      successDescription={
        <>
          Your stay at{" "}
          <span className="font-medium text-foreground">{roomName}</span> has been
          cancelled.
        </>
      }
      failedTitle={CANCEL_TITLE.failed}
      failureMessage={
        failureReason?.trim() || getFailureMessage(MODEL_NAME.CANCEL)
      }
      cancelledTitle={CANCEL_TITLE.rejected}
      cancelledDescription={
        <>
          You kept your reservation for{" "}
          <span className="font-medium text-foreground">{roomName}</span>.
        </>
      }
      expiredTitle={CANCEL_TITLE.expired}
      expiredDescription={
        <>
          This cancellation confirmation for{" "}
          <span className="font-medium text-foreground">{roomName}</span> is no
          longer available.
        </>
      }
      cancelLabel={CANCEL_LABEL.keep}
      viewBookingsLabel={CANCEL_LABEL.viewBookings}
      retryLabel={CANCEL_LABEL.retry}
      allActionsDisabled={allActionsDisabled}
      actionsDisabled={actionsDisabled}
      errorMessage={errorMessage}
      onCancel={onCancel}
      onConfirm={onConfirm}
      onViewBookings={onViewBookings}
      onRetry={onRetry}
      viewBookingsDisabled={viewBookingsDisabled}
      retryDisabled={retryDisabled}
    />
  );
};
