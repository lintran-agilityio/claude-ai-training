import { evalite } from "evalite";
import { BookingStatus } from "@repo/types";

import type { Booking } from "@agent/mastra/schemas/booking";
import { runAgentTurn } from "../../support/agent-harness";
import { scoreResult } from "../../support/checks";
import { installFakeApi } from "../../support/fake-api";
import { EVAL_USER_ID, FIXTURE_ROOMS } from "../../support/fixtures";
import { extractToolCalls } from "../../support/tool-calls";

/**
 * Regression — once a CANCEL confirmation is opened and left unconfirmed, a
 * later, differently-intended message in the SAME thread must not re-open or
 * continue it.
 *
 * Real repro (2026-09-11): a guest booked a room for NEXT weekend, then sent
 * "cancel my booking at weekend" — opening a pending
 * `show_cancel_dialog_confirm` card — followed by "find the room booked at
 * the weekend" (a View-bookings-shaped request, not a cancel continuation).
 * The agent kept re-showing the same stale cancel card for every follow-up
 * instead of listing bookings, because the literal word "find" also matches
 * SEARCH VERBS OVERRIDE and SHOW/LIST MY BOOKINGS OVERRIDE's own trigger
 * examples were anchored on "booking(s)/reservation(s)" wording, never "room(s)
 * booked at ___" (see intent-playbook.ts). This locks down the fix: LIST wins
 * over both SEARCH VERBS and a still-pending CANCEL card for that phrasing.
 *
 * Turn 2's "get_bookings" assertion doesn't need a date match to the seeded
 * booking — the point is routing (did it call the LIST tool at all, and did
 * it avoid re-touching the cancel flow), not the list's contents.
 */
const ONE_ACTIVE_BOOKING: Booking = {
  id: "booking-eval-cancel-list-switch",
  roomId: FIXTURE_ROOMS[0]!.id,
  userId: EVAL_USER_ID,
  checkInDate: "2026-12-05",
  checkOutDate: "2026-12-06",
  guests: 2,
  totalPrice: FIXTURE_ROOMS[0]!.pricePerNight,
  status: BookingStatus.CONFIRMED,
  room: { ...FIXTURE_ROOMS[0]! },
};

evalite<undefined, { turn2ToolNames: string[]; error: string | null }, true>(
  "Regression — a View-bookings message must not continue a pending CANCEL confirmation",
  {
    data: () => [{ input: undefined, expected: true }],
    task: async () => {
      const fakeApi = installFakeApi();
      fakeApi.state.bookings = [ONE_ACTIVE_BOOKING];
      const threadId = `eval-cancel-list-switch-${Date.now()}`;
      let turn2ToolNames: string[] = [];
      let error: string | null = null;

      try {
        // Turn 1: opens a pending cancel confirmation, left unconfirmed —
        // the default HITL behavior (see agent-harness.ts), the turn stops
        // at the card just like the real repro (guest never clicked Confirm).
        await runAgentTurn("I want to cancel my booking at weekend", {
          threadId,
        });

        // Turn 2: a View-bookings-shaped message, not a cancel continuation.
        const { result } = await runAgentTurn(
          "find the room booked at the weekend",
          { threadId },
        );
        turn2ToolNames = extractToolCalls(result).map((call) => call.toolName);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      } finally {
        fakeApi.restore();
      }

      return { turn2ToolNames, error };
    },
    scorers: [
      {
        name: "Turn 2 calls get_bookings",
        scorer: ({ output }) =>
          scoreResult(
            output.turn2ToolNames.includes("get_bookings"),
            `turn 2 tool calls: [${output.turn2ToolNames.join(", ") || "none"}]`,
          ),
      },
      {
        name: "Turn 2 never re-opens or continues the cancel confirmation",
        scorer: ({ output }) =>
          scoreResult(
            !output.turn2ToolNames.includes("show_cancel_dialog_confirm") &&
              !output.turn2ToolNames.includes("cancel_booking"),
            `turn 2 tool calls: [${output.turn2ToolNames.join(", ") || "none"}]`,
          ),
      },
    ],
    columns: ({ output }) => [
      {
        label: "Turn 2 tool calls",
        value: output.turn2ToolNames.join(" → ") || "(none)",
      },
      { label: "Error", value: output.error ?? "(none)" },
    ],
  },
);
