import { evalite } from "evalite";
import { resolveStayCheckOut, resolveStayWindow } from "@repo/utils";

import {
  hasStatedCheckInCue,
  resolveStatedNights,
} from "@agent/mastra/utils/book-form-prefill";

import { scoreResult } from "../../support/checks";

/**
 * Stay LENGTH vs check-in DATE — the two halves of the invented-date bug, no LLM.
 *
 * Reported (2026-09-14): "I want to book Moonlight Loft in 4 nights for 4 people"
 * produced a stay of 2026-09-18 → 2026-09-19. Today was 2026-09-14, so 09-18 is
 * exactly today + 4: the model read "in 4 nights" as a check-in OFFSET, and the
 * four-night stay then collapsed to a single night.
 *
 * Two independent defects, one case each here:
 *
 * A. `hasStatedCheckInCue` wrongly corroborated the invented date. The gate
 *    itself was sound — it drops a model-supplied `find_room.date` that has no
 *    cue in the guest's own words — but `BARE_DAY_CUE` matched a bare
 *    `for <number>`, so the substring "for 4 people" read as a day-of-month and
 *    vouched for a date the guest never gave. It must be false here, and must
 *    still be TRUE for real day-of-month cues ("on the 18th").
 *
 * B. `nights` did not exist, so "4 nights" was discarded and every check-out was
 *    `checkIn + 1`. `resolveStatedNights` reads the count straight out of the
 *    guest's text (authoritative over whatever the model attached, exactly as
 *    `resolveStatedRelativeCheckIn` is for dates), and `resolveStayCheckOut` is
 *    the single owner of the check-out arithmetic.
 */

type CueCase = {
  name: string;
  text: string;
  /** Does the guest's own text carry a check-in date cue at all? */
  expectedCheckInCue: boolean;
  /** Stay length read deterministically out of that text. */
  expectedNights: number | undefined;
};

const cueCases: CueCase[] = [
  {
    name: "reported repro — stay length + guest count, no date anywhere",
    text: "I want to book Moonlight Loft in 4 nights for 4 people",
    expectedCheckInCue: false,
    expectedNights: 4,
  },
  {
    name: "stay length alone",
    text: "book Moonlight Loft for 4 nights",
    expectedCheckInCue: false,
    expectedNights: 4,
  },
  {
    name: "guest count alone — 'for 4 people' is not a day-of-month",
    text: "book Moonlight Loft for 4 people",
    expectedCheckInCue: false,
    expectedNights: undefined,
  },
  {
    name: "real day-of-month cue still corroborates (lookahead must not over-fire)",
    text: "book Moonlight Loft on the 18th",
    expectedCheckInCue: true,
    expectedNights: undefined,
  },
  {
    name: "day-of-month AND guest count together — the day still wins",
    text: "gonna to booking Courtyard Duplex at 20th for 4 guests",
    expectedCheckInCue: true,
    expectedNights: undefined,
  },
  // "starting September 18" / "from Sep 18" carry no preposition DATE_CUE
  // recognises. They used to pass the gate only because BARE_DAY_CUE matched an
  // unrelated "for N people" in the same sentence — remove that accident and
  // these silently stop corroborating, so MONTH_DAY_CUE now covers them for
  // real. Regression guards for the fix, not for the original bug.
  {
    name: "stay length + 'starting <month day>' — both are read",
    text: "I want to book Moonlight Loft for 4 nights starting September 18",
    expectedCheckInCue: true,
    expectedNights: 4,
  },
  {
    name: "'from <month day>' with a stay length",
    text: "book Moonlight Loft from September 18 for 4 nights",
    expectedCheckInCue: true,
    expectedNights: 4,
  },
  {
    name: "day-first month date",
    text: "book Moonlight Loft 18th September for 2 people",
    expectedCheckInCue: true,
    expectedNights: undefined,
  },
  {
    name: "month word that is also an English word, followed by a unit — not a date",
    text: "may 5 guests stay in Moonlight Loft",
    expectedCheckInCue: false,
    expectedNights: undefined,
  },
  {
    name: "weekend repro from the earlier date bug still has a cue",
    text: "i want to book Tea House Studio room at weekend for 1 guest",
    expectedCheckInCue: true,
    expectedNights: undefined,
  },
  {
    name: "days are nights for booking purposes",
    text: "book Misty Pavilion in 3 days",
    expectedCheckInCue: false,
    expectedNights: 3,
  },
  {
    name: "weeks convert to nights",
    text: "book Misty Pavilion for 2 weeks",
    expectedCheckInCue: false,
    expectedNights: 14,
  },
  {
    name: "months are NOT converted — length varies, guest picks real dates",
    text: "book Misty Pavilion for 2 months",
    expectedCheckInCue: false,
    expectedNights: undefined,
  },
  {
    name: "Vietnamese stay length + guest count",
    text: "đặt phòng Moonlight Loft 3 đêm cho 2 khách",
    expectedCheckInCue: false,
    expectedNights: 3,
  },
  {
    name: "no length and no date",
    text: "book Riverside Twin room",
    expectedCheckInCue: false,
    expectedNights: undefined,
  },
];

type CueOutput = { checkInCue: boolean; nights: number | undefined };

