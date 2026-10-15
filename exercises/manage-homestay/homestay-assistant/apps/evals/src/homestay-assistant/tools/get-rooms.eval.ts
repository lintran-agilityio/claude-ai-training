import { evalite } from "evalite";

import { scoreResult } from "../../support/checks";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * `get_rooms` — real LLM agent turns, structured scoring.
 *
 * `get_rooms` is the plain catalog-browse tool: it fires ONLY for "show/browse
 * all rooms" with no name/date/guest/level filter and no "available" wording
 * (see `WORKFLOW_BROWSE` / `ROUTING_RULES`). Any availability or filter cue is
 * `find_room`'s job — asserted from the other side in
 * `behavioral/find-room.eval.ts`.
 *
 * Scoring is a structured assertion over the tool-call sequence, not a judge —
 * the reply wording after a browse turn is graded in
 * `conversation/response-quality.eval.ts`.
 */
type BrowseCase = {
  name: string;
  message: string;
  /** Exactly this tool first; none of these ever. */
  forbidden: string[];
};

const cases: BrowseCase[] = [
  {
    name: "browse — no filters at all",
    message: "Show me all the rooms you have",
    forbidden: ["find_room", "get_room_by_id", "get_bookings"],
  },
];

evalite<BrowseCase, CaseResult, BrowseCase>("get_rooms — plain catalog browse only", {
  data: () => cases.map((c) => ({ input: c, expected: c })),
  task: (input) => runCase(input.message),
  scorers: [
    {
      name: "First tool is get_rooms",
      scorer: ({ output }) =>
        scoreResult(
          output.toolNames[0] === "get_rooms",
          `expected first tool "get_rooms", got [${output.toolNames.join(", ") || "none"}]`,
        ),
    },
    {
      name: "Never reached for a filter/availability/booking tool",
      scorer: ({ output, expected }) => {
        const hit = expected!.forbidden.filter((t) => output.toolNames.includes(t));
        return scoreResult(
          hit.length === 0,
          hit.length === 0
            ? "no forbidden tool calls"
            : `unexpectedly called [${hit.join(", ")}]`,
        );
      },
    },
  ],
  columns: ({ input, output }) => [
    { label: "Message", value: input.message },
    { label: "Tool calls", value: output.toolNames.join(" → ") || "(none)" },
  ],
});
