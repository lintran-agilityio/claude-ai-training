"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ConfirmHitlHeader,
  type ConfirmHitlHeaderTone,
} from "@/components/confirm-modal/ConfirmHitlHeader";
import {
  HITL_CARD_PHASE,
  type HitlCardPhase,
} from "@/features/booking/constants";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export type ConfirmHitlAccent = "emerald" | "destructive";

export type ConfirmHitlCardProps = {
  phase: HitlCardPhase;
  summary: ReactNode;

  /** Review-phase title (submitting uses submittingTitle). */
  title: string;
  description?: ReactNode;
  submittingTitle: string;
  submittingDescription: ReactNode;
  successTitle: string;
  successDescription: ReactNode;
  failedTitle: string;
  /** Resolved failure copy (caller applies trim / default). */
  failureMessage: string;
  cancelledTitle: string;
  cancelledDescription: ReactNode;
  expiredTitle: string;
  expiredDescription: ReactNode;

  confirmLabel: string;
  submittingLabel: string;
  cancelLabel: string;
  viewBookingsLabel: string;
  retryLabel: string;

  accent: ConfirmHitlAccent;
  icon: LucideIcon;
  confirmVariant?: "default" | "destructive";
  confirmIcon?: LucideIcon;
  /** Disables every action in every rendered phase. */
  allActionsDisabled?: boolean;
  actionsDisabled?: boolean;
  confirmDisabled?: boolean;
  /** Grays out View bookings instead of unmounting it — avoids stuck UI when actionability flips transiently. */
  viewBookingsDisabled?: boolean;
  /** Grays out Retry instead of unmounting it — avoids stuck UI when actionability flips transiently. */
  retryDisabled?: boolean;
  errorMessage?: string | null;

  onCancel: () => void;
  onConfirm: () => void;
  onViewBookings?: () => void;
  onRetry?: () => void;
};

const reviewTone = (accent: ConfirmHitlAccent): ConfirmHitlHeaderTone =>
  accent === "destructive" ? "destructive" : "emerald";

/**
 * Shared HITL confirmation card phase presentation.
 * Feature wrappers supply copy, accent, icon, and summary body.
 */
export const ConfirmHitlCard = ({
  phase,
  summary,
  title,
  description,
  submittingTitle,
  submittingDescription,
  successTitle,
  successDescription,
  failedTitle,
  failureMessage,
  cancelledTitle,
  cancelledDescription,
  expiredTitle,
  expiredDescription,
  confirmLabel,
  submittingLabel,
  cancelLabel,
  viewBookingsLabel,
  retryLabel,
  accent,
  icon: Icon,
  confirmVariant = "default",
  confirmIcon: ConfirmIcon,
  allActionsDisabled = false,
  actionsDisabled = false,
  confirmDisabled = false,
  viewBookingsDisabled = false,
  retryDisabled = false,
  errorMessage = null,
  onCancel,
  onConfirm,
  onViewBookings,
  onRetry,
}: ConfirmHitlCardProps) => {
  switch (phase) {
    case HITL_CARD_PHASE.SUCCESS:
      return (
        <div className="space-y-3 p-3.5 text-foreground">
          <div className="flex items-start gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="text-sm font-medium text-primary">
                {successTitle}
              </h3>
              <p className="text-xs text-muted-foreground">{successDescription}</p>
            </div>
          </div>

          {summary}

          {onViewBookings ? (
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={allActionsDisabled || viewBookingsDisabled}
                onClick={onViewBookings}
              >
                {viewBookingsLabel}
              </Button>
            </div>
          ) : null}
        </div>
      );

    case HITL_CARD_PHASE.FAILED:
      return (
        <div className="space-y-3 p-3.5 text-foreground">
          <div className="flex items-start gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <XCircle className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="text-sm font-medium text-destructive">{failedTitle}</h3>
              <p className="text-xs text-muted-foreground">{failureMessage}</p>
            </div>
          </div>

          {summary}

          {onRetry ? (
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={allActionsDisabled || retryDisabled}
                onClick={onRetry}
              >
                {retryLabel}
              </Button>
            </div>
          ) : null}
        </div>
      );

    case HITL_CARD_PHASE.CANCELLED:
      return (
        <div className="space-y-3 p-3.5 text-foreground">
          <ConfirmHitlHeader
            tone={accent === "destructive" ? "destructive" : "neutral"}
            icon={<Icon className="size-4" aria-hidden />}
            title={cancelledTitle}
            description={cancelledDescription}
          />
          {summary}
        </div>
      );

    case HITL_CARD_PHASE.EXPIRED:
      return (
        <div className="space-y-3 p-3.5 text-foreground">
          <ConfirmHitlHeader
            tone={accent === "destructive" ? "destructive" : "neutral"}
            icon={<Icon className="size-4" aria-hidden />}
            title={expiredTitle}
            description={expiredDescription}
          />
          {summary}
        </div>
      );

    case HITL_CARD_PHASE.REVIEW:
    case HITL_CARD_PHASE.SUBMITTING:
    default: {
      const isSubmittingPhase = phase === HITL_CARD_PHASE.SUBMITTING;
      const isDestructiveConfirm = confirmVariant === "destructive";

      return (
        <div className="space-y-3 p-3.5 text-foreground">
          <ConfirmHitlHeader
            tone={reviewTone(accent)}
            icon={<Icon className="size-4" aria-hidden />}
            title={isSubmittingPhase ? submittingTitle : title}
            description={
              isSubmittingPhase
                ? submittingDescription
                : (description ?? null)
            }
            trailing={
              isSubmittingPhase ? (
                <Loader2
                  className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground"
                  aria-hidden
                />
              ) : null
            }
          />

          {summary}

          {errorMessage ? (
            <p className="text-xs text-destructive">{errorMessage}</p>
          ) : null}

          {isSubmittingPhase ? null : (
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={allActionsDisabled || actionsDisabled}
                onClick={onCancel}
              >
                {cancelLabel}
              </Button>
              {isDestructiveConfirm ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={
                    allActionsDisabled || actionsDisabled || confirmDisabled
                  }
                  onClick={onConfirm}
                  className="cursor-pointer"
                >
                  {confirmLabel}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 cursor-pointer"
                  disabled={
                    allActionsDisabled || actionsDisabled || confirmDisabled
                  }
                  onClick={onConfirm}
                >
                  {ConfirmIcon ? (
                    <ConfirmIcon className="size-3.5" aria-hidden />
                  ) : null}
                  {confirmLabel}
                </Button>
              )}
            </div>
          )}

          {isSubmittingPhase ? (
            <p className="sr-only" aria-live="polite">
              {submittingLabel}
            </p>
          ) : null}
        </div>
      );
    }
  }
};
