import { evalite } from "evalite";

import { resolveStatedRelativeCheckIn } from "@agent/mastra/utils/book-form-prefill";

import { scoreResult } from "../../support/checks";

/**
 * `resolveStatedRelativeCheckIn` (`book-form-prefill.ts`) — the deterministic
 * override `find_room` applies to a model-supplied `date`, no LLM.
 *
 * Reported (2026-09-13): "book Tea House Studio room at weekend for 1 guest"
 * resolved to "Oct 21, 2023" — a well-formed YYYY-MM-DD that is simply wrong.
 * `sanitizeFindRoomDate` only re-derives a date from an UNRESOLVED cue word
 * ("weekend" verbatim); once the model has already turned that into some
 * absolute date, right or wrong, nothing downstream re-checked it against the
 * guest's own wording. This function is the fix: given the guest's raw latest
 * message + business `today`, it recomputes today/tomorrow/weekend
 * deterministically (reusing `getWeekendStay`, the same calendar math the
 * DATE CONTEXT prompt block and `sanitizeFindRoomDate` already trust) and
 * `find_room` overrides the model's value with it whenever it disagrees.
 */
const TODAY = "2026-09-13"; // Sunday — exercises getWeekendStay's Sunday roll-forward.

type Case = {
  name: string;
  text: string;
  expected: string | undefined;
};

const cases: Case[] = [
  {
    name: "reported repro — bare 'weekend' + guest count phrasing",
    text: "i want to book Tea House Studio room at weekend for 1 guest",
    expected: "2026-09-19",
  },
  {
    name: "guest count phrasing ('for 1 guest') must not be mistaken for an explicit day cue",
    text: "book Bamboo Family room for 3 guests next weekend",
    expected: "2026-09-19", // today is Sunday: current weekend already elapsed, see getWeekendStay
  },
  {
    name: "last weekend",
    text: "I stayed at the Lotus Single Room last weekend",
    expected: "2026-09-05",
  },
  {
    name: "tomorrow",
    text: "book a room for 1 guest tomorrow",
    expected: "2026-09-14",
  },
  {
    name: "today / tonight",
    text: "any room available tonight for 2 people",
    expected: "2026-09-13",
  },
  {
    name: "explicit month-day date wins over no relative cue",
    text: "book Heritage Suite for 2 guests on August 15",
    expected: undefined,
  },
  {
    name: "no date cue at all",
    text: "book Riverside Twin room",
    expected: undefined,
  },
];

evalite<Case, string | undefined, string | undefined>(
  "resolveStatedRelativeCheckIn — deterministic weekend/today/tomorrow override",
  {
    data: () => cases.map((c) => ({ input: c, expected: c.expected })),
    task: (input) => resolveStatedRelativeCheckIn(input.text, TODAY),
    scorers: [
      {
        name: "Resolves to the documented calendar date",
        scorer: ({ input, output, expected }) =>
          scoreResult(
            output === expected,
            `${input.name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(output)}`,
          ),
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.text },
      { label: "Resolved", value: output ?? "(unset)" },
    ],
  },
);
