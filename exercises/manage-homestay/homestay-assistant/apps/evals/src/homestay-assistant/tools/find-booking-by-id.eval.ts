import { evalite } from "evalite";

import { argMatches, diffArgs, scoreResult } from "../../support/checks";
import { toolCallArgs } from "../../support/tool-calls";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * `find_booking_by_id` — real LLM agent turns, structured scoring.
 *
 * `find_booking_by_id` looks up one booking by id for CANCEL or MODIFY. Two
 * concerns:
 *   1. MODIFY stated-change extraction — when the guest's latest message states
 *      a new value it goes on the requested* args; fields the guest left alone
 *      stay unset (never fabricated). This is what lets the step machine skip
 *      the edit form.
 *      - An ABSOLUTE new checkout ("change checkout to Sep 20") →
 *        `requestedCheckOutDate`.
 *      - A RELATIVE extend/shorten ("one more night", "count one more date",
 *        "extend 2 nights", "shorten by one night") → `requestedCheckOutDeltaDays`
 *        as a whole-number count (negative to shorten). The model must NOT
 *        compute the date itself — the tool adds the delta to the resolved
 *        booking's authoritative current checkout.
 *   2. `[booking-cancel] bookingId:` priority trigger — `find_booking_by_id`
 *      then `show_cancel_dialog_confirm` in the SAME turn, with NO
 *      `find_bookings` first (the id is already known).
 *
 * The no-LLM junction (`find_booking_by_id(modify)` → edit form vs
 * confirm_modify_booking vs stop, the delta resolution, and the stated-change
 * availability outcomes the tool probes itself) is in
 * `deterministic/find-booking-by-id.eval.ts`.
 */

// --- MODIFY stated-change extraction: relative checkout delta ----------
type DeltaCase = { name: string; message: string; delta: number };

const relativeCheckoutCases: DeltaCase[] = [
  {
    name: "'count one more date' → delta 1 (do not compute the date)",
    message:
      "I want to change the checkout date for my Riverside Twin Room booking, count one more date",
    delta: 1,
  },
  {
    name: "'one more night' → delta 1",
    message: "Give my Riverside Twin Room booking one more night",
    delta: 1,
  },
  {
    name: "'add a day' → delta 1",
    message: "Add a day to the checkout of my Riverside Twin Room booking",
    delta: 1,
  },
  {
    name: "'shorten by one night' → delta -1",
    message: "Shorten my Riverside Twin Room stay by one night",
    delta: -1,
  },
  {
    name: "'extend 2 nights' → delta 2",
    message: "Extend my Riverside Twin Room booking by 2 nights",
    delta: 2,
  },
  {
    name: "broken English 'count 1 more date' → delta 1",
    message: "Riverside Twin Room checkout count 1 more date please",
    delta: 1,
  },
  {
    name: "VN-English 'thêm 1 đêm' → delta 1",
    message: "Thêm 1 đêm cho đặt phòng Riverside Twin Room của tôi",
    delta: 1,
  },
];

evalite<DeltaCase, CaseResult, number>(
  "find_booking_by_id — relative checkout change goes on requestedCheckOutDeltaDays (the tool does the date math)",
  {
    data: () =>
      relativeCheckoutCases.map((testCase) => ({
        input: testCase,
        expected: testCase.delta,
      })),
    task: (input) => runCase(input.message),
    scorers: [
      {
        // The contract is: the stated relative count lands on
        // requestedCheckOutDeltaDays (the tool then computes the date against
        // the resolved booking — the delta is authoritative even if the model
        // also sends a self-computed requestedCheckOutDate). A fabricated
        // check-in change would be a real bug and still fails.
        name: "stated relative count is on requestedCheckOutDeltaDays; no fabricated check-in change",
        scorer: ({ output, expected }) => {
          const args = toolCallArgs(output.toolCalls, "find_booking_by_id");
          if (!args) {
            return scoreResult(false, "find_booking_by_id was never called");
          }
          const deltaOk = args.requestedCheckOutDeltaDays === expected;
          const checkInOk = argMatches(args.requestedCheckInDate, undefined);
          return scoreResult(
            deltaOk && checkInOk,
            deltaOk && checkInOk
              ? `matched: ${JSON.stringify(args)}`
              : `expected requestedCheckOutDeltaDays=${expected} and no requestedCheckInDate — got ${JSON.stringify(args)}`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.message },
      {
        label: "find_booking_by_id args",
        value: JSON.stringify(
          toolCallArgs(output.toolCalls, "find_booking_by_id") ?? {},
        ),
      },
    ],
  },
);

// --- MODIFY stated-change extraction: absolute checkout still works ----
evalite<{ name: string; message: string }, CaseResult, Record<string, unknown>>(
  "find_booking_by_id — an ABSOLUTE stated checkout still uses requestedCheckOutDate",
  {
    data: () => [
      {
        input: {
          name: "absolute date → requestedCheckOutDate, no delta",
          message:
            "Change the checkout on my Riverside Twin Room booking to 2026-10-20",
        },
        expected: {
          requestedCheckOutDate: "2026-10-20",
          requestedCheckOutDeltaDays: undefined,
          requestedCheckInDate: undefined,
          requestedGuests: undefined,
        },
      },
    ],
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "absolute date on requestedCheckOutDate; delta left unset",
        scorer: ({ output, expected }) => {
          const args = toolCallArgs(output.toolCalls, "find_booking_by_id");
          if (!args) {
            return scoreResult(false, "find_booking_by_id was never called");
          }
          const mismatches = diffArgs(args, expected!);
          return scoreResult(
            mismatches.length === 0,
            mismatches.length === 0
              ? `matched: ${JSON.stringify(args)}`
              : `mismatched fields ${JSON.stringify(mismatches)} — full args: ${JSON.stringify(args)}`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.message },
      {
        label: "find_booking_by_id args",
        value: JSON.stringify(
          toolCallArgs(output.toolCalls, "find_booking_by_id") ?? {},
        ),
      },
    ],
  },
);
