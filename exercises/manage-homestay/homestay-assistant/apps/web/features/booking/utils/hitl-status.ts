import { ToolCallStatus } from "@copilotkit/react-core/v2";
import { useCallback, useRef, useState } from "react";

import { parseToolResult } from "@repo/utils";
import {
  type ConfirmBookingArgs,
  type ConfirmModifyBookingArgs,
} from "@repo/schemas";
import { HITL_DECISION_STATUS } from "@/constants";
import { HitlToolResult } from "../types";
import {
  BOOKING_MUTATION_PHASE,
  HITL_CARD_PHASE,
  HitlCardPhase,
  type BookingMutationPhase,
} from "../constants";

export type HitlDecisionStatus =
  (typeof HITL_DECISION_STATUS)[keyof typeof HITL_DECISION_STATUS];

type HitlConfirmPayload = {
  confirmed?: boolean;
};

type MutationOutcome = {
  phase: BookingMutationPhase;
} | null;

type ResolveHitlCardPhaseInput = {
  status: HitlDecisionStatus;
  isHitlSubmitting: boolean;
  outcome: MutationOutcome;
};

type StayFields = {
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
};

type RoomStayFields = StayFields & {
  room?: {
    id?: string;
    name?: string;
    pricePerNight?: number;
  };
};

/**
 * CopilotKit v2 tool lifecycle (`@copilotkit/core` ToolCallStatus):
 * `inProgress` → `executing` → `complete` — no separate "awaiting respond" status.
 *
 * `useHumanInTheLoop` passes `respond` only while status is `executing`
 * (`InProgress` and `Complete` get `respond: undefined`). HITL cards must
 * gate interactive actions on `Executing`, not `InProgress` (backend
 * `useRenderTool` UIs often treat both as in-flight — that pattern must not
 * be copied here). Completed HITL cards stay mounted; create/cancel/modify
 * confirm UI owns the lifecycle via same-card phases (review → submitting →
 * success | failed | cancelled | expired) derived from respond payload +
 * mutation outcome — not a separate success card.
 */
export const isHitlToolInProgress = (status: ToolCallStatus) =>
  status === ToolCallStatus.InProgress;

/** User can submit `respond()` — the only HITL phase where CK wires `respond`. */
export const isHitlToolAwaitingUser = (status: ToolCallStatus) =>
  status === ToolCallStatus.Executing;

export const isHitlToolFinished = (status: ToolCallStatus) =>
  status === ToolCallStatus.Complete;

export const isHitlToolRespondable = <T>(
  status: ToolCallStatus,
  respond: ((result: T) => Promise<void>) | undefined,
): respond is (result: T) => Promise<void> =>
  isHitlToolAwaitingUser(status) && respond != null;

/**
 * Ensures HITL `respond` runs at most once.
 * Dialog unmount / onOpenChange(false) can otherwise fire a second
 * respond (e.g. confirmed:false after a successful confirm), which
 * races the agent and can skip follow-up tools like update_booking.
 */
export const useHitlRespondOnce = <T>(
  respond?: (result: T) => Promise<void>,
) => {
  const hasRespondedRef = useRef(false);
  const [hasResponded, setHasResponded] = useState(false);

  const respondOnce = useCallback(
    async (result: T) => {
      if (!respond || hasRespondedRef.current) {
        return;
      }

      hasRespondedRef.current = true;
      setHasResponded(true);

      try {
        await respond(result);
      } catch (error) {
        hasRespondedRef.current = false;
        setHasResponded(false);
        throw error;
      }
    },
    [respond],
  );

  return {
    respondOnce,
    canRespond: respond != null && !hasResponded,
  };
};

/**
 * Maps CopilotKit HITL lifecycle + respond() payload to a durable UI status.
 * - pending: still awaiting user action (executing)
 * - approved / rejected: from respond({ confirmed })
 * - expired: completed without a usable confirmed flag (abort / missing result)
 */
export const resolveHitlDecisionStatus = (
  status: ToolCallStatus,
  result?: HitlToolResult<HitlConfirmPayload>,
): HitlDecisionStatus => {
  if (!isHitlToolFinished(status)) {
    return HITL_DECISION_STATUS.PENDING;
  }

  const parsed = parseToolResult<HitlConfirmPayload>(result);
  if (typeof parsed?.confirmed !== "boolean") {
    return HITL_DECISION_STATUS.EXPIRED;
  }

  return parsed.confirmed
    ? HITL_DECISION_STATUS.APPROVED
    : HITL_DECISION_STATUS.REJECTED;
};

