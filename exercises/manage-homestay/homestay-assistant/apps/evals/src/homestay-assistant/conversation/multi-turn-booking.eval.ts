import { randomUUID } from "node:crypto";

import { evalite } from "evalite";

import { scoreResult } from "../../support/checks";
import { wasCalledBefore } from "../../support/tool-calls";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * Multi-turn booking conversations — real LLM agent turns, structured scoring.
 *
 * Agent-level, not per-tool: what's under test is behavior that only shows up
 * across turns on ONE thread —
 *
 *   1. Stay CONTINUITY. A dated/guest-count search on an earlier turn lets a
 *      later bare "book <room>" skip the Booking Form and go straight to
 *      `confirm_booking` (`resolveContinuityStayHint` /
 *      `resolveFindRoomBookTransition`, `src/mastra/utils/`). The single-turn
 *      "full stay stated → skips the form" case lives in
 *      `tools/create-booking.eval.ts`; this proves the same when the date and
 *      guest count came from a previous turn.
 *   2. Gate discipline is not lost across turns. After an unrelated read turn,
 *      a modify request still resolves the booking first and still stops at the
 *      HITL confirm — it never mutates, and a room name in a modify request
 *      never re-routes to `find_room` ("Modify/Cancel intent ≠ FIND workflow").
 *
 * HITL cards are left unresolved (default `HITL_CLIENT_TOOLS`, no `execute`) —
 * the turn stops at the card. The confirmed-click → terminal-mutation half is
 * `conversation/booking-hitl-flow.eval.ts`.
 *
 * Each case runs its turns with a shared fresh thread id; thread memory
 * persists across `runCase` calls (same runtime Mastra instance). Assertions
 * are always on the LAST turn's tool calls.
 */

type Turn = { message: string };

type ConversationCase = {
  name: string;
  turns: [Turn, ...Turn[]];
  /** Tools that must be present on the final turn. */
  finalMustCall: string[];
  /** Tools that must NOT be present on the final turn. */
  finalMustNotCall: string[];
  /** Optional ordering constraint on the final turn: [before, after]. */
  finalOrder?: [string, string];
};

// Trimmed to the continuity case — the behavior unique to this file (a stay
// stated on an earlier turn lets a later bare "book it" skip the form). The
// "gates still hold after an unrelated turn" case was dropped; the gate
// itself is proven single-turn in tools/update-booking.eval.ts and
// end-to-end in conversation/booking-hitl-flow.eval.ts.
const cases: ConversationCase[] = [
  {
    name: "continuity — dated search, then bare 'book it' reaches confirm_booking without reopening the form",
    turns: [
      { message: "What rooms are available for 2 guests on October 22?" },
      { message: "Great — go ahead and book the Riverside Twin Room." },
    ],
    finalMustCall: ["find_room", "confirm_booking"],
    // Form re-opener (get_room_by_id) must be skipped — date + guests are known
    // from turn 1; and no mutation before a real HITL click.
    finalMustNotCall: ["get_room_by_id", "create_booking", "check_room_availability"],
    finalOrder: ["find_room", "confirm_booking"],
  },
];

evalite<ConversationCase, CaseResult, ConversationCase>(
  "Multi-turn booking — continuity carries the stay; gates hold across turns",
  {
    data: () => cases.map((c) => ({ input: c, expected: c })),
    task: async (input) => {
      const threadId = `eval-multiturn-${randomUUID()}`;
      let last: CaseResult | null = null;
      for (const turn of input.turns) {
        last = await runCase(turn.message, { threadId });
      }
      return last!;
    },
    scorers: [
      {
        name: "Final turn called the required tools",
        scorer: ({ output, expected }) => {
          const missing = expected!.finalMustCall.filter(
            (t) => !output.toolNames.includes(t),
          );
          return scoreResult(
            missing.length === 0,
            missing.length === 0
              ? `all present in [${output.toolNames.join(", ")}]`
              : `missing [${missing.join(", ")}] — got [${output.toolNames.join(", ") || "none"}]`,
          );
        },
      },
      {
        name: "Final turn never mutated or mis-routed",
        scorer: ({ output, expected }) => {
          const hit = expected!.finalMustNotCall.filter((t) =>
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
      {
        name: "Final turn ordering",
        scorer: ({ output, expected }) => {
          if (!expected!.finalOrder) return scoreResult(true, "n/a");
          const [before, after] = expected!.finalOrder;
          const ok =
            output.toolNames.includes(before) &&
            output.toolNames.includes(after) &&
            wasCalledBefore(output.toolCalls, before, after);
          return scoreResult(
            ok,
            ok
              ? `"${before}" precedes "${after}"`
              : `expected "${before}" before "${after}" in [${output.toolNames.join(", ") || "none"}]`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Turns", value: input.turns.map((t) => t.message).join(" ⏎ ") },
      {
        label: "Final tool calls",
        value: output.toolNames.join(" → ") || "(none)",
      },
    ],
  },
);
