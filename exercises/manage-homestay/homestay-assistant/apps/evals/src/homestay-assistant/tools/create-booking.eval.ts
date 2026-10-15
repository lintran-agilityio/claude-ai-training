import { evalite } from "evalite";

import { scoreResult } from "../../support/checks";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * `create_booking` — real LLM agent turns, structured scoring.
 *
 * `create_booking` is the CREATE terminal mutation. The property the whole HITL
 * design exists to guarantee: it NEVER fires without `find_room` →
 * `confirm_booking` in front of it, and because `confirm_booking` is a
 * frontend-rendered HITL call the turn naturally ends there awaiting a real
 * click — so "the terminal tool never appears in this single turn" is the
 * complete assertion (no resumed round-trip needed). CREATE never calls
 * `check_room_availability` — `find_room(book_resolve)` probes availability
 * itself, and a taken date stops the turn there (BookingUnavailable card).
 *
 * The no-LLM `confirm_booking` confirmed/dismissed → `create_booking`/stop gate
 * is in `deterministic/create-booking.eval.ts`.
 */
type CreateCase = {
  name: string;
  message: string;
  mustAppearInOrder: string[];
  mustNotCall: string[];
};

const cases: CreateCase[] = [
  {
    name: "available room → find_room → confirm_booking, never create_booking",
    message:
      "Book the Riverside Twin Room for 2 guests on October 22, one night",
    mustAppearInOrder: ["find_room", "confirm_booking"],
    mustNotCall: [
      "check_room_availability",
      "create_booking",
    ],
  },

  {
    // Riverside Twin has an existing booking 2026-10-05 → 2026-10-08.
    // find_room(book_resolve) reports the requested date as unavailable.
    name: "date taken → find_room only, turn stops",
    message:
      "Book the Riverside Twin Room for 2 guests on October 6, one night",
    mustAppearInOrder: ["find_room"],
    mustNotCall: [
      "get_room_by_id",
      "check_room_availability",
      "confirm_booking",
      "create_booking",
    ],
  },
];

evalite<CreateCase, CaseResult, CreateCase>(
  "create_booking — never mutates before the confirm gate",
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
        name: "Never called a forbidden tool this turn",
        description:
          "create_booking must wait for a real HITL click on the NEXT turn; a full-stay request must not detour through get_room_by_id.",
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