evalite<CueCase, CueOutput, CueOutput>(
  "stay length vs check-in cue — a duration must never corroborate a date",
  {
    data: () =>
      cueCases.map((c) => ({
        input: c,
        expected: {
          checkInCue: c.expectedCheckInCue,
          nights: c.expectedNights,
        },
      })),
    task: (input) => ({
      checkInCue: hasStatedCheckInCue(input.text),
      nights: resolveStatedNights(input.text),
    }),
    scorers: [
      {
        name: "check-in cue and stay length both match",
        scorer: ({ input, output, expected }) => {
          const got = JSON.stringify(output);
          const want = JSON.stringify(expected);
          return scoreResult(
            got === want,
            got === want
              ? `${input.name} — ${got}`
              : `${input.name} — expected ${want}, got ${got}`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.text },
      { label: "Check-in cue", value: String(output.checkInCue) },
      { label: "Nights", value: output.nights ?? "(none)" },
    ],
  },
);

type CheckOutCase = {
  name: string;
  checkInDate: string;
  nights: number | undefined;
  expected: string;
};

const checkOutCases: CheckOutCase[] = [
  {
    name: "four nights — the reported stay",
    checkInDate: "2026-09-18",
    nights: 4,
    expected: "2026-09-22",
  },
  {
    name: "one night",
    checkInDate: "2026-09-18",
    nights: 1,
    expected: "2026-09-19",
  },
  {
    name: "no stay length stated → one night",
    checkInDate: "2026-09-18",
    nights: undefined,
    expected: "2026-09-19",
  },
  {
    name: "crosses a month boundary",
    checkInDate: "2026-09-29",
    nights: 4,
    expected: "2026-10-03",
  },
  {
    name: "crosses a year boundary",
    checkInDate: "2026-12-30",
    nights: 3,
    expected: "2027-01-02",
  },
  // Bad counts fall back to one night rather than throwing — `nights` reaches
  // this function from model output, and a nonsense value must not break a
  // booking the guest can still fix in the form.
  { name: "zero nights → one night", checkInDate: "2026-09-18", nights: 0, expected: "2026-09-19" },
  { name: "negative nights → one night", checkInDate: "2026-09-18", nights: -1, expected: "2026-09-19" },
  { name: "fractional nights → one night", checkInDate: "2026-09-18", nights: 1.5, expected: "2026-09-19" },
];

evalite<CheckOutCase, string, string>(
  "resolveStayCheckOut — check-out is check-in + nights, owned by the app",
  {
    data: () => checkOutCases.map((c) => ({ input: c, expected: c.expected })),
    task: (input) => resolveStayCheckOut(input.checkInDate, input.nights),
    scorers: [
      {
        name: "resolves to the documented check-out",
        scorer: ({ input, output, expected }) =>
          scoreResult(
            output === expected,
            `${input.name} — expected ${expected}, got ${output}`,
          ),
      },
    ],
    columns: ({ input, output }) => [
      { label: "Check-in", value: input.checkInDate },
      { label: "Nights", value: input.nights ?? "(none)" },
      { label: "Check-out", value: output },
    ],
  },
);

/**
 * `resolveStayWindow` — the single owner of "is there enough to probe/book",
 * shared by findRoomTool's availability probe and the step machine that routes
 * on its result so the two can never disagree about which dates were checked.
 *
 * A stay length ("4 nights") on its own is deliberately NOT enough to form a
 * window — the platform never guesses a check-in, not even a plausible one
 * like today. Reverted 2026-09-14 (same day as the original fix): a first
 * version of this function DID start the window from today when only a length
 * was stated, which fixed the reported over-capacity card but reopened the
 * door to the platform inventing a check-in for a room that WAS available —
 * exactly what the original bug report objected to. Lin's ruling: unless a
 * real check-in date is known (stated, or carried from an earlier DATED
 * search), the Booking Form opens — always, regardless of `nights`.
 */
type WindowCase = {
  name: string;
  checkInDate: string | undefined;
  nights: number | undefined;
  expected: { checkInDate: string; checkOutDate: string } | null;
};

const windowCases: WindowCase[] = [
  {
    name: "stay length only, no check-in → no window (do not start from today)",
    checkInDate: undefined,
    nights: 4,
    expected: null,
  },
  {
    name: "check-in stated + length → that date + nights",
    checkInDate: "2026-09-18",
    nights: 4,
    expected: { checkInDate: "2026-09-18", checkOutDate: "2026-09-22" },
  },
  {
    name: "check-in stated, no length → one night",
    checkInDate: "2026-09-18",
    nights: undefined,
    expected: { checkInDate: "2026-09-18", checkOutDate: "2026-09-19" },
  },
  {
    name: "neither → no window; the Booking Form collects the dates",
    checkInDate: undefined,
    nights: undefined,
    expected: null,
  },
  {
    name: "nonsense length with no date → still no window (not a today→today stay)",
    checkInDate: undefined,
    nights: 0,
    expected: null,
  },
];

evalite<WindowCase, WindowCase["expected"], WindowCase["expected"]>(
  "resolveStayWindow — a stay length alone never forms a window; only a real check-in does",
  {
    data: () => windowCases.map((c) => ({ input: c, expected: c.expected })),
    task: (input) =>
      resolveStayWindow({
        checkInDate: input.checkInDate,
        nights: input.nights,
      }),
    scorers: [
      {
        name: "window matches (or correctly null)",
        scorer: ({ input, output, expected }) => {
          const got = JSON.stringify(output);
          const want = JSON.stringify(expected);
          return scoreResult(
            got === want,
            got === want
              ? `${input.name} — ${got}`
              : `${input.name} — expected ${want}, got ${got}`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Stated", value: `${input.checkInDate ?? "(no date)"} / ${input.nights ?? "(no length)"} nights` },
      { label: "Window", value: output ? `${output.checkInDate} → ${output.checkOutDate}` : "(none)" },
    ],
  },
);
