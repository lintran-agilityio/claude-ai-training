import { TOOL_KEYS } from "@repo/constants";

import { stepContractEval } from "../../support/step-contract";

/**
 * `create_booking` — the CREATE terminal and its HITL gate, no LLM.
 *
 * `create_booking` is a mutation: the step machine only forces it once
 * `confirm_booking` (a frontend HITL tool, stubbed in `support/client-tools.ts`)
 * returns `confirmed: true`. A `confirmed: false` stops the turn, and once
 * `create_booking` itself returns the turn is done.
 *
 * The step BEFORE this — `find_room(book_resolve)` (which probes availability
 * itself) → `confirm_booking` — lives in `find-room.eval.ts`. There is no
 * `check_room_availability` tool. `homestay-assistant/behavioral/create-booking.eval.ts`
 * proves a real model never reaches `create_booking` in the same turn as the
 * confirm gate.
 */
stepContractEval("create_booking — confirm gate and terminal stop", [
  {
    name: "guest confirmed the draft → force the terminal create_booking",
    last: {
      toolName: TOOL_KEYS.ACTION.CONFIRM_BOOKING,
      output: { confirmed: true },
    },
    expected: `force:${TOOL_KEYS.BOOKING.CREATE_BOOKING}`,
  },
  {
    name: "guest dismissed the confirm dialog → stop, never mutate",
    last: {
      toolName: TOOL_KEYS.ACTION.CONFIRM_BOOKING,
      output: { confirmed: false },
    },
    expected: "stop",
  },
  {
    name: "create_booking returned → stop (turn is done)",
    last: {
      toolName: TOOL_KEYS.BOOKING.CREATE_BOOKING,
      output: { id: "booking-new", status: "confirmed" },
    },
    expected: "stop",
  },
]);
