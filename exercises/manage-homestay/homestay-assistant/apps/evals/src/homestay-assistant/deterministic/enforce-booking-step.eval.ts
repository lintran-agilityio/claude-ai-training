import { TOOL_KEYS, TOOL_PURPOSE } from "@repo/constants";

import { enforceStepEval } from "../../support/enforce-step-contract";

/**
 * `enforceBookingStep` (the agent's `prepareStep`) driven end-to-end, no LLM.
 *
 * The sibling suites (`find-booking-by-id`, `update-booking`, `create-booking`,
 * `cancel-booking`, `find-room`) all drive `resolveEnforcedTransition` — the
 * pure routing decision. That proves the table but not that the machine ever
 * READS a tool result, and a total outage lived in exactly that gap:
 * `enforceBookingStep` took its trailing step from
 * `args.steps.at(-1)?.toolResults.at(-1)`, which is empty on every step on
 * @mastra/core 1.43 (`toolResults` is a getter over `StepResult.content`, and
 * `content` arrives as `[]`). Every backend junction silently stopped firing —
 * `find_booking_by_id` never opened the modify form or the confirm card, and an
 * ambiguous MODIFY re-forced `find_booking_by_id` on every step until the run's
 * step budget ran out — while this deterministic suite stayed 100% green.
 *
 * So these cases assert the emitted Mastra envelope from a realistic args shape
 * (populated turn transcript, `steps[]` entries with empty `toolResults`), and
 * walk whole turns rather than single junctions.
 */

const BOOKING_ID = "booking-1";
const ROOM_ID = "room-1";

const resolvedBooking = {
  bookingId: BOOKING_ID,
  roomId: ROOM_ID,
  roomName: "Riverside Twin Room",
  checkInDate: "2026-10-05",
  checkOutDate: "2026-10-08",
  guests: 2,
  totalPrice: 1_950_000,
};

/** `find_bookings` resolving two stays for one room name. */
const ambiguousFindBookings = {
  toolName: TOOL_KEYS.BOOKING.FIND,
  input: { roomName: "Riverside Twin Room" },
  output: {
    status: "ambiguous",
    bookings: [
      { id: BOOKING_ID, roomId: ROOM_ID },
      { id: "booking-2", roomId: ROOM_ID },
    ],
  },
};

const pickerConfirmed = {
  toolName: TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
  input: { bookingIds: [BOOKING_ID, "booking-2"] },
  output: { confirmed: true, bookingId: BOOKING_ID, roomName: "Riverside Twin Room" },
};

