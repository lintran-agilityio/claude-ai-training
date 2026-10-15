import { ToolCallStatus } from "@copilotkit/react-core/v2";
import { parseToolResult } from "@repo/utils";

import type { HitlToolResult } from "@/features/booking/types";
import {
  isHitlDecisionTerminal,
  isHitlToolAwaitingUser,
  resolveHitlDecisionStatus,
} from "@/features/booking/utils";
import { useHitlPickerDismiss } from "./use-hitl-confirm-dialog";

type PickerDeclineResult = { confirmed: false; reason?: "declined" | "not_found" };
type PickerConfirmResult = { confirmed: true; bookingId: string; roomName: string };
type PickerResult = PickerDeclineResult | PickerConfirmResult;

/**
 * Shared derived state behind the cancel/modify disambiguation pickers
 * (CancelBookingByRoomModal, ModifyBookingByRoomModal): both dismiss via
 * `useHitlPickerDismiss` with the same `{ confirmed: false, reason:
 * "declined" }` decline shape, then read the same decision/completion/parsed
 * fields off it.
 */
export const useBookingPickerHitl = <T extends PickerResult>(
  status: ToolCallStatus,
  respond: ((result: T) => Promise<void>) | undefined,
  toolCallId: string | undefined,
  result: HitlToolResult<T> | undefined,
) => {
  const declineResult = { confirmed: false, reason: "declined" } as T;

  const { respondOnce, canRespond, isActionable, expiredBySupersede } =
    useHitlPickerDismiss<T>(respond, toolCallId, declineResult);

  const decisionStatus = resolveHitlDecisionStatus(status, result);
  const isComplete = isHitlDecisionTerminal(decisionStatus) || expiredBySupersede;
  const isAwaiting =
    isHitlToolAwaitingUser(status) && !isComplete && isActionable;
  const parsedResult = parseToolResult<T>(
    result as T | string | null | undefined,
  );

  const handleKeepBookings = () => {
    if (!canRespond) {
      return;
    }

    void respondOnce(declineResult);
  };

  return {
    respondOnce,
    canRespond,
    isActionable,
    expiredBySupersede,
    decisionStatus,
    isComplete,
    isAwaiting,
    parsedResult,
    handleKeepBookings,
  };
};
