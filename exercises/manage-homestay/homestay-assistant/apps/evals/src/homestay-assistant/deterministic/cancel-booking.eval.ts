import { TOOL_KEYS } from "@repo/constants";

import { stepContractEval } from "../../support/step-contract";

/**
 * `cancel_booking` — the CANCEL terminal and its HITL gate, no LLM.
 *
 * The model resolves the target (`find_bookings`) and opens
 * `show_cancel_dialog_confirm` itself — the step machine forces nothing there
 * (`find_bookings` → pass). It only enforces the gate AFTER the dialog:
 * confirmed → `cancel_booking`, dismissed → stop. Once `cancel_booking`
 * returns the turn is done.
 */
stepContractEval("cancel_booking — resolve is free, dialog gates the mutation", [
  {
    name: "find_bookings (resolve the target) → no forced step (agent opens the dialog)",
    last: {
      toolName: TOOL_KEYS.BOOKING.FIND,
      output: { bookings: [{ bookingId: "booking-1" }] },
    },
    expected: "pass",
  },
  {
    name: "cancel dialog confirmed → force the terminal cancel_booking",
    last: {
      toolName: TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM,
      output: { confirmed: true, bookingId: "booking-1" },
    },
    expected: `force:${TOOL_KEYS.BOOKING.CANCEL}`,
  },
  {
    name: "cancel dialog dismissed → stop, never cancel",
    last: {
      toolName: TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM,
      output: { confirmed: false },
    },
    expected: "stop",
  },
  {
    name: "cancel_booking returned → stop (turn is done)",
    last: {
      toolName: TOOL_KEYS.BOOKING.CANCEL,
      output: { id: "booking-1", status: "cancelled" },
    },
    expected: "stop",
  },
]);