export const isHitlDecisionTerminal = (decision: HitlDecisionStatus) =>
  decision !== HITL_DECISION_STATUS.PENDING;

/** Render HITL while awaiting user action, or after completion (keep history). */
export const shouldRenderHitlCard = (
  status: ToolCallStatus,
  hasRequiredArgs: boolean,
) =>
  hasRequiredArgs &&
  (isHitlToolAwaitingUser(status) || isHitlToolFinished(status));

const resolveApprovedCardPhase = (outcome: MutationOutcome): HitlCardPhase => {
  const { phase } = outcome ?? {};

  switch (phase) {
    case BOOKING_MUTATION_PHASE.SUCCESS:
      return HITL_CARD_PHASE.SUCCESS;
    case BOOKING_MUTATION_PHASE.FAILED:
      return HITL_CARD_PHASE.FAILED;
    default:
      return HITL_CARD_PHASE.SUBMITTING;
  }
};

/**
 * Maps HITL decision + mutation outcome into the shared HITL card phase model.
 * Approved without an outcome yet → submitting (do not show settled copy early).
 *
 * A settled mutation outcome (success / failed) is checked BEFORE `status`:
 * create_booking / update_booking / cancel_booking only ever runs after the
 * guest approved *this* card (correlation-key matched), so a settled outcome
 * means "approved + mutation done" even when the HITL tool's own decision
 * status has since decayed. `respond()` appends no `role:"tool"` message, so
 * once the turn reconciles from `agent.messages` the confirm tool's `result`
 * is gone and `resolveHitlDecisionStatus` reads EXPIRED — without this
 * ordering the success card would flip to "confirmation expired" the instant
 * the run finished.
 */
export const resolveHitlCardPhase = ({
  status,
  isHitlSubmitting,
  outcome,
}: ResolveHitlCardPhaseInput): HitlCardPhase => {
  if (outcome?.phase === BOOKING_MUTATION_PHASE.SUCCESS) {
    return HITL_CARD_PHASE.SUCCESS;
  }
  if (outcome?.phase === BOOKING_MUTATION_PHASE.FAILED) {
    return HITL_CARD_PHASE.FAILED;
  }

  switch (status) {
    case HITL_DECISION_STATUS.REJECTED:
      return HITL_CARD_PHASE.CANCELLED;
    case HITL_DECISION_STATUS.EXPIRED:
      return HITL_CARD_PHASE.EXPIRED;
    case HITL_DECISION_STATUS.PENDING:
      // The store's `submitting` outcome (written by markSubmitting on confirm
      // click / the mutation bridge) must hold the spinner through the gap
      // where respond() has resolved but CK has not yet marked the HITL
      // Complete — otherwise the card briefly drops back to REVIEW.
      return isHitlSubmitting ||
        outcome?.phase === BOOKING_MUTATION_PHASE.SUBMITTING
        ? HITL_CARD_PHASE.SUBMITTING
        : HITL_CARD_PHASE.REVIEW;
    case HITL_DECISION_STATUS.APPROVED:
      return resolveApprovedCardPhase(outcome);
  }
};

/** True when stay dates/guests are present and valid. */
export const hasStayFields = (args: Partial<StayFields>) =>
  Boolean(
    args.checkInDate?.trim() &&
    args.checkOutDate?.trim() &&
    typeof args.guests === "number" &&
    args.guests > 0,
  );

/** True when room id/name/price and stay dates/guests are present and valid. */
export const hasRoomStayFields = (args: Partial<RoomStayFields>) =>
  Boolean(
    args.room?.id?.trim() &&
    args.room?.name?.trim() &&
    typeof args.room?.pricePerNight === "number" &&
    hasStayFields(args),
  );

/**
 * confirm_booking args carry only `roomId` — the room object is hydrated on the
 * frontend (see useConfirmBookingRoom), so the confirm card additionally gates
 * its render on that hydrated room, not here.
 */
export const hasRequiredCreateArgs = (
  args: Partial<ConfirmBookingArgs>,
): args is ConfirmBookingArgs =>
  Boolean(args.roomId?.trim()) && hasStayFields(args);

export const hasRequiredModifyArgs = (
  args: Partial<ConfirmModifyBookingArgs>,
): args is ConfirmModifyBookingArgs =>
  Boolean(args.bookingId?.trim()) && hasRoomStayFields(args);
