import { evalite } from "evalite";

import { scoreResult } from "../../support/checks";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * `cancel_booking` — real LLM agent turns, structured scoring.
 *
 * `cancel_booking` is the CANCEL terminal mutation. For a cancel request with
 * no `bookingId:`, the chain is `find_bookings` (resolve the target by room
 * name) → `show_cancel_dialog_confirm` (HITL) → and the turn ends there. It
 * must NOT call `find_room` (a room name in a cancel request is not a search —
 * see CORE_PRINCIPLES "Modify/Cancel intent ≠ FIND workflow"), must NOT call
 * `find_booking_by_id` when `find_bookings` already resolved, and must NOT
 * reach `cancel_booking` this turn.
 *
 * The no-LLM `show_cancel_dialog_confirm` confirmed/dismissed → `cancel_booking`/stop
 * gate is in `deterministic/cancel-booking.eval.ts`.
 */
type CancelCase = {
  name: string;
  message: string;
  mustAppearInOrder: string[];
  mustNotCall: string[];
};

const cases: CancelCase[] = [
  {
    name: "no bookingId, room named → find_bookings then show_cancel_dialog_confirm; never find_room / find_booking_by_id / cancel_booking",
    message: "Cancel my Riverside Twin Room booking",
    mustAppearInOrder: ["find_bookings", "show_cancel_dialog_confirm"],
    mustNotCall: ["find_room", "find_booking_by_id", "cancel_booking"],
  },
];

evalite<CancelCase, CaseResult, CancelCase>(
  "cancel_booking — resolve by name, stop at the cancel dialog",
  {
    data: () => cases.map((c) => ({ input: c, expected: c })),
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "Reached the cancel dialog in order",
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
        name: "Never called a forbidden tool this turn",
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
      { label: "Tool calls", value: output.toolNames.join(" → ") || "(none)" },
    ],
  },
);
