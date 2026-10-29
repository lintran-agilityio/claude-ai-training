"use client";

import { ToolCallStatus } from "@copilotkit/react-core/v2";

import { buildAvailabilityCheckPrompt } from "@repo/constants";
import { parseToolResult } from "@repo/utils";
import type { RoomAvailabilityOverview } from "@repo/schemas";
import { RoomListSkeleton } from "@/components/common";
import { EmbeddedWidget } from "@/features/chatbot/components";
import {
  useGenericUiInteraction,
  useSendAgentMessage,
} from "@/features/chatbot/hooks";
import { RoomAvailabilityCard } from "@/features/room/components/RoomAvailabilityCard";
import type { RoomAvailabilityToolProps } from "@/features/room/types";

/**
 * Renders check_room_availability_overview output in chat. Picking another
 * date sends an `[availability-check]` message (same path as `[book-form]`),
 * which produces a fresh card; this one is disabled once superseded.
 *
 * @param props - CopilotKit tool render status, result, and tool call id
 */
export const RoomAvailabilityNotice = ({
  status,
  result,
  toolCallId,
}: RoomAvailabilityToolProps) => {
  const { isActionable } = useGenericUiInteraction(toolCallId);
  const { sendMessage } = useSendAgentMessage({
    onError: (error) => {
      console.error("Failed to request room availability", error);
    },
  });

  if (
    status === ToolCallStatus.Executing ||
    status === ToolCallStatus.InProgress
  ) {
    return (
      <EmbeddedWidget className="max-w-[min(100%,420px)] p-3.5">
        <RoomListSkeleton itemCount={3} className="max-w-full" />
      </EmbeddedWidget>
    );
  }

  if (status !== ToolCallStatus.Complete) {
    return null;
  }

  const overview = parseToolResult<RoomAvailabilityOverview>(result);

  if (!overview?.available || !overview.summary) {
    return (
      <EmbeddedWidget className="px-3.5 py-3 text-muted-foreground">
        Could not check room availability.
      </EmbeddedWidget>
    );
  }

  return (
    <EmbeddedWidget className="max-w-[min(100%,420px)]">
      <RoomAvailabilityCard
        overview={overview}
        disabled={!isActionable}
        onDateChange={(date) => sendMessage(buildAvailabilityCheckPrompt(date))}
      />
    </EmbeddedWidget>
  );
};
