"use client";

import { ToolCallStatus, useAgent } from "@copilotkit/react-core/v2";

import { parseToolResult } from "@repo/utils";
import { AGENT_KEYS, TOOL_PURPOSE } from "@repo/constants";
import { RoomListSkeleton } from "@/components/common/RoomListSkeleton";
import { EmbeddedWidget } from "@/features/chatbot/components";
import { BookingList } from "@/features/booking/components/BookingList";
import type { MessageLike } from "@/features/chatbot/types";
import type {
  GetBookingsResult,
  GetBookingsToolProps,
} from "@/features/booking/types";
import { shouldSuppressForResolve } from "@/features/room/utils";

const MY_BOOKINGS_TITLE = "Your bookings";

/**
 * Renders get_bookings tool output in chat: skeleton while loading, booking
 * cards when done. Mirrors FindRoomNotice's chat-only room results pattern.
 */
export const MyBookingsNotice = ({
  status,
  result,
  parameters,
  toolCallId,
}: GetBookingsToolProps) => {
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });

  // purpose:"resolve" — cancel/modify/change-room resolution fetch, not a
  // guest-facing VIEW/LIST call. See shouldSuppressForResolve for the
  // later-tool-call fallback (mirrors FindRoomNotice's find_room rule).
  // Suppress skeleton and card alike; the HITL that follows is the response.
  const suppressForResolve = shouldSuppressForResolve(
    parameters?.purpose,
    TOOL_PURPOSE.GET_BOOKINGS.RESOLVE,
    agent.messages as MessageLike[] | undefined,
    toolCallId,
  );

  if (
    status === ToolCallStatus.Executing ||
    status === ToolCallStatus.InProgress
  ) {
    // Only a guest-facing LIST call renders the bookings card, so only it gets
    // a loading skeleton. A resolve lookup, or a `purpose` that has not
    // streamed far enough to confirm LIST, renders nothing — no skeleton flash
    // before the cancel / modify HITL. `purpose` is the first field in
    // getBookingsInputSchema, so an explicit LIST call still shows it at once.
    if (
      suppressForResolve ||
      parameters?.purpose !== TOOL_PURPOSE.GET_BOOKINGS.LIST
    ) {
      return null;
    }

    return (
      <EmbeddedWidget className="p-3.5">
        <RoomListSkeleton itemCount={2} className="max-w-full" />
      </EmbeddedWidget>
    );
  }

  if (status !== ToolCallStatus.Complete) {
    return null;
  }

  const parsed = parseToolResult<GetBookingsResult>(result);

  if (!parsed) {
    return (
      <EmbeddedWidget className="px-3.5 py-3 text-muted-foreground">
        Could not load your bookings.{" "}
        {typeof result === "string" ? result.trim() : ""}
      </EmbeddedWidget>
    );
  }

  if (
    suppressForResolve ||
    (parsed.purpose ?? parameters?.purpose) === TOOL_PURPOSE.GET_BOOKINGS.RESOLVE
  ) {
    return null;
  }

  const bookings = parsed.bookings ?? [];

  if (!bookings.length) {
    return (
      <EmbeddedWidget className="px-3.5 py-3 text-muted-foreground">
        No active bookings found.
      </EmbeddedWidget>
    );
  }

  return (
    <EmbeddedWidget unframed className="max-w-[min(100%,420px)]">
      <BookingList
        bookings={bookings}
        title={MY_BOOKINGS_TITLE}
        compact
        className="max-w-full rounded-xl border border-border bg-card p-3.5"
        toolCallId={toolCallId}
      />
    </EmbeddedWidget>
  );
};
