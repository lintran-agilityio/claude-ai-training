"use client";

import { useEffect, useRef } from "react";
import { ToolCallStatus, useAgent } from "@copilotkit/react-core/v2";

import { parseToolResult, sortRooms } from "@repo/utils";
import { resolveBookingUnavailableReason } from "@repo/schemas";
import { AGENT_KEYS, TOOL_PURPOSE } from "@repo/constants";
import type { MessageLike } from "@/features/chatbot/types";
import { hasLaterToolCallInTurn } from "@/features/chatbot/utils";
import { RoomListSkeleton } from "@/components/common";
import { BookingUnavailable } from "@/components/confirm-modal";
import { EmbeddedWidget } from "@/features/chatbot/components";
import { ListRoomPreview } from "@/features/room/components";
import type {
  FindRoomResult,
  FindRoomToolProps,
} from "@/features/room/types";
import {
  buildFindRoomTitle,
  markAgentRoomSearch,
  resolveBookResolveUnavailable,
  shouldSuppressForResolve,
} from "@/features/room/utils";

type ToolErrorResult = {
  error: true;
  message?: string;
};

const getFindRoomToolError = (
  result: FindRoomToolProps["result"],
): string | null => {
  if (typeof result === "string" && result.trim()) {
    // Mastra may return a plain error string; avoid treating JSON payloads as errors.
    if (result.trimStart().startsWith("{")) {
      try {
        const parsed = JSON.parse(result) as ToolErrorResult | FindRoomResult;
        if (
          parsed &&
          typeof parsed === "object" &&
          "error" in parsed &&
          parsed.error === true
        ) {
          return parsed.message?.trim() || "Room search failed.";
        }
        return null;
      } catch {
        return result.trim();
      }
    }
    return result.trim();
  }

  if (
    result &&
    typeof result === "object" &&
    "error" in result &&
    (result as ToolErrorResult).error === true
  ) {
    return (
      (result as ToolErrorResult).message?.trim() || "Room search failed."
    );
  }

  return null;
};

/**
 * True when Room List should stay hidden for a BOOK name-resolve: skipped
 * only on exactly one match. FIND/RECOMMEND always show the list when
 * matches exist. purpose:"resolve" (internal cancel/modify room lookup) is
 * handled separately by suppressForResolve below.
 */
const shouldSuppressRoomList = (
  purpose: FindRoomResult["purpose"] | undefined,
  roomCount: number,
) => purpose === TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE && roomCount === 1;

/**
 * Renders find_room tool output in chat: skeleton while loading, room cards when done.
 * Results stay inside chat — the page room grid is never mutated from here.
 *
 * Book resolve + exactly one match → no Room List (text / availability / Confirm only).
 *
 * @param props - CopilotKit tool render status, result, and optional streaming args
 */
