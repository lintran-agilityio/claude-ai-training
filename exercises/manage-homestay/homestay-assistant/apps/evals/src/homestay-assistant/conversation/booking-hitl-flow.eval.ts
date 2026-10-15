import { evalite } from "evalite";
import { BookingStatus } from "@repo/types";
import { addDaysYmd } from "@repo/utils/date";

import { scoreResult } from "../../support/checks";
import {
  EVAL_USER_ID,
  FIXTURE_BOOKINGS,
  FIXTURE_EXISTING_BOOKING,
} from "../../support/fixtures";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * End-to-end HITL booking flow — real LLM agent turns, structured scoring.
 *
 * Every other agent-turn eval in this suite deliberately STOPS at the HITL
 * confirm card (`HITL_CLIENT_TOOLS` have no `execute`), because the property
 * they assert is "the terminal mutation never fires before a real click".
 * This file asserts the other half of the contract: once the guest DOES
 * click confirm, the step machine's `CONFIRMATION_FOLLOW_UPS` chain
 * (`src/mastra/utils/step-machine.ts`) carries the guest-confirmed stay
 * through to the terminal mutation, and the mutation runs against the
 * fixture API with the confirmed values (not stale model args).
 *
 * `runCase(msg, { hitlResolution: "confirm" | "decline" })` swaps the HITL
 * stubs for versions that answer the card in-turn (see
 * `support/client-tools.ts::buildResolvingHitlTools`) — so `find_room →
 * confirm_booking → create_booking` all run inside one `agent.generate()`.
 * `CaseResult.apiBookings` is the fixture booking table after the turn.
 *
 * The no-LLM confirmed/dismissed → terminal/stop gates are proven in
 * `deterministic/{create,update,cancel}-booking.eval.ts`; this proves a real
 * model drives the same chain end to end.
 *
 * NOTE: the stated dates below (October 22 / November 1–3) are absolute in
 * the message, so the model resolves them to the current year. Like the
 * hardcoded fixture booking dates (`support/fixtures.ts`), revisit once
 * those dates are in the past.
 */

const RIVERSIDE_ROOM_ID = "room-riverside-twin";
const existingCount = FIXTURE_BOOKINGS.length;

type FlowCase = {
  name: string;
  message: string;
  hitlResolution: "confirm" | "decline";
  /** Tool calls that MUST appear, in this order. */
  mustAppearInOrder: string[];
  /** Tool calls that must NOT appear this turn. */
  mustNotCall: string[];
  /** Assertion over the fixture booking table after the turn. */
  expectApiState: (bookings: CaseResult["apiBookings"]) => {
    pass: boolean;
    reason: string;
  };
};

