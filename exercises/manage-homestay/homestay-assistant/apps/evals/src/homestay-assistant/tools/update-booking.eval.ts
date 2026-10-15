import { evalite } from "evalite";

import { scoreResult } from "../../support/checks";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * `update_booking` — real LLM agent turns, structured scoring.
 *
 * `update_booking` is the MODIFY terminal mutation. Two properties:
 *   1. It never fires without `find_bookings` → `find_booking_by_id` →
 *      `confirm_modify_booking` in front of it (there is no
 *      `check_room_availability` tool — `find_booking_by_id` probes availability
 *      itself on the stated-change path); the turn ends at the HITL confirm
 *      awaiting a real click.
 *   2. A MODIFY whose stated change is a no-op (matches the booking's current
 *      stay exactly) must never reach `confirm_modify_booking` OR
 *      `update_booking` — see `WORKFLOW_MODIFY`'s own worked example ("Change
 *      guests to 1 (booking already has 1 guest)"). The no-LLM guard is in
 *      `deterministic/find-booking-by-id.eval.ts` (`stayUnchanged` → stop);
 *      this proves the prompt also honors it when a real model drives the turn.
 *      The fixture booking already has guests: 2 — see `support/fixtures.ts`.
 *
 * The no-LLM HITL gates in front of `update_booking` are in
 * `deterministic/update-booking.eval.ts`.
 */
type ModifyCase = {
  name: string;
  message: string;
  mustAppearInOrder: string[];
  mustNotCall: string[];
};

const cases: ModifyCase[] = [
  {
    name: "stated date change, available → reaches confirm_modify_booking in order, never update_booking",
    message:
      "Change my Riverside Twin Room booking to check in November 1 and check out November 3",
    mustAppearInOrder: [
      "find_bookings",
      "find_booking_by_id",
      "confirm_modify_booking",
    ],
    mustNotCall: ["check_room_availability", "update_booking"],
  },
  {
    // Regression: a loosely-phrased RELATIVE extend ("count one more date")
    // must resolve to requestedCheckOutDeltaDays and flow to the confirm gate —
    // it must NOT be swallowed as a "no changes needed" no-op (the original
    // bug), so confirm_modify_booking has to appear.
    name: "relative checkout extend ('count one more date') → reaches confirm_modify_booking, never no-op",
    message:
      "I want to change the checkout date for my Riverside Twin Room booking, count one more date",
    mustAppearInOrder: [
      "find_bookings",
      "find_booking_by_id",
      "confirm_modify_booking",
    ],
    mustNotCall: ["check_room_availability", "update_booking"],
  },
];

evalite<ModifyCase, CaseResult, ModifyCase>(
  "update_booking — never mutates before the confirm gate",
  {
    data: () => cases.map((c) => ({ input: c, expected: c })),
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "Reached the confirm gate in order",
        scorer: ({ output, expected }) => {
          const names = output.toolNames;
          let cursor = -1;
          for (const tool of expected!.mustAppearInOrder) {
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
        name: "Terminal update_booking never fired this turn",
        scorer: ({ output, expected }) => {
          const hit = expected!.mustNotCall.filter((t) =>
            output.toolNames.includes(t),
          );
          return scoreResult(
            hit.length === 0,
            hit.length === 0
              ? "update_booking correctly withheld"
              : `unexpectedly called [${hit.join(", ")}] — got [${output.toolNames.join(", ")}]`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.message },
      { label: "Tool calls", value: output.toolNames.join(" → ") || "(none)" },
    ],
  },
);

evalite<{ message: string }, CaseResult, string[]>(
  "update_booking — no-op modify never opens the confirm dialog",
  {
    data: () => [
      {
        input: {
          message:
            "Change the guest count on my Riverside Twin Room booking to 2",
        },
        expected: ["confirm_modify_booking", "update_booking"],
      },
    ],
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "Resolved the booking before judging no-op",
        description:
          "Must still call find_bookings/find_booking_by_id — never judge a no-op from chat history alone.",
        scorer: ({ output }) =>
          scoreResult(
            output.toolNames.includes("find_bookings") &&
              output.toolNames.includes("find_booking_by_id"),
            `tool calls: [${output.toolNames.join(", ") || "none"}]`,
          ),
      },
      {
        name: "Never opened confirm_modify_booking or update_booking",
        scorer: ({ output, expected }) => {
          const hit = expected!.filter((t) => output.toolNames.includes(t));
          return scoreResult(
            hit.length === 0,
            hit.length === 0
              ? "correctly stopped without a confirm dialog"
              : `unexpectedly called [${hit.join(", ")}]`,
          );
        },
      },
    ],
    columns: ({ output }) => [
      { label: "Reply", value: output.text.slice(0, 200) },
      { label: "Tool calls", value: output.toolNames.join(" → ") || "(none)" },
    ],
  },
);