export const FindRoomNotice = ({
  status,
  result,
  parameters,
  toolCallId,
}: FindRoomToolProps) => {
  const lastMarkedKeyRef = useRef<string | null>(null);
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });

  const toolError =
    status === ToolCallStatus.Complete ? getFindRoomToolError(result) : null;
  const parsed =
    status === ToolCallStatus.Complete && !toolError
      ? parseToolResult<FindRoomResult>(result)
      : null;
  // Defensive re-sort: the API/agent already return `rooms` ranked by
  // `sortBy`, but the FE re-applies the same ordering here so a card never
  // renders out of order even if an intermediate layer regresses.
  const rooms = sortRooms(parsed?.rooms ?? [], parsed?.sortBy);
  const purpose = parsed?.purpose ?? parameters?.purpose;
  const title = parsed ? buildFindRoomTitle(parsed) : "Room results";
  const roomIdsKey = rooms.map((room) => room.id).join(",");

  // purpose:"resolve" — internal cancel/modify room-name lookup, not a
  // guest-facing FIND/RECOMMEND call. See shouldSuppressForResolve for the
  // later-tool-call fallback (mirrors MyBookingsNotice's get_bookings rule).
  const suppressForResolve = shouldSuppressForResolve(
    purpose,
    TOOL_PURPOSE.FIND_ROOM.RESOLVE,
    agent.messages as MessageLike[] | undefined,
    toolCallId,
  );

  const suppressList =
    suppressForResolve || shouldSuppressRoomList(purpose, rooms.length);
  const streamingPurpose = parameters?.purpose;

  useEffect(() => {
    if (status !== ToolCallStatus.Complete || !rooms.length || suppressList) {
      return;
    }

    const searchKey = `${title}:${roomIdsKey}`;
    if (lastMarkedKeyRef.current === searchKey) {
      return;
    }

    lastMarkedKeyRef.current = searchKey;
    markAgentRoomSearch();
  }, [status, rooms, title, roomIdsKey, suppressList]);

  if (
    status === ToolCallStatus.Executing ||
    status === ToolCallStatus.InProgress
  ) {
    // Only FIND / RECOMMEND ever render a Room List, so only they get a loading
    // skeleton. book_resolve / resolve are internal lookups that feed the next
    // booking or cancel/modify step — they, a still-streaming `purpose` prefix,
    // and a not-yet-streamed `purpose` all render nothing here: the skeleton
    // must never flash between an internal room lookup and the Booking Form /
    // Confirm card (see memory: find-room-book-resolve-headless). `purpose` is
    // the first field in findRoomInputSchema, so a genuine search that passes
    // it explicitly still shows the skeleton immediately.
    const showsRoomList =
      streamingPurpose === TOOL_PURPOSE.FIND_ROOM.SEARCH ||
      streamingPurpose === TOOL_PURPOSE.FIND_ROOM.RECOMMEND;

    if (!showsRoomList || suppressForResolve) {
      return null;
    }

    return (
      <EmbeddedWidget className="max-w-[min(100%,420px)] p-3.5">
        <RoomListSkeleton itemCount={3} className="max-w-full" />
      </EmbeddedWidget>
    );
  }

  if (status !== ToolCallStatus.Complete) {
    return null;
  }

  if (toolError) {
    return (
      <EmbeddedWidget className="px-3.5 py-3 text-muted-foreground">
        Could not search rooms. {toolError}
      </EmbeddedWidget>
    );
  }

  const bookResolveUnavailable = resolveBookResolveUnavailable(parsed);
  // Defensive: if the step machine still opened the Booking Form this turn (a
  // probe that ran on a model-attached date the corroboration check rejected),
  // let the form render alone rather than stacking an unavailable card on it.
  if (
    bookResolveUnavailable &&
    rooms[0] &&
    !hasLaterToolCallInTurn(agent.messages as MessageLike[] | undefined, toolCallId)
  ) {
    return (
      <EmbeddedWidget>
        <BookingUnavailable
          roomId={rooms[0].id}
          roomName={rooms[0].name}
          // Absent unless a real check-in date was resolved (stated, or an
          // earlier DATED search — never a browse default, never guessed) —
          // a guest-capacity-only verdict carries no dates at all.
          checkInDate={bookResolveUnavailable.checkInDate}
          checkOutDate={bookResolveUnavailable.checkOutDate}
          nights={parsed?.nights}
          guests={bookResolveUnavailable.guests}
          reason={
            // Unreachable in practice — resolveBookResolveUnavailable already
            // required capacity or dates to be false — the fallback is only
            // for the type checker.
            resolveBookingUnavailableReason(bookResolveUnavailable) ??
            "dates_unavailable"
          }
          capacity={rooms[0].capacity}
        />
      </EmbeddedWidget>
    );
  }

  if (suppressList) {
    return null;
  }

  if (!rooms.length) {
    return (
      <EmbeddedWidget className="px-3.5 py-3 text-muted-foreground">
        No rooms matched that search.
      </EmbeddedWidget>
    );
  }

  return (
    <EmbeddedWidget unframed className="max-w-[min(100%,420px)]">
      <ListRoomPreview rooms={rooms} title={title} toolCallId={toolCallId} />
    </EmbeddedWidget>
  );
};
