"use client";

import { ToolCallStatus } from "@copilotkit/react-core/v2";
import { MODEL_NAME } from "@repo/types";
import { HitlConfirmStayModal } from "./HitlConfirmStayModal";
import type {
  ConfirmModifyBookingArgs,
  ConfirmModifyBookingResult,
} from "@repo/schemas";
import type { HitlToolResult } from "@/features/booking/types";

type ConfirmModifyModalProps = {
  status: ToolCallStatus;
  args: Partial<ConfirmModifyBookingArgs>;
  respond?: (result: ConfirmModifyBookingResult) => Promise<void>;
  result?: HitlToolResult<ConfirmModifyBookingResult>;
  toolCallId?: string;
};

export const ConfirmModifyModal = ({
  status,
  args,
  respond,
  result,
  toolCallId,
}: ConfirmModifyModalProps) => (
  <HitlConfirmStayModal
    variant={MODEL_NAME.MODIFY}
    status={status}
    args={args}
    respond={respond}
    result={result}
    toolCallId={toolCallId}
  />
);
