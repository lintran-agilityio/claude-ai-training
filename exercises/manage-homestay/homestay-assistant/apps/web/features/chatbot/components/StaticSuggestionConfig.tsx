"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import {
  useAgent,
  useConfigureSuggestions,
} from "@copilotkit/react-core/v2";

import { AGENT_KEYS } from "@repo/constants";
import { PREFIX_URL } from "@repo/types";
import { getMyBookings } from "@/features/booking/services";
import { isBookingCancellable } from "@/features/booking/utils";
import { CHAT_SUGGESTIONS_AGENT_UPDATES } from "@/features/chatbot/constants";
import { useHomestayAgentContext } from "@/features/chatbot/hooks/use-homestay-agent-context";
import { useHomestayAgentUiStore } from "@/features/chatbot/stores/homestay-agent-ui-store";
import { getPriorityStaticSuggestions } from "@/features/chatbot/utils";
import { useRoomStore } from "@/features/room/stores/room-store";

type StaticSuggestionConfigProps = {
  agentId?: string;
};

export const StaticSuggestionConfig = ({
  agentId = AGENT_KEYS.HOMESTAY_ASSISTANT,
}: StaticSuggestionConfigProps) => {
  const context = useHomestayAgentContext();
  const { agent } = useAgent({
    agentId,
    updates: [...CHAT_SUGGESTIONS_AGENT_UPDATES],
  });
  // isSignedIn flips false on sign-out before userId is cleared; gating on both
  // stops /api/bookings from firing against a dead Clerk session (browser 401).
  const { userId, isLoaded, isSignedIn } = useAuth();
  const wasRunningRef = useRef(agent.isRunning);

  const focusRoomId = context.focus?.type === "room" ? context.focus.id : null;
  const roomName = useRoomStore((s) =>
    focusRoomId
      ? s.rooms.find((room) => room.id === focusRoomId)?.name
      : undefined,
  );
  const hasSearchedRooms = useRoomStore((s) => s.hasAgentRoomSearch);
  const bookingJustCompleted = useHomestayAgentUiStore(
    (s) => s.bookingJustCompleted,
  );
  const setBookingJustCompleted = useHomestayAgentUiStore(
    (s) => s.setBookingJustCompleted,
  );

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings", userId],
    queryFn: ({ signal }) =>
      getMyBookings({ via: PREFIX_URL.WEB, signal }),
    enabled: Boolean(isLoaded && isSignedIn && userId),
    // Auth loss is not transient — retries only spam more 401s during sign-out.
    retry: false,
  });

  const hasActiveBookings = useMemo(
    () =>
      bookings.some((booking) =>
        isBookingCancellable(booking.status, booking.checkOutDate),
      ),
    [bookings],
  );

  // Post-booking pills stay until the *next* turn starts (not the create_booking run).
  useEffect(() => {
    const startedNewRun = agent.isRunning && !wasRunningRef.current;
    wasRunningRef.current = agent.isRunning;

    if (startedNewRun && bookingJustCompleted) {
      setBookingJustCompleted(false);
    }
  }, [agent.isRunning, bookingJustCompleted, setBookingJustCompleted]);
  const guestState = useMemo(
    () => ({
      hasActiveBookings,
      hasSearchedRooms,
      bookingJustCompleted,
    }),
    [bookingJustCompleted, hasActiveBookings, hasSearchedRooms],
  );

  const contextKey = useMemo(() => JSON.stringify(context), [context]);
  const guestStateKey = useMemo(() => JSON.stringify(guestState), [guestState]);

  const staticSuggestions = useMemo(
    () => getPriorityStaticSuggestions(context, roomName, guestState),
    // contextKey / guestStateKey are stable fingerprints of object inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional fingerprint deps
    [contextKey, guestStateKey, roomName],
  );

  const config = useMemo(
    () =>
      agent.isRunning
        ? null
        : {
            suggestions: staticSuggestions,
            available: "always" as const,
            consumerAgentId: agentId,
          },
    [agent.isRunning, agentId, staticSuggestions],
  );

  useConfigureSuggestions(config, [
    contextKey,
    guestStateKey,
    roomName,
    agentId,
    agent.isRunning,
  ]);

  return null;
};
