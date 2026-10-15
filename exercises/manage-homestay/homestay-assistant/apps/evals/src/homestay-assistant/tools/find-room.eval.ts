import { evalite } from "evalite";
import { addDaysYmd, formatTodayYmd } from "@repo/utils/date";

import { argMatches, scoreResult } from "../../support/checks";
import { toolCallArgs } from "../../support/tool-calls";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * `find_room` — real LLM agent turns, structured scoring.
 *
 * `find_room` owns every room-discovery intent: search / filter / "available"
 * wording / recommend / soft-book / BOOK name resolution. For this agent the
 * intent IS the first tool it dispatches to (there is no separate intent
 * field), so "routed to find_room first" is the deterministic equivalent of
 * intent classification.
 *
 * Two concerns, two blocks:
 *   1. Selection — search/available/weekend/date-range phrasing → find_room
 *      first, and "available" wording never mis-routes to get_bookings.
 *   2. Arguments — dates normalized to absolute YYYY-MM-DD, guests never
 *      invented, level synonyms, limit. Only relative phrases the system
 *      prompt pre-resolves (`tomorrow`, `this weekend`) are asserted, computed
 *      with the same `@repo/utils/date` helpers the prompt uses.
 *
 * The no-LLM `find_room(book_resolve)` → step-machine fork is in
 * `deterministic/find-room.eval.ts`.
 */

// --- Selection ----------------------------------------------------------
type SelectionCase = {
  name: string;
  message: string;
  /** find_room must be first; none of these may appear this turn. */
  forbidden: string[];
};

// Trimmed to the two phrasings that actually regress: an explicit
// date/guest search, and bare "available" wording (the historical
// mis-route to get_bookings). Other phrasings asserted the same thing.
const selectionCases: SelectionCase[] = [
  {
    name: "search — guests + explicit date",
    message: "Find me a room for 2 guests on October 10",
    forbidden: ["get_bookings", "get_rooms"],
  },
  {
    name: "available wording — 'what rooms are available' never routes to booking list",
    message: "What rooms are available?",
    forbidden: ["get_bookings"],
  },
];

evalite<SelectionCase, CaseResult, SelectionCase>(
  "find_room — selection: discovery intent routes to find_room first",
  {
    data: () => selectionCases.map((c) => ({ input: c, expected: c })),
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "First tool is find_room",
        scorer: ({ output }) =>
          scoreResult(
            output.toolNames[0] === "find_room",
            `expected first tool "find_room", got [${output.toolNames.join(", ") || "none"}]`,
          ),
      },
      {
        name: "Never mis-routed to a booking-list / browse tool",
        scorer: ({ output, expected }) => {
          const hit = expected!.forbidden.filter((t) =>
            output.toolNames.includes(t),
          );
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
  },
);

// --- Arguments --------------------------------------------------------
const tomorrow = addDaysYmd(formatTodayYmd(), 1);

type ArgCase = {
  name: string;
  message: string;
  expected: {
    guests?: number;
    date?: string;
    level?: number;
    limit?: number;
    sortBy?: string;
    maxPrice?: number;
    /** field names that must NOT be set (null/undefined/absent all count). */
    unset?: string[];
  };
};

// Trimmed: one case proving a relative date normalizes + a stated guest
// count lands, one proving guests are never invented when unstated.
const argCases: ArgCase[] = [
  {
    name: "guests + relative date (tomorrow)",
    message: "Find a room for 3 guests tomorrow",
    expected: { guests: 3, date: tomorrow },
  },
  {
    name: "never invent guests — none stated",
    message: "Find a room available tomorrow",
    expected: { date: tomorrow, unset: ["guests"] },
  },
  {
    name: "ranking — plain browse request, no ranking wording (must NOT invent sortBy/limit)",
    message: "Show me available rooms.",
    expected: { unset: ["sortBy", "maxPrice", "limit"] },
  },
  {
    name: "ranking — plural, unspecified count (model should NOT invent a number)",
    message: "Show the most affordable rooms.",
    expected: { sortBy: "cheapest", unset: ["limit"] },
  },
  {
    name: "ranking — singular cheapest → limit 1",
    message: "Show me the cheapest room.",
    expected: { sortBy: "cheapest", limit: 1 },
  },
  {
    name: "ranking — singular cheapest, question form → limit 1",
    message: "What is the cheapest room?",
    expected: { sortBy: "cheapest", limit: 1 },
  },
  {
    name: "ranking — explicit count cheapest → limit 3",
    message: "Show me the 3 cheapest rooms.",
    expected: { sortBy: "cheapest", limit: 3 },
  },
  {
    name: "ranking — affordable + price ceiling sets both signals",
    message: "Show affordable rooms under 1,000,000.",
    expected: { sortBy: "cheapest", maxPrice: 1000000 },
  },
  {
    name: "ranking — most expensive, singular → limit 1",
    message: "What's your most expensive room?",
    expected: { sortBy: "most_expensive", limit: 1 },
  },
  {
    name: "ranking — most amenities, unspecified count",
    message: "Which rooms have the most amenities?",
    expected: { sortBy: "most_amenities", unset: ["limit"] },
  },
];

evalite<ArgCase, CaseResult, ArgCase["expected"]>(
  "find_room — arguments: dates normalized, guests never invented, synonyms",
  {
    data: () => argCases.map((c) => ({ input: c, expected: c.expected })),
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "Structured args match the request",
        scorer: ({ output, expected }) => {
          const args = toolCallArgs(output.toolCalls, "find_room");
          if (!args) return scoreResult(false, "find_room was never called");

          const problems: string[] = [];
          if (expected!.date !== undefined && args.date !== expected!.date) {
            problems.push(`date="${args.date}" ≠ "${expected!.date}"`);
          }
          if (
            expected!.guests !== undefined &&
            !argMatches(args.guests, expected!.guests)
          ) {
            problems.push(`guests=${args.guests} ≠ ${expected!.guests}`);
          }
          if (
            expected!.level !== undefined &&
            !argMatches(args.level, expected!.level)
          ) {
            problems.push(`level=${args.level} ≠ ${expected!.level}`);
          }
          if (
            expected!.limit !== undefined &&
            !argMatches(args.limit, expected!.limit)
          ) {
            problems.push(`limit=${args.limit} ≠ ${expected!.limit}`);
          }
          if (
            expected!.sortBy !== undefined &&
            !argMatches(args.sortBy, expected!.sortBy)
          ) {
            problems.push(`sortBy=${args.sortBy} ≠ ${expected!.sortBy}`);
          }
          if (
            expected!.maxPrice !== undefined &&
            !argMatches(args.maxPrice, expected!.maxPrice)
          ) {
            problems.push(`maxPrice=${args.maxPrice} ≠ ${expected!.maxPrice}`);
          }
          for (const field of expected!.unset ?? []) {
            if (!argMatches(args[field], undefined)) {
              problems.push(`${field}=${JSON.stringify(args[field])} should be unset`);
            }
          }

          return scoreResult(
            problems.length === 0,
            problems.length === 0
              ? `matched: ${JSON.stringify(args)}`
              : `${problems.join("; ")} — full args: ${JSON.stringify(args)}`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.message },
      {
        label: "find_room args",
        value: JSON.stringify(toolCallArgs(output.toolCalls, "find_room") ?? {}),
      },
    ],
  },
);
