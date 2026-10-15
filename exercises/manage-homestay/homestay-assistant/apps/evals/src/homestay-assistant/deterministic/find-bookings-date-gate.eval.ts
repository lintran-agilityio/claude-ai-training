import { evalite } from "evalite";

import type { FindBookingsInput } from "@repo/schemas";
import { applyFindBookingsDateGate } from "@agent/mastra/utils/sanitize-find-bookings";

import { scoreResult } from "../../support/checks";

/**
 * `applyFindBookingsDateGate` (`sanitize-find-bookings.ts`) — the
 * deterministic gate `find_bookings` applies to `dateFrom`/`dateTo`, no LLM.
 *
 * Reported (2026-09-13): "wanna to extend my stay one more day of Moonlight
 * Loft room" replied "There are no active bookings for the Moonlight Loft
 * room" even though the guest had an active Moonlight Loft booking — while
 * "modify guest number of Moonlight Loft room to 1" resolved it fine.
 * Repro'd against the real production model (gpt-4o-mini) via
 * `apps/evals/src/support/agent-harness.ts`: it called
 * `find_bookings({ roomName: "Moonlight Loft", dateFrom: "<today>",
 * dateTo: "<tomorrow>" })` — misreading "one more day" as a date/weekend cue
 * (a pattern only ever meant for CANCEL's stated-date disambiguation, see
 * `findBookingsInputSchema`) and inventing a today→tomorrow range that
 * doesn't overlap the real (later) booking, so the overlap filter in
 * `booking.repository.ts` excluded it. The guest-count request never sets
 * `dateFrom`/`dateTo`, so it was never affected.
 *
 * Tightening the tool/schema description alone did NOT stop gpt-4o-mini from
 * inventing the range on a second repro — so this is a deterministic gate,
 * not a prompt fix: `dateFrom`/`dateTo` only ever survive when the model also
 * reports `purpose: "cancel"`. Confirmed against the real model afterward
 * that the gate neutralizes the invented range end-to-end (find_bookings
 * resolves → find_booking_by_id → confirm_modify_booking with the correct
 * extended checkout).
 */
type Case = {
  name: string;
  input: FindBookingsInput;
  expected: Omit<FindBookingsInput, "purpose">;
};

const cases: Case[] = [
  {
    name: "MODIFY hallucinating a date range (the reported repro) — dateFrom/dateTo dropped",
    input: {
      purpose: "modify",
      roomName: "Moonlight Loft",
      dateFrom: "2026-09-13",
      dateTo: "2026-09-14",
    },
    expected: { roomName: "Moonlight Loft" },
  },
  {
    name: "CHANGE_ROOM with a date range — also dropped",
    input: {
      purpose: "change_room",
      roomName: "Moonlight Loft",
      dateFrom: "2026-09-13",
      dateTo: "2026-09-14",
    },
    expected: { roomName: "Moonlight Loft" },
  },
  {
    name: "purpose omitted (model forgot to report it) — dropped by default, not passed through",
    input: {
      roomName: "Moonlight Loft",
      dateFrom: "2026-09-13",
      dateTo: "2026-09-14",
    },
    expected: { roomName: "Moonlight Loft" },
  },
  {
    name: "CANCEL with a stated weekend cue — dateFrom/dateTo pass through unchanged",
    input: {
      purpose: "cancel",
      roomName: "Moonlight Loft",
      dateFrom: "2026-09-19",
      dateTo: "2026-09-20",
    },
    expected: {
      roomName: "Moonlight Loft",
      dateFrom: "2026-09-19",
      dateTo: "2026-09-20",
    },
  },
  {
    name: "CANCEL with no date cue stated — nothing to pass through, still fine",
    input: { purpose: "cancel", roomName: "Moonlight Loft" },
    expected: { roomName: "Moonlight Loft" },
  },
  {
    name: "no roomName, no purpose, no dates — passes through empty",
    input: {},
    expected: {},
  },
];

evalite<FindBookingsInput, Omit<FindBookingsInput, "purpose">, Case["expected"]>(
  "find_bookings dateFrom/dateTo gate — CANCEL-only, dropped for everything else regardless of what the model reports",
  {
    data: () => cases.map((c) => ({ input: c.input, expected: c.expected })),
    task: (input) => applyFindBookingsDateGate(input),
    scorers: [
      {
        name: "gated params match expected",
        scorer: ({ output, expected }) => {
          const got = JSON.stringify(output);
          const want = JSON.stringify(expected);
          return scoreResult(
            got === want,
            got === want ? `matched: ${got}` : `expected ${want}, got ${got}`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Input", value: JSON.stringify(input) },
      { label: "Gated", value: JSON.stringify(output) },
    ],
  },
);
