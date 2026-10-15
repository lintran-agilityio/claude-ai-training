import { evalite } from "evalite";

import { selectConfirmModifyStayFromResult } from "@repo/utils";

import { scoreResult } from "../../support/checks";

/**
 * `selectConfirmModifyStayFromResult` — the no-LLM hydration that makes the
 * MODIFY stated-change confirm card deterministic.
 *
 * Bug it fixes: after `find_booking_by_id(purpose:"modify")` resolves a stated
 * change and its availability probe comes back free, the step machine forces
 * `confirm_modify_booking` (proven in `find-booking-by-id.eval.ts`). That HITL
 * call's args are model-authored, and a weak model routinely copies the
 * booking's ORIGINAL check-out into `checkOutDate` (both the original and the
 * probed date are in the result) or drops the `room` object. The confirm card
 * then sees `original === next`, `buildModifyChangeRows()` returns `[]`, and it
 * hides itself as a no-op — the guest gets the companion sentence
 * ("Please review and confirm the changes.") and no card.
 *
 * This helper takes the `find_booking_by_id` result as the single source of
 * truth: `proposed` = `result.availability` (the merged stay the probe
 * cleared), `original` = the booking row. Which result a card may read is
 * scoped to its own modify episode — see `modify-episode-isolation.eval.ts`.
 */

const ROOM = {
  id: "room-riverside-twin",
  name: "Riverside Twin Room",
  pricePerNight: 650_000,
};

const BOOKING = {
  bookingId: "booking-1",
  checkInDate: "2026-10-05",
  checkOutDate: "2026-10-08",
  guests: 2,
};

const freeProbe = (over: Partial<Record<string, unknown>>) => ({
  available: true,
  guestsWithinCapacity: true,
  checkInDate: BOOKING.checkInDate,
  checkOutDate: BOOKING.checkOutDate,
  guests: BOOKING.guests,
  ...over,
});

type Case = {
  name: string;
  result: Record<string, unknown>;
  bookingId?: string;
  /** null → helper must return null (no confirm card on this path). */
  expected:
    | null
    | {
        checkInDate: string;
        checkOutDate: string;
        guests: number;
        originalCheckOutDate: string;
        room: boolean;
      };
};

const cases: Case[] = [
  {
    name: "extend +1: proposed check-out is the PROBED date, not the booking's original",
    result: {
      bookings: [BOOKING],
      room: ROOM,
      requestedCheckOutDate: "2026-10-09",
      availability: freeProbe({ checkOutDate: "2026-10-09" }),
    },
    expected: {
      checkInDate: "2026-10-05",
      checkOutDate: "2026-10-09",
      guests: 2,
      originalCheckOutDate: "2026-10-08",
      room: true,
    },
  },
  {
    name: "shorten -1: proposed check-out is the earlier probed date",
    result: {
      bookings: [BOOKING],
      room: ROOM,
      requestedCheckOutDate: "2026-10-07",
      availability: freeProbe({ checkOutDate: "2026-10-07" }),
    },
    expected: {
      checkInDate: "2026-10-05",
      checkOutDate: "2026-10-07",
      guests: 2,
      originalCheckOutDate: "2026-10-08",
      room: true,
    },
  },
  {
    name: "explicit absolute check-out: proposed check-out follows the probe",
    result: {
      bookings: [BOOKING],
      room: ROOM,
      requestedCheckOutDate: "2026-10-20",
      availability: freeProbe({ checkOutDate: "2026-10-20" }),
    },
    expected: {
      checkInDate: "2026-10-05",
      checkOutDate: "2026-10-20",
      guests: 2,
      originalCheckOutDate: "2026-10-08",
      room: true,
    },
  },
  {
    name: "guests change: proposed guests from probe, original guests from booking",
    result: {
      bookings: [BOOKING],
      room: ROOM,
      requestedGuests: 3,
      availability: freeProbe({ guests: 3 }),
    },
    expected: {
      checkInDate: "2026-10-05",
      checkOutDate: "2026-10-08",
      guests: 3,
      originalCheckOutDate: "2026-10-08",
      room: true,
    },
  },
  {
    name: "no availability block (edit-form path) → null (no confirm card here)",
    result: { bookings: [BOOKING], room: ROOM },
    expected: null,
  },
  {
    name: "probe unavailable (dates taken) → null (turn stops, BookingUnavailable renders)",
    result: {
      bookings: [BOOKING],
      room: ROOM,
      availability: freeProbe({ available: false, checkOutDate: "2026-10-09" }),
    },
    expected: null,
  },
  {
    name: "probe over capacity → null",
    result: {
      bookings: [BOOKING],
      room: ROOM,
      availability: freeProbe({ guestsWithinCapacity: false, guests: 9 }),
    },
    expected: null,
  },
  {
    name: "multiple bookings + bookingId → originals come from the selected booking",
    bookingId: "booking-2",
    result: {
      bookings: [
        BOOKING,
        {
          bookingId: "booking-2",
          checkInDate: "2026-12-01",
          checkOutDate: "2026-12-04",
          guests: 4,
        },
      ],
      room: ROOM,
      requestedCheckOutDate: "2026-12-05",
      availability: {
        available: true,
        guestsWithinCapacity: true,
        checkInDate: "2026-12-01",
        checkOutDate: "2026-12-05",
        guests: 4,
      },
    },
    expected: {
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-05",
      guests: 4,
      originalCheckOutDate: "2026-12-04",
      room: true,
    },
  },
  {
    name: "bookingId not in this result → null (never another booking's bookings[0])",
    bookingId: "booking-other",
    result: {
      bookings: [BOOKING],
      room: ROOM,
      requestedCheckOutDate: "2026-10-09",
      availability: freeProbe({ checkOutDate: "2026-10-09" }),
    },
    expected: null,
  },
];

evalite<Case, ReturnType<typeof selectConfirmModifyStayFromResult>, Case["expected"]>(
  "confirm_modify_booking stay hydration — proposed stay comes from the probe, not the model's args",
  {
    data: () => cases.map((testCase) => ({ input: testCase, expected: testCase.expected })),
    task: (input) =>
      selectConfirmModifyStayFromResult(input.result as never, input.bookingId),
    scorers: [
      {
        name: "resolution matches the find_booking_by_id result (probe = proposed, booking = original)",
        scorer: ({ output, expected }) => {
          if (expected == null) {
            return scoreResult(
              output === null,
              output === null
                ? "null as expected"
                : `expected null, got ${JSON.stringify(output)}`,
            );
          }
          if (!output) {
            return scoreResult(false, "expected a resolution, got null");
          }
          const problems: string[] = [];
          if (output.proposed.checkInDate !== expected.checkInDate)
            problems.push(`proposed.checkInDate=${output.proposed.checkInDate}`);
          if (output.proposed.checkOutDate !== expected.checkOutDate)
            problems.push(
              `proposed.checkOutDate=${output.proposed.checkOutDate} (must be the probed date, not ${expected.originalCheckOutDate})`,
            );
          if (output.proposed.guests !== expected.guests)
            problems.push(`proposed.guests=${output.proposed.guests}`);
          if (output.original.checkOutDate !== expected.originalCheckOutDate)
            problems.push(`original.checkOutDate=${output.original.checkOutDate}`);
          if (Boolean(output.room) !== expected.room)
            problems.push(`room present=${Boolean(output.room)}`);
          return scoreResult(
            problems.length === 0,
            problems.length === 0
              ? `matched: ${JSON.stringify(output)}`
              : problems.join(", "),
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Case", value: input.name },
      { label: "Resolution", value: JSON.stringify(output) },
    ],
  },
);
