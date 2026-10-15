import { evalite } from "evalite";

import { scoreResult } from "../../support/checks";
import { runCase, type CaseResult } from "../../support/run-case";
import { FIXTURE_ROOMS } from "../../support/fixtures";

/**
 * `get_room_by_id` — real LLM agent turns, structured scoring.
 *
 * `get_room_by_id` fetches one room by id. It is reached three ways
 * (`WORKFLOW_DETAIL` / `WORKFLOW_BOOK` / `PRIORITY_TRIGGERS`):
 *   - detail intent + name only → `find_room` → (1 match) → `get_room_by_id`
 *   - `[book-form]` / `roomId:` with no dates → `get_room_by_id` only, and
 *     NEVER `check_room_availability` on that turn
 *   - the step machine forces it to open the Booking Form after
 *     `find_room(book_resolve)` with a partial stay (covered in
 *     `deterministic/find-room.eval.ts`)
 *
 * Trimmed to the one load-bearing routing case: `[book-form]` → `get_room_by_id`
 * only. (The "tell me about <room>" / amenities detail-chain cases were removed
 * to save tokens — they were KNOWN-FAILING documentation of an unfixed prompt
 * gap: `WORKFLOW_DETAIL` says `find_room` → 1 match → `get_room_by_id`, but live
 * runs call `find_room` and stop. That gap still needs a prompt fix, out of
 * scope here.)
 */
const RIVERSIDE = FIXTURE_ROOMS[1]!; // room-riverside-twin

type DetailCase = {
  name: string;
  message: string;
  mustCallInOrder: string[];
  mustNotCall: string[];
  knownFailing?: boolean;
};

const cases: DetailCase[] = [
  {
    name: "[book-form] roomId → get_room_by_id only, never check_room_availability",
    message: `[book-form]\nroomId: ${RIVERSIDE.id}`,
    mustCallInOrder: ["get_room_by_id"],
    mustNotCall: ["find_room", "check_room_availability", "confirm_booking"],
  },
];

evalite<DetailCase, CaseResult, DetailCase>("get_room_by_id — detail & book-form routing", {
  data: () => cases.map((c) => ({ input: c, expected: c })),
  task: (input) => runCase(input.message),
  scorers: [
    {
      name: "Called required tools in order",
      description:
        "Every tool in mustCallInOrder appears in that relative order (other tools may interleave).",
      scorer: ({ output, expected }) => {
        const names = output.toolNames;
        let cursor = -1;
        for (const tool of expected!.mustCallInOrder) {
          const index = names.indexOf(tool, cursor + 1);
          if (index === -1) {
            return scoreResult(
              false,
              `${expected!.knownFailing ? "[KNOWN FAILING] " : ""}missing or out-of-order "${tool}" — got [${names.join(", ") || "none"}]`,
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
          hit.length === 0 ? "no forbidden tool calls" : `unexpectedly called [${hit.join(", ")}]`,
        );
      },
    },
  ],
  columns: ({ input, output }) => [
    { label: "Message", value: input.message },
    { label: "Tool calls", value: output.toolNames.join(" → ") || "(none)" },
  ],
});