/** `find_booking_by_id(modify)` with no stated change — the edit-form path. */
const findByIdNoStatedChange = {
  toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
  input: { bookingId: BOOKING_ID, purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
  output: { bookings: [resolvedBooking], bookingId: BOOKING_ID },
};

enforceStepEval("enforceBookingStep — whole MODIFY turns through prepareStep", [
  {
    // The reported bug, case 1: "I want to modify <room>" on a room booked ONCE.
    // The confirm/edit card only opens because this junction forces it — when
    // the machine went inert the model was free to jump straight to
    // update_booking, silently "updating" a booking with no card at all.
    name: "single booking · find_bookings → find_booking_by_id, nothing stated → force the edit form",
    transcript: [
      {
        toolName: TOOL_KEYS.BOOKING.FIND,
        input: { roomName: "Riverside Twin Room" },
        output: { status: "resolved", booking: { id: BOOKING_ID, roomId: ROOM_ID } },
      },
      findByIdNoStatedChange,
    ],
    expected: `force:${TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING}`,
  },
  {
    name: "ambiguous · find_bookings alone → pass (the model picks the picker; find_bookings carries no purpose)",
    transcript: [ambiguousFindBookings],
    expected: "pass",
  },
  {
    name: "ambiguous · picker confirmed → force find_booking_by_id for the chosen stay",
    transcript: [ambiguousFindBookings, pickerConfirmed],
    expected: `force:${TOOL_KEYS.BOOKING.FIND_BY_ID}`,
  },
  {
    // The reported bug, case 2. `show_modify_dialog_select` stayed the newest
    // settled HITL result for the rest of the turn, so the HITL-only fallback
    // re-forced find_booking_by_id here forever and no card ever opened.
    name: "ambiguous · picker → find_booking_by_id resolved → force the edit form (never re-force find_booking_by_id)",
    transcript: [ambiguousFindBookings, pickerConfirmed, findByIdNoStatedChange],
    expected: `force:${TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING}`,
  },
  {
    name: "ambiguous · edit form submitted → force confirm_modify_booking",
    transcript: [
      ambiguousFindBookings,
      pickerConfirmed,
      findByIdNoStatedChange,
      {
        toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
        output: { confirmed: true, bookingId: BOOKING_ID },
      },
    ],
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
  },
  {
    name: "ambiguous · modify confirmed → force the terminal update_booking",
    transcript: [
      ambiguousFindBookings,
      pickerConfirmed,
      findByIdNoStatedChange,
      {
        toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
        output: { confirmed: true, bookingId: BOOKING_ID },
      },
      {
        toolName: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
        output: {
          confirmed: true,
          bookingId: BOOKING_ID,
          checkInDate: "2026-10-05",
          checkOutDate: "2026-10-09",
          guests: 2,
        },
      },
    ],
    expected: `force:${TOOL_KEYS.BOOKING.UPDATE_BOOKING}`,
  },
  {
    name: "ambiguous · update_booking returned → stop the turn",
    transcript: [
      ambiguousFindBookings,
      pickerConfirmed,
      findByIdNoStatedChange,
      {
        toolName: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
        output: { confirmed: true, bookingId: BOOKING_ID },
      },
      {
        toolName: TOOL_KEYS.BOOKING.UPDATE_BOOKING,
        output: { id: BOOKING_ID, status: "confirmed" },
      },
    ],
    expected: "stop",
  },
  {
    // Stated-change path: find_booking_by_id probed availability itself, so the
    // edit form is skipped entirely.
    name: "stated change · probe free → force confirm_modify_booking (no edit form)",
    transcript: [
      {
        toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
        input: {
          bookingId: BOOKING_ID,
          purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY,
        },
        output: {
          bookings: [resolvedBooking],
          bookingId: BOOKING_ID,
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
    ],
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
  },
  {
    name: "declined edit form → stop the turn",
    transcript: [
      findByIdNoStatedChange,
      {
        toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
        output: { confirmed: false },
      },
    ],
    expected: "stop",
  },
  {
    name: "no tool has run yet this turn → pass (the model opens the turn)",
    transcript: [],
    expected: "pass",
  },
]);

const editFormConfirmed = {
  toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
  output: {
    confirmed: true,
    bookingId: BOOKING_ID,
    roomId: ROOM_ID,
    checkInDate: "2026-10-05",
    checkOutDate: "2026-10-10",
    guests: 2,
  },
};

/**
 * The same junctions, in the message shape the live runtime actually hands
 * `prepareStep` after a guest answers a HITL card (see `liveTurnMessages`): one
 * merged assistant message whose parts carry `step: undefined`, HITL results as
 * JSON strings. Every case above uses clean fixture JSON, so all of them stayed
 * green while production was broken: `asJsonValue` rejected the whole message
 * content over that one `undefined`, the transcript scan skipped it, and the
 * machine forced nothing for the rest of the turn. Reported as "the modify
 * picker never leads to the confirm_modify_booking card".
 */
enforceStepEval(
  "enforceBookingStep — MODIFY turns in the live post-HITL message shape",
  [
    {
      name: "live · picker confirmed → force find_booking_by_id",
      liveMessageShape: true,
      transcript: [pickerConfirmed],
      expected: `force:${TOOL_KEYS.BOOKING.FIND_BY_ID}`,
    },
    {
      name: "live · picker → find_booking_by_id, nothing stated → force the edit form",
      liveMessageShape: true,
      transcript: [pickerConfirmed, findByIdNoStatedChange],
      expected: `force:${TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING}`,
    },
    {
      // The reported bug: after Continue the unguided model reopened the
      // picker instead — confirm_modify_booking never rendered.
      name: "live · edit form submitted → force confirm_modify_booking",
      liveMessageShape: true,
      transcript: [ambiguousFindBookings, editFormConfirmed],
      expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
    },
    {
      name: "live · picker → stated change, probe free → force confirm_modify_booking",
      liveMessageShape: true,
      transcript: [
        pickerConfirmed,
        {
          toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
          input: {
            bookingId: BOOKING_ID,
            purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY,
          },
          output: {
            bookings: [resolvedBooking],
            bookingId: BOOKING_ID,
            requestedCheckOutDate: "2026-10-10",
            availability: {
              available: true,
              guestsWithinCapacity: true,
              checkInDate: "2026-10-05",
              checkOutDate: "2026-10-10",
              guests: 2,
            },
          },
        },
      ],
      expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
    },
    {
      // Same bug class one level down: a backend output with an optional key
      // left `undefined` (room lookup failed) used to null the whole output.
      name: "live · find_booking_by_id output with an undefined optional key → still force the edit form",
      liveMessageShape: true,
      transcript: [
        pickerConfirmed,
        {
          ...findByIdNoStatedChange,
          output: {
            ...findByIdNoStatedChange.output,
            room: undefined,
            reason: undefined,
          },
        },
      ],
      expected: `force:${TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING}`,
    },
    {
      name: "live · modify confirmed → force the terminal update_booking",
      liveMessageShape: true,
      transcript: [
        ambiguousFindBookings,
        {
          toolName: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
          output: {
            confirmed: true,
            bookingId: BOOKING_ID,
            checkInDate: "2026-10-05",
            checkOutDate: "2026-10-10",
            guests: 2,
          },
        },
      ],
      expected: `force:${TOOL_KEYS.BOOKING.UPDATE_BOOKING}`,
    },
    {
      name: "live · update_booking returned → stop the turn",
      liveMessageShape: true,
      transcript: [
        ambiguousFindBookings,
        {
          toolName: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
          output: { confirmed: true, bookingId: BOOKING_ID },
        },
        {
          toolName: TOOL_KEYS.BOOKING.UPDATE_BOOKING,
          output: { id: BOOKING_ID, status: "confirmed" },
        },
      ],
      expected: "stop",
    },
    {
      name: "live · edit form declined → stop the turn",
      liveMessageShape: true,
      transcript: [
        ambiguousFindBookings,
        {
          toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
          output: { confirmed: false },
        },
      ],
      expected: "stop",
    },
  ],
);
