import { evalite } from "evalite";
import { formatTodayYmd, getWeekendStay } from "@repo/utils/date";
import { BookingStatus } from "@repo/types";

import type { Booking } from "@agent/mastra/schemas/booking";
import { runAgentTurn } from "../../support/agent-harness";
import { scoreResult } from "../../support/checks";
import { installFakeApi } from "../../support/fake-api";
import { EVAL_USER_ID, FIXTURE_ROOMS } from "../../support/fixtures";
import { extractToolCalls } from "../../support/tool-calls";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * `find_bookings` — real LLM agent turns, structured scoring.
 *
 * `find_bookings` is the INTERNAL cancel/modify/change-room target resolver
 * (never the guest-facing list — that's `get_bookings`). For a modify/cancel
 * request with no `bookingId:` and a room named, it must be the FIRST tool,
 * with the room name passed as-is — `find_room` is never used to look up a
 * roomId first (CORE_PRINCIPLES: "Modify/Cancel intent ≠ FIND workflow").
 *
 * `status: "not_found"` is a hard stop: the agent says there are no active
 * bookings and calls no HITL/mutation tool — it must not invent a booking.
 * (`resolved`/`ambiguous` continuations are proven in
 * `behavioral/find-booking-by-id.eval.ts` and `behavioral/cancel-booking.eval.ts`.)
 */
type FindBookingsCase = {
  name: string;
  message: string;
  mustCallInOrder: string[];
  mustNotCall: string[];
};

// Kept the not_found hard-stop case: it exercises find_bookings-first
// routing (never find_room) AND that a no-match resolver result invents
// nothing. The modify→find_booking_by_id continuation is covered in
// tools/find-booking-by-id.eval.ts and conversation/booking-hitl-flow.eval.ts.
const cases: FindBookingsCase[] = [
  {
    name: "cancel a room with no booking → find_bookings runs, no dialog, no mutation",
    message: "Cancel my Lotus Single Room booking",
    mustCallInOrder: ["find_bookings"],
    mustNotCall: [
      "find_room",
      "find_booking_by_id",
      "show_cancel_dialog_confirm",
      "cancel_booking",
    ],
  },
];

evalite<FindBookingsCase, CaseResult, FindBookingsCase>(
  "find_bookings — internal resolver, never find_room; not_found is a hard stop",
  {
    data: () => cases.map((c) => ({ input: c, expected: c })),
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "Called required tools in order",
        scorer: ({ output, expected }) => {
          const names = output.toolNames;
          let cursor = -1;
          for (const tool of expected!.mustCallInOrder) {
            const index = names.indexOf(tool, cursor + 1);
            if (index === -1) {
              return scoreResult(
                false,
                `missing or out-of-order "${tool}" — got [${names.join(", ") || "none"}]`,
              );
            }
            cursor = index;
          }
          return scoreResult(true, `saw expected order in [${names.join(", ")}]`);
        },
      },
      {
        name: "Never called a forbidden tool",
        scorer: ({ output, expected }) => {
          const hit = expected!.mustNotCall.filter((t) =>
            output.toolNames.includes(t),
          );
          return scoreResult(
            hit.length === 0,
            hit.length === 0
              ? "no forbidden tool calls"
              : `unexpectedly called [${hit.join(", ")}] — got [${output.toolNames.join(", ")}]`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.message },
      { label: "Reply", value: output.text.slice(0, 160) },
      { label: "Tool calls", value: output.toolNames.join(" → ") || "(none)" },
    ],
  },
);

/**
 * Regression — a stated weekend/date cue on a cancel request must narrow
 * `find_bookings` by date, not just by room name (see `dateFrom`/`dateTo` on
 * `find_bookings`, wired 2026-09-11 after a real repro: a guest booked a room
 * for NEXT weekend, then "cancel my booking at this weekend" — a different
 * weekend — still resolved and showed that same booking).
 *
 * Fixture has exactly one active booking, dated for NEXT weekend only. The
 * guest asks to cancel "this weekend" (computed relative to whenever the
 * suite actually runs, via the same `@repo/utils/date` helpers the agent's
 * own DATE CONTEXT uses — never hardcoded, so this stays correct as real
 * time passes). A date-aware `find_bookings` must resolve `not_found` for
 * that mismatched weekend and the turn must never fall back to the existing
 * (differently-dated) booking.
 */
const nextWeekendStay = getWeekendStay(formatTodayYmd(), 1);

const MISMATCHED_WEEKEND_BOOKING: Booking = {
  id: "booking-eval-next-weekend-only",
  roomId: FIXTURE_ROOMS[0]!.id,
  userId: EVAL_USER_ID,
  checkInDate: nextWeekendStay.checkIn,
  checkOutDate: nextWeekendStay.checkOut,
  guests: 2,
  totalPrice: FIXTURE_ROOMS[0]!.pricePerNight,
  status: BookingStatus.CONFIRMED,
  room: { ...FIXTURE_ROOMS[0]! },
};

evalite<undefined, { toolNames: string[]; error: string | null }, true>(
  "find_bookings — a stated weekend cue must not resolve a booking on a different weekend",
  {
    data: () => [{ input: undefined, expected: true }],
    task: async () => {
      const fakeApi = installFakeApi();
      fakeApi.state.bookings = [MISMATCHED_WEEKEND_BOOKING];
      let toolNames: string[] = [];
      let error: string | null = null;

      try {
        const { result } = await runAgentTurn(
          "I want to cancel my booking at this weekend",
        );
        toolNames = extractToolCalls(result).map((call) => call.toolName);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      } finally {
        fakeApi.restore();
      }

      return { toolNames, error };
    },
    scorers: [
      {
        name: "Calls find_bookings",
        scorer: ({ output }) =>
          scoreResult(
            output.toolNames.includes("find_bookings"),
            `tool calls: [${output.toolNames.join(", ") || "none"}]`,
          ),
      },
      {
        name: "Never opens the cancel dialog for the mismatched-weekend booking",
        description:
          "The only active booking is for NEXT weekend; the guest asked about THIS weekend — a date-aware find_bookings must resolve not_found, never show_cancel_dialog_confirm for the unrelated booking.",
        scorer: ({ output }) =>
          scoreResult(
            !output.toolNames.includes("show_cancel_dialog_confirm"),
            `tool calls: [${output.toolNames.join(", ") || "none"}]`,
          ),
      },
    ],
    columns: ({ output }) => [
      { label: "Message", value: "I want to cancel my booking at this weekend" },
      { label: "Reply", value: output.error ?? "(none)" },
      { label: "Tool calls", value: output.toolNames.join(" → ") || "(none)" },
    ],
  },
);
