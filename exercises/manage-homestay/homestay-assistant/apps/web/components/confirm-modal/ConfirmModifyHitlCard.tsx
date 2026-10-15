"use client";

import type { ReactNode } from "react";
import { CalendarCheck } from "lucide-react";

import { ChangeSummary, ConfirmHitlCard } from "@/components/confirm-modal";
import {
  CONFIRM_BOOKING,
  getFailureMessage,
  HITL_CARD_PHASE,
  type HitlCardPhase,
} from "@/features/booking/constants";
import type { ModifyStaySnapshot } from "@/features/booking/types";
import {
  buildModifyChangeRows,
  type HitlDecisionStatus,
} from "@/features/booking/utils";
import { MODEL_NAME } from "@repo/types";

export type ConfirmModifyHitlCardProps = {
  roomName: string;
  pricePerNight: number;
  original: ModifyStaySnapshot;
  next: ModifyStaySnapshot;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
  canRespond?: boolean;
  errorMessage?: string | null;
  decisionStatus?: HitlDecisionStatus;
  /**
   * When set, modify-flow same-card phases own the UI (review → submitting →
   * success | failed | cancelled | expired).
   */
  modifyPhase?: HitlCardPhase;
  failureReason?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onViewBookings?: () => void;
  onRetry?: () => void;
  allActionsDisabled?: boolean;
  viewBookingsDisabled?: boolean;
  retryDisabled?: boolean;
};

const { title: MODIFY_TITLE, label: MODIFY_LABEL } = CONFIRM_BOOKING.MODIFY;

/**
 * Modify HITL card with before → after ChangeSummary.
 * Inline chat card — not a modal overlay.
 */
export const ConfirmModifyHitlCard = ({
  roomName,
  pricePerNight,
  original,
  next,
  title = MODIFY_TITLE.review,
  description,
  confirmLabel = MODIFY_LABEL.confirm,
  submittingLabel = MODIFY_LABEL.submitting,
  isSubmitting = false,
  canRespond = true,
  errorMessage = null,
  modifyPhase,
  failureReason = null,
  onCancel,
  onConfirm,
  onViewBookings,
  onRetry,
  allActionsDisabled = false,
  viewBookingsDisabled = false,
  retryDisabled = false,
}: ConfirmModifyHitlCardProps) => {
  const actionsDisabled = !canRespond || isSubmitting;
  const changes = buildModifyChangeRows(original, next, pricePerNight);
  const phase = modifyPhase ?? HITL_CARD_PHASE.REVIEW;
  const reviewDescription = description ?? (
    <>
      Review the changes for your stay at{" "}
      <span className="font-medium text-foreground">{roomName}</span> before
      saving.
    </>
  );

  return (
    <ConfirmHitlCard
      phase={phase}
      summary={<ChangeSummary changes={changes} />}
      accent="emerald"
      icon={CalendarCheck}
      confirmIcon={CalendarCheck}
      title={title}
      description={reviewDescription}
      confirmLabel={confirmLabel}
      submittingLabel={submittingLabel}
      submittingTitle={MODIFY_TITLE.submitting}
      submittingDescription={
        <>
          Please wait while we update your stay at{" "}
          <span className="font-medium text-foreground">{roomName}</span>.
        </>
      }
      successTitle={MODIFY_TITLE.success}
      successDescription={
        <>
          Your stay at{" "}
          <span className="font-medium text-foreground">{roomName}</span> has been
          updated.
        </>
      }
      failedTitle={MODIFY_TITLE.failed}
      failureMessage={
        failureReason?.trim() || getFailureMessage(MODEL_NAME.MODIFY)
      }
      cancelledTitle={MODIFY_TITLE.rejected}
      cancelledDescription={
        <>
          You cancelled confirmation for{" "}
          <span className="font-medium text-foreground">{roomName}</span>.
        </>
      }
      expiredTitle={MODIFY_TITLE.expired}
      expiredDescription={
        <>
          This confirmation for{" "}
          <span className="font-medium text-foreground">{roomName}</span> is no
          longer available.
        </>
      }
      cancelLabel={MODIFY_LABEL.cancel}
      viewBookingsLabel={MODIFY_LABEL.viewBookings}
      retryLabel={MODIFY_LABEL.retry}
      allActionsDisabled={allActionsDisabled}
      actionsDisabled={actionsDisabled}
      confirmDisabled={changes.length === 0}
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

/** @deprecated Use ConfirmModifyHitlCard */
export const ConfirmModifyBookingDialog = ConfirmModifyHitlCard;
/** @deprecated Use ConfirmModifyHitlCardProps */
export type ConfirmModifyBookingDialogProps = ConfirmModifyHitlCardProps;
