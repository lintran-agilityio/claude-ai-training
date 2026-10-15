"use client";

import { useMemo } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { AGENT_KEYS } from "@repo/constants";
import { selectModifyEpisode, type ModifyEpisode } from "@repo/utils";

import type { MessageLike } from "@/features/chatbot/types";
import type { Room } from "@/features/room/types/room";

/**
 * The transcript slice one `confirm_modify_booking` card owns: the booking its
 * own `find_booking_by_id` resolved (room, current stay, stated-change stay),
 * its edit form, and the `update_booking` attempt that settles it.
 *
 * `confirm_modify_booking` args are model-authored — a weak model copies the
 * original check-out, drops `room`, or re-sends the previous modify's booking.
 * Reading from the card's own episode keeps it deterministic without letting a
 * later (or earlier) modify's lookup leak into this card.
 */
export const useModifyBookingEpisode = ({
  toolCallId,
  bookingId,
}: {
  toolCallId?: string;
  bookingId?: string;
}): ModifyEpisode<Room> | null => {
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });
  const messages = agent.messages as MessageLike[] | undefined;

  return useMemo(
    () => selectModifyEpisode<Room>(messages, { toolCallId, bookingId }),
    [messages, toolCallId, bookingId],
  );
};
