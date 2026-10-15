import { TOOL_KEYS } from "@repo/constants";

import { stepContractEval } from "../../support/step-contract";

/**
 * `update_booking` — the MODIFY terminal and every HITL gate in front of it,
 * no LLM.
 *
 * The MODIFY flow has three frontend HITL tools (stubbed in
 * `support/client-tools.ts`) the step machine reacts to:
 *   - `show_modify_dialog_select` confirmed → re-force `find_booking_by_id`
 *     for the chosen stay
 *   - `edit_modify_booking` submitted → force `confirm_modify_booking` (the
 *     form ran its own client-side availability check; there is no
 *     `check_room_availability` tool)
 *   - `confirm_modify_booking` confirmed → force the terminal `update_booking`
 * Any `confirmed: false` stops the turn; once `update_booking` returns the
 * turn is done.
 *
 * The `find_booking_by_id(modify)` junction (edit form vs confirm, and the
 * stated-change availability outcomes) is in `find-booking-by-id.eval.ts`.
 */
stepContractEval("update_booking — MODIFY HITL gates and terminal stop", [
  {
    name: "modify picker selection confirmed → force find_booking_by_id for the chosen stay",
    last: {
      toolName: TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
      output: { confirmed: true, bookingId: "booking-1" },
    },
    expected: `force:${TOOL_KEYS.BOOKING.FIND_BY_ID}`,
  },
  {
    name: "edit form submitted → force confirm_modify_booking (form checked availability itself)",
    last: {
      toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
      output: { confirmed: true },
    },
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
  },
  {
    name: "edit form dismissed → stop",
    last: {
      toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
      output: { confirmed: false },
    },
    expected: "stop",
  },
  {
    name: "guest confirmed the change → force the terminal update_booking",
    last: {
      toolName: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
      output: { confirmed: true },
    },
    expected: `force:${TOOL_KEYS.BOOKING.UPDATE_BOOKING}`,
  },
  {
    name: "guest dismissed the modify confirm dialog → stop",
    last: {
      toolName: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
      output: { confirmed: false },
    },
    expected: "stop",
  },
  {
    name: "update_booking returned → stop (turn is done)",
    last: {
      toolName: TOOL_KEYS.BOOKING.UPDATE_BOOKING,
      output: { id: "booking-1", status: "confirmed" },
    },
    expected: "stop",
  },
]);
