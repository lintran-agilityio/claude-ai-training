import { evalite } from "evalite";

import { argMatches, scoreResult } from "../../support/checks";
import { toolCallArgs } from "../../support/tool-calls";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * `get_bookings` — real LLM agent turns, structured scoring.
 *
 * `get_bookings` is the guest-facing "show/list/view my bookings" tool. It must
 * fire for that language and NEVER fall through to `find_room` (the historical
 * regression — see `SHOW/LIST MY BOOKINGS OVERRIDE`). Its `onDate` arg may ONLY
 * come from a date cue in the *current* message — a plain "show my bookings"
 * omits it entirely (carrying an earlier search date silently narrows results
 * and can wrongly report "no active bookings").
 *
 * `find_bookings` (the internal cancel/modify resolver) is a different tool —
 * see `behavioral/find-bookings.eval.ts`.
 */

// --- Selection ----------------------------------------------------------
type SelectionCase = { name: string; message: string };

const selectionCases: SelectionCase[] = [
  { name: "'show my bookings'", message: "Show my bookings" },
];

evalite<SelectionCase, CaseResult, string>(
  "get_bookings — 'show my bookings' language routes here, never to room search",
  {
    data: () => selectionCases.map((c) => ({ input: c, expected: "get_bookings" })),
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "Called get_bookings, not find_room",
        scorer: ({ output, expected }) =>
          scoreResult(
            output.toolNames.includes(expected!) &&
              !output.toolNames.includes("find_room"),
            `tool calls: [${output.toolNames.join(", ") || "none"}]`,
          ),
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.message },
      { label: "Tool calls", value: output.toolNames.join(" → ") || "(none)" },
    ],
  },
);

// --- Arguments (onDate discipline) -------------------------------------
type OnDateCase = {
  name: string;
  message: string;
  /** "2026-12-25" → onDate must equal it; null → onDate must be unset. */
  onDate: string | null;
};

const onDateCases: OnDateCase[] = [
  {
    name: "explicit date cue in the message → onDate set",
    message: "Do I have any bookings for December 25?",
    onDate: "2026-12-25",
  },
  {
    name: "no date wording anywhere → onDate omitted",
    message: "Show my bookings",
    onDate: null,
  },
];

evalite<OnDateCase, CaseResult, OnDateCase>(
  "get_bookings — onDate only from a date cue in the current message",
  {
    data: () => onDateCases.map((c) => ({ input: c, expected: c })),
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "onDate matches the current message's date cue (or is unset)",
        scorer: ({ output, expected }) => {
          const args = toolCallArgs(output.toolCalls, "get_bookings");
          if (!args) return scoreResult(false, "get_bookings was never called");
          if (expected!.onDate === null) {
            return scoreResult(
              argMatches(args.onDate, undefined),
              `expected onDate unset, got onDate=${JSON.stringify(args.onDate)}`,
            );
          }
          return scoreResult(
            args.onDate === expected!.onDate,
            `expected onDate="${expected!.onDate}", got onDate=${JSON.stringify(args.onDate)}`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.message },
      {
        label: "get_bookings args",
        value: JSON.stringify(toolCallArgs(output.toolCalls, "get_bookings") ?? {}),
      },
    ],
  },
);
