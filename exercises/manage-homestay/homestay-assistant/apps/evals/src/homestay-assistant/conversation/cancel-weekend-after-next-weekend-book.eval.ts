import { evalite } from "evalite";
import { getBusinessDates } from "@repo/utils/date";

import { runAgentTurn } from "../../support/agent-harness";
import { scoreResult } from "../../support/checks";
import { installFakeApi } from "../../support/fake-api";
import { extractToolCalls, findToolCall } from "../../support/tool-calls";

/**
 * Regression (real repro, 2026-09-11): "cancel room at weekend" → resolves
 * THIS weekend, correctly. Guest then books "Bamboo Family Suite room at
 * next weekend for 3 guests" → resolves NEXT weekend, correctly. Guest then
 * says "cancel room at the weekend" again — same bare wording as the first
 * message, no "next" qualifier — but the agent computed `find_bookings`'
 * `dateFrom`/`dateTo` from NEXT weekend (biased by the booking it had just
 * made), resolving the Bamboo Family Suite booking instead of correctly
 * reporting no booking exists for THIS weekend.
 *
 * `dateFrom`/`dateTo` narrowing itself already works (see
 * tools/find-bookings.eval.ts) — the bug is upstream: the LLM computing the
 * wrong pair for an unqualified "weekend" right after a "next weekend"
 * mention. Fixed in intent-playbook.ts (Weekend dates / WORKFLOW — CANCEL)
 * with an explicit instruction that a bare "weekend" never inherits a
 * qualifier from an earlier turn.
 */
evalite<
  undefined,
  { turn2ToolNames: string[]; dateFrom: unknown; dateTo: unknown; error: string | null },
  true
>(
  "Regression — a bare 'weekend' cue must not inherit 'next weekend' from an earlier turn",
  {
    data: () => [{ input: undefined, expected: true }],
    task: async () => {
      const fakeApi = installFakeApi();
      const threadId = `eval-cancel-weekend-recency-${Date.now()}`;
      let turn2ToolNames: string[] = [];
      let dateFrom: unknown;
      let dateTo: unknown;
      let error: string | null = null;

      try {
        // Turn 1: books a room for NEXT weekend — establishes "next weekend"
        // as the most recently discussed weekend in conversation history.
        await runAgentTurn(
          "I want to book Bamboo Family Suite room at next weekend for 3 guests",
          { threadId, hitlResolution: "confirm" },
        );

        // Turn 2: bare "the weekend" (no "next") — must resolve to THIS
        // weekend again, independent of turn 1's next-weekend booking.
        const { result } = await runAgentTurn(
          "I want to cancel room at the weekend",
          { threadId },
        );
        const calls = extractToolCalls(result);
        turn2ToolNames = calls.map((call) => call.toolName);
        const findBookingsCall = findToolCall(calls, "find_bookings");
        const args = findBookingsCall?.args as
          | { dateFrom?: unknown; dateTo?: unknown }
          | undefined;
        dateFrom = args?.dateFrom;
        dateTo = args?.dateTo;
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      } finally {
        fakeApi.restore();
      }

      return { turn2ToolNames, dateFrom, dateTo, error };
    },
    scorers: [
      {
        name: "Turn 2 calls find_bookings",
        scorer: ({ output }) =>
          scoreResult(
            output.turn2ToolNames.includes("find_bookings"),
            `turn 2 tool calls: [${output.turn2ToolNames.join(", ") || "none"}]`,
          ),
      },
      {
        name: "dateFrom resolves to THIS weekend, not next weekend",
        description:
          "A bare 'weekend' cue must copy weekendCheckIn, never nextWeekendCheckIn carried over from the earlier booking turn.",
        scorer: ({ output }) => {
          const dates = getBusinessDates();
          return scoreResult(
            output.dateFrom === dates.weekendCheckIn,
            `dateFrom=${JSON.stringify(output.dateFrom)}, expected weekendCheckIn=${dates.weekendCheckIn} (NOT nextWeekendCheckIn=${dates.nextWeekendCheckIn})`,
          );
        },
      },
      {
        name: "Never opens the cancel dialog for the next-weekend booking",
        description:
          "The only active booking is for NEXT weekend; the guest asked about THIS weekend (no 'next') — must not resolve/confirm the mismatched booking.",
        scorer: ({ output }) =>
          scoreResult(
            !output.turn2ToolNames.includes("show_cancel_dialog_confirm"),
            `turn 2 tool calls: [${output.turn2ToolNames.join(", ") || "none"}]`,
          ),
      },
    ],
    columns: ({ output }) => [
      { label: "Turn 2 tool calls", value: output.turn2ToolNames.join(" → ") || "(none)" },
      { label: "dateFrom", value: String(output.dateFrom ?? "(none)") },
      { label: "dateTo", value: String(output.dateTo ?? "(none)") },
      { label: "Error", value: output.error ?? "(none)" },
    ],
  },
);