const cases: FlowCase[] = [
  {
    name: "CREATE — guest confirms → create_booking runs with the confirmed stay",
    message:
      "Book the Riverside Twin Room for 2 guests on October 22, one night",
    hitlResolution: "confirm",
    mustAppearInOrder: ["find_room", "confirm_booking", "create_booking"],
    mustNotCall: ["check_room_availability", "get_bookings"],
    expectApiState: (bookings) => {
      if (bookings.length !== existingCount + 1) {
        return {
          pass: false,
          reason: `expected ${existingCount + 1} bookings, got ${bookings.length}`,
        };
      }
      const created = bookings.find(
        (b) => !FIXTURE_BOOKINGS.some((f) => f.id === b.id),
      );
      if (!created) return { pass: false, reason: "no new booking row appeared" };
      const problems: string[] = [];
      if (created.roomId !== RIVERSIDE_ROOM_ID)
        problems.push(`roomId=${created.roomId}`);
      if (created.guests !== 2) problems.push(`guests=${created.guests}`);
      // Year is whatever the model resolved "October 22" to; assert the stated
      // month/day and a one-night stay rather than pinning the year.
      if (!/^\d{4}-10-22$/.test(created.checkInDate))
        problems.push(`checkInDate=${created.checkInDate}`);
      if (created.checkOutDate !== addDaysYmd(created.checkInDate, 1))
        problems.push(
          `checkOutDate=${created.checkOutDate} (not check-in + 1 night)`,
        );
      if (created.userId !== EVAL_USER_ID)
        problems.push(`userId=${created.userId}`);
      return {
        pass: problems.length === 0,
        reason:
          problems.length === 0
            ? `created ${JSON.stringify({ roomId: created.roomId, checkInDate: created.checkInDate, checkOutDate: created.checkOutDate, guests: created.guests })}`
            : `wrong created row: ${problems.join(", ")}`,
      };
    },
  },
  {
    name: "CREATE — guest dismisses the confirm card → nothing is created",
    message:
      "Book the Riverside Twin Room for 2 guests on October 22, one night",
    hitlResolution: "decline",
    mustAppearInOrder: ["find_room", "confirm_booking"],
    mustNotCall: ["create_booking"],
    expectApiState: (bookings) => ({
      pass: bookings.length === existingCount,
      reason:
        bookings.length === existingCount
          ? "booking table unchanged"
          : `booking table grew to ${bookings.length}`,
    }),
  },
  // MODIFY end-to-end dropped to save tokens (longest chain: find_bookings →
  // find_booking_by_id → confirm_modify_booking → update_booking). Its gate is
  // proven no-LLM in deterministic/{update,find-booking-by-id}-booking.eval.ts,
  // and the CONFIRMATION_FOLLOW_UPS pinning it relies on is exercised by the
  // CREATE and CANCEL cases here.
  {
    name: "CANCEL — resolve by name, guest confirms → cancel_booking flips status to CANCELLED",
    message: "Please cancel my booking for the Riverside Twin Room",
    hitlResolution: "confirm",
    mustAppearInOrder: [
      "find_bookings",
      "show_cancel_dialog_confirm",
      "cancel_booking",
    ],
    mustNotCall: ["find_room", "create_booking", "update_booking"],
    expectApiState: (bookings) => {
      const row = bookings.find((b) => b.id === FIXTURE_EXISTING_BOOKING.id);
      if (!row) return { pass: false, reason: "existing booking row vanished" };
      return {
        pass: row.status === BookingStatus.CANCELLED,
        reason: `booking status is ${row.status}`,
      };
    },
  },
];

evalite<FlowCase, CaseResult, FlowCase>(
  "Booking HITL flow — confirmed click reaches the terminal mutation; dismissal does not",
  {
    data: () => cases.map((c) => ({ input: c, expected: c })),
    task: (input) =>
      runCase(input.message, { hitlResolution: input.hitlResolution }),
    scorers: [
      {
        name: "Tool chain ran in the documented order",
        scorer: ({ output, expected }) => {
          const names = output.toolNames;
          let cursor = -1;
          for (const tool of expected!.mustAppearInOrder) {
            const index = names.indexOf(tool, cursor + 1);
            if (index === -1) {
              return scoreResult(
                false,
                `missing or out-of-order "${tool}" — got [${names.join(", ") || "none"}]`,
              );
            }
            cursor = index;
          }
          return scoreResult(true, `saw expected order in [${names.join(", ")}]`);
        },
      },
      {
        name: "No forbidden tool ran this turn",
        scorer: ({ output, expected }) => {
          const hit = expected!.mustNotCall.filter((t) =>
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
      {
        name: "Fixture booking table reflects the confirmed outcome",
        description:
          "The terminal mutation (or its absence, on a dismissal) must be visible in the fake API state — proves the pinned confirmed stay actually reached apps/api.",
        scorer: ({ output, expected }) => {
          const verdict = expected!.expectApiState(output.apiBookings);
          return scoreResult(verdict.pass, verdict.reason);
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.message },
      { label: "HITL", value: input.hitlResolution },
      { label: "Tool calls", value: output.toolNames.join(" → ") || "(none)" },
      {
        label: "Bookings after",
        value: String(output.apiBookings.length),
      },
    ],
  },
);
