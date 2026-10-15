import { evalite } from "evalite";
import type { MastraDBMessage } from "@mastra/core/agent";
import type { ProcessInputStepArgs } from "@mastra/core/processors";
import { TOOL_KEYS } from "@repo/constants";

import { resolveContinuityStayHint } from "@agent/mastra/utils/book-form-prefill";

import { scoreResult } from "../../support/checks";

/**
 * Date continuity must carry a date the GUEST established — never one the
 * prompt told the model to invent, no LLM.
 *
 * Reported 2026-09-14 (follow-up to the stay-length bug): in a fresh thread
 * "i want to book Moonlight Loft in 4 nights for 4 people" correctly opened the
 * Booking Form, but in a thread that had earlier asked "show available room" the
 * same sentence produced a stay of 2026-09-14 → 2026-09-18 again.
 *
 * Cause: the playbook instructs the model to pass `date` = CURRENT DATE today
 * for any "available" search with no stated date (WORKFLOW — FIND / FILTER,
 * intent-playbook.ts). That auto-filled today is echoed on the find_room result
 * and is byte-identical to a date the guest actually gave, so
 * `resolveContinuityStayHint` read it back one turn later as an established
 * check-in — bypassing the per-turn corroboration gate entirely, which only
 * guards the CURRENT turn's echoed date.
 *
 * Fix: `find_room` stamps each dated result with `dateStated` (from
 * PENDING_CHECKIN_CUE, pinned per step by BookingFormPrefillProcessor from the
 * guest's own words). Continuity ignores `dateStated: false`.
 *
 * `undefined` must keep behaving as before — transcripts written before the
 * stamp existed are still replayed through this scan.
 */

const findRoomResult = (result: Record<string, unknown>): MastraDBMessage =>
  ({
    id: "eval-assistant-msg",
    role: "assistant",
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            state: "result",
            toolName: TOOL_KEYS.GET.FIND_ROOM,
            result,
          },
        },
      ],
    },
  }) as unknown as MastraDBMessage;

type Case = {
  name: string;
  result: Record<string, unknown>;
  /** Check-in the next BOOK turn is allowed to inherit, if any. */
  expected: string | undefined;
};

const cases: Case[] = [
  {
    name: "reported repro — undated 'show available room', model defaulted date to today",
    result: {
      purpose: "search",
      date: "2026-09-14",
      guests: 4,
      rooms: [],
      dateStated: false,
    },
    expected: undefined,
  },
  {
    name: "guest actually named the date — continuity still carries it",
    result: {
      purpose: "search",
      date: "2026-09-20",
      guests: 2,
      rooms: [],
      dateStated: true,
    },
    expected: "2026-09-20",
  },
  {
    name: "pre-stamp transcript (no dateStated) — unchanged, still trusted",
    result: { purpose: "search", date: "2026-09-20", guests: 2, rooms: [] },
    expected: "2026-09-20",
  },
  {
    name: "browse default date dropped, but the guest count from that search survives",
    result: {
      purpose: "search",
      date: "2026-09-14",
      guests: 4,
      rooms: [],
      dateStated: false,
    },
    expected: undefined,
  },
  {
    name: "recommend results count as continuity too",
    result: {
      purpose: "recommend",
      date: "2026-09-22",
      guests: 3,
      rooms: [],
      dateStated: true,
    },
    expected: "2026-09-22",
  },
];

evalite<Case, string | undefined, string | undefined>(
  "Date continuity — a browse-default 'today' is not a guest-established check-in",
  {
    data: () => cases.map((c) => ({ input: c, expected: c.expected })),
    task: (input) => {
      const args = {
        messages: [findRoomResult(input.result)],
      } as unknown as ProcessInputStepArgs;
      return resolveContinuityStayHint(args.messages)?.checkInDate;
    },
    scorers: [
      {
        name: "inherits only a guest-established check-in",
        scorer: ({ input, output, expected }) =>
          scoreResult(
            output === expected,
            `${input.name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(output)}`,
          ),
      },
    ],
    columns: ({ input, output }) => [
      { label: "Search result", value: JSON.stringify(input.result) },
      { label: "Inherited check-in", value: output ?? "(none)" },
    ],
  },
);

/**
 * The guest count on a browse-default search is unaffected — only the DATE was
 * auto-filled by the prompt. Dropping guests too would reopen the form asking
 * for something the guest already said.
 */
evalite<Case, number | undefined, number | undefined>(
  "Date continuity — guest count survives even when the browse date is dropped",
  {
    data: () =>
      cases.map((c) => ({
        input: c,
        expected: c.result.guests as number | undefined,
      })),
    task: (input) => {
      const args = {
        messages: [findRoomResult(input.result)],
      } as unknown as ProcessInputStepArgs;
      return resolveContinuityStayHint(args.messages)?.guests;
    },
    scorers: [
      {
        name: "guest count carries",
        scorer: ({ input, output, expected }) =>
          scoreResult(
            output === expected,
            `${input.name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(output)}`,
          ),
      },
    ],
    columns: ({ input, output }) => [
      { label: "Search result", value: JSON.stringify(input.result) },
      { label: "Inherited guests", value: output ?? "(none)" },
    ],
  },
);
