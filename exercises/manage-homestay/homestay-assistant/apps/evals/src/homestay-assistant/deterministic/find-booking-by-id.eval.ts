import { TOOL_KEYS, TOOL_PURPOSE } from "@repo/constants";

import { stepContractEval } from "../../support/step-contract";

/**
 * `find_booking_by_id` — the MODIFY resolution junction, no LLM.
 *
 * After `find_booking_by_id(purpose: "modify")` pins exactly one booking, the
 * step machine routes on whether the guest already stated a new value (echoed
 * on the OUTPUT — `findBookingByIdTool` merges its own args with anything
 * pinned from an earlier `show_modify_dialog_select` pick):
 *   no stated change → `edit_modify_booking` (opens the modify FORM, which runs
 *     its own client-side availability check)
 *   stated change    → `findBookingByIdTool` ALREADY probed availability for the
 *     merged stay (excluding this booking) and attached `availability` /
 *     `stayUnchanged`. There is no `check_room_availability` tool: force
 *     `confirm_modify_booking` when free (or the probe failed), STOP on a no-op
 *     / taken / over-capacity result.
 * Multiple matches → no forced step (the picker resolves it).
 *
 * `purpose: "cancel"` never auto-routes here — the CANCEL flow forces nothing
 * until `show_cancel_dialog_confirm` returns (see `cancel-booking.eval.ts`).
 * The gates AFTER `confirm_modify_booking` are in `update-booking.eval.ts`.
 */
const booking = {
  bookingId: "booking-1",
  roomId: "room-riverside-twin",
  checkInDate: "2026-10-05",
  checkOutDate: "2026-10-08",
  guests: 2,
};

stepContractEval("find_booking_by_id — MODIFY: form vs confirm vs stop", [
  {
    name: "modify · 1 booking · no stated change → open the modify form (edit_modify_booking)",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: { bookings: [booking] },
    },
    expected: `force:${TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING}`,
  },
  {
    name: "modify · stated change · probe free → skip the form, force confirm_modify_booking",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: {
        bookings: [booking],
        requestedCheckInDate: "2026-11-01",
        availability: {
          available: true,
          guestsWithinCapacity: true,
          checkInDate: "2026-11-01",
          checkOutDate: "2026-11-04",
          guests: 2,
        },
      },
    },
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
  },
  {
    name: "modify · stated change · probe absent (call failed) → still force confirm_modify_booking",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: { bookings: [booking], requestedGuests: 3 },
    },
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
  },
  {
    // The tool resolved a relative "one more night" (requestedCheckOutDeltaDays: 1)
    // against the booking's current 2026-10-08 checkout and echoed the absolute
    // 2026-10-09 on requestedCheckOutDate — the step machine only ever sees the
    // resolved date, and must route it exactly like any other stated change.
    name: "modify · relative checkout delta resolved to a new date → force confirm_modify_booking",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: {
        bookings: [booking],
        requestedCheckOutDate: "2026-10-09",
        availability: {
          available: true,
          guestsWithinCapacity: true,
          checkInDate: "2026-10-05",
          checkOutDate: "2026-10-09",
          guests: 2,
        },
      },
    },
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
  },
  {
    // An ABSOLUTE stated checkout ("change checkout to 2026-10-20") echoes on
    // requestedCheckOutDate exactly like a resolved delta — same routing.
    name: "modify · explicit absolute checkout stated → force confirm_modify_booking",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: {
        bookings: [booking],
        requestedCheckOutDate: "2026-10-20",
        availability: {
          available: true,
          guestsWithinCapacity: true,
          checkInDate: "2026-10-05",
          checkOutDate: "2026-10-20",
          guests: 2,
        },
      },
    },
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
  },
  {
    // "shorten by one night" (requestedCheckOutDeltaDays: -1) → the tool
    // resolves the EARLIER checkout against the booking's current 2026-10-08
    // and echoes 2026-10-07; the step machine only sees the resolved date.
    name: "modify · relative checkout delta -1 (shorten) resolved to an earlier date → force confirm_modify_booking",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: {
        bookings: [booking],
        requestedCheckOutDate: "2026-10-07",
        availability: {
          available: true,
          guestsWithinCapacity: true,
          checkInDate: "2026-10-05",
          checkOutDate: "2026-10-07",
          guests: 2,
        },
      },
    },
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
  },
  {
    // requestedCheckOutDeltaDays: 0 (explicit no-op) — the tool echoes the
    // unchanged checkout and flags stayUnchanged, same terminal stop as any
    // genuine no-op.
    name: "modify · relative checkout delta 0 (explicit no-op) → stop",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: {
        bookings: [booking],
        requestedCheckOutDate: booking.checkOutDate,
        stayUnchanged: true,
      },
    },
    expected: "stop",
  },
  {
    name: "modify · stated change · dates taken → stop (BookingUnavailable renders)",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: {
        bookings: [booking],
        requestedCheckInDate: "2026-11-01",
        availability: {
          available: false,
          guestsWithinCapacity: true,
          checkInDate: "2026-11-01",
          checkOutDate: "2026-11-04",
          guests: 2,
        },
      },
    },
    expected: "stop",
  },
  {
    name: "modify · stated change · over capacity → stop",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: {
        bookings: [booking],
        requestedGuests: 9,
        availability: {
          available: true,
          guestsWithinCapacity: false,
          checkInDate: "2026-10-05",
          checkOutDate: "2026-10-08",
          guests: 9,
        },
      },
    },
    expected: "stop",
  },
  {
    name: "modify · stated change · no-op (merged stay equals current) → stop",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: { bookings: [booking], requestedGuests: 2, stayUnchanged: true },
    },
    expected: "stop",
  },
  {
    name: "modify · multiple matches → no forced step (the picker resolves it)",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: {
        bookings: [{ bookingId: "booking-1" }, { bookingId: "booking-2" }],
      },
    },
    expected: "pass",
  },
  {
    name: "cancel · 1 booking → no forced step (only show_cancel_dialog_confirm gates cancel)",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.CANCEL },
      output: { bookings: [booking] },
    },
    expected: "pass",
  },
]);
