import { createTool } from "@mastra/core/tools";
import { TOOL_KEYS } from "@repo/constants";
import {
  cancelBookingByRoomSchema,
  confirmBookingSchema,
  confirmModifyBookingSchema,
  editModifyBookingSchema,
  modifyBookingByRoomSchema,
} from "@repo/schemas";

/**
 * Stand-ins for the frontend-rendered HITL tools (`confirm_booking`,
 * `confirm_modify_booking`, `edit_modify_booking`,
 * `show_cancel_dialog_confirm`, `show_modify_dialog_select`).
 *
 * These are NOT registered on `homestayAssistant.tools` at all (see
 * `src/mastra/agents/homestay-assistant.ts`) — in production they only
 * exist because CopilotKit's `MastraAgent.getLocalAgents()` injects them as
 * client tools from the frontend's `useHumanInTheLoop`/`useRenderTool`
 * registrations. Calling the agent directly (as this suite does, per the
 * brief's "without going through CopilotKit or AG-UI") means the model has
 * no such tool to call unless we supply an equivalent — without it, the
 * booking step-machine's forced transition to e.g. `confirm_booking` has
 * nothing to call, and the model falls through to whatever tool IS
 * registered (often the real mutation tool itself), which would make every
 * "never mutates before confirmation" eval spuriously fail — not because
 * production is broken, but because the harness omitted a tool AG-UI
 * always provides.
 *
 * Each stub has no `execute` (deliberately — `execute` is optional on
 * `createTool`, see `@mastra/core/tools`). A client tool with no `execute`
 * is exactly what a real frontend-rendered tool looks like from the
 * model's side: the call is emitted, the turn ends there awaiting an
 * out-of-band result, and no further steps run — which is precisely the
 * "stop and wait for a real HITL click" behavior this suite asserts.
 * Schemas are the exact shared ones the frontend's `useHumanInTheLoop`
 * hooks use (`@repo/schemas`), so argument shape stays real even though
 * resolution is not.
 */
export const HITL_CLIENT_TOOLS = {
  [TOOL_KEYS.ACTION.CONFIRM_BOOKING]: createTool({
    id: TOOL_KEYS.ACTION.CONFIRM_BOOKING,
    description:
      "Frontend HITL — confirm a new booking (availability was checked in find_room(book_resolve) / the Booking Form).",
    inputSchema: confirmBookingSchema,
  }),
  [TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING]: createTool({
    id: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
    description:
      "Frontend HITL — confirm a booking modification (availability was checked in find_booking_by_id / the edit form).",
    inputSchema: confirmModifyBookingSchema,
  }),
  [TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING]: createTool({
    id: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
    description:
      "Frontend HITL — edit form with room detail + current dates/guests; runs its own client-side availability check.",
    inputSchema: editModifyBookingSchema,
  }),
  [TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM]: createTool({
    id: TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM,
    description:
      "Frontend HITL — open cancel confirm dialog after a booking is resolved.",
    inputSchema: cancelBookingByRoomSchema,
  }),
  [TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT]: createTool({
    id: TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
    description:
      "Frontend HITL — multi-booking picker when modify has no bookingId and multiple bookings match.",
    inputSchema: modifyBookingByRoomSchema,
  }),
};

/** How `buildResolvingHitlTools` answers every HITL card in the turn. */
export type HitlResolution = "confirm" | "decline";

/**
 * The same 5 HITL tools as {@link HITL_CLIENT_TOOLS}, but each one carries an
 * `execute` that resolves the call IN-TURN with the exact `…Result` payload the
 * real frontend hook returns on a click (`confirmed: true` + the stay, or
 * `{ confirmed: false }`).
 *
 * Why not just add `execute` to `HITL_CLIENT_TOOLS`: Mastra strips it from
 * anything passed as a *client* tool (`listClientTools` does
 * `const { execute, ...rest } = tool`), so a client-tool stub can only ever
 * emit-and-stop — which is what the "never mutates before the gate" evals want.
 * A tool passed via `generate({ toolsets })` keeps its `execute`
 * (`listToolsets` converts the whole object), so these drive the WHOLE booking
 * chain — `find_room → confirm_booking → create_booking` — inside a single
 * `agent.generate()` call, standing in for "the guest clicked confirm the
 * instant the card appeared". `support/agent-harness.ts` swaps these in when
 * `AgentTurnOptions.hitlResolution` is set.
 *
 * The step machine's `CONFIRMATION_FOLLOW_UPS` + `parseConfirmedStay` pinning
 * (`src/mastra/utils/step-machine.ts`) then does the rest exactly as in
 * production, so the terminal mutation runs against the fixture API with the
 * guest-confirmed stay.
 */
export const buildResolvingHitlTools = (resolution: HitlResolution) => {
  const confirmed = resolution === "confirm";
  const declined = { confirmed: false as const };

  return {
    [TOOL_KEYS.ACTION.CONFIRM_BOOKING]: createTool({
      id: TOOL_KEYS.ACTION.CONFIRM_BOOKING,
      description: "Eval HITL stand-in — resolves confirm_booking in-turn.",
      inputSchema: confirmBookingSchema,
      execute: async ({ roomId, checkInDate, checkOutDate, guests }) =>
        confirmed
          ? { confirmed: true, roomId, checkInDate, checkOutDate, guests }
          : declined,
    }),
    [TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING]: createTool({
      id: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
      description:
        "Eval HITL stand-in — resolves confirm_modify_booking in-turn.",
      inputSchema: confirmModifyBookingSchema,
      execute: async ({ bookingId, checkInDate, checkOutDate, guests }) =>
        confirmed
          ? { confirmed: true, bookingId, checkInDate, checkOutDate, guests }
          : declined,
    }),
    [TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING]: createTool({
      id: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
      description:
        "Eval HITL stand-in — 'confirms' the modify form with the stay it was opened with.",
      inputSchema: editModifyBookingSchema,
      execute: async ({ bookingId, room, checkInDate, checkOutDate, guests }) =>
        confirmed
          ? {
              confirmed: true,
              bookingId,
              roomId: room?.id,
              checkInDate,
              checkOutDate,
              guests,
            }
          : declined,
    }),
    [TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM]: createTool({
      id: TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM,
      description:
        "Eval HITL stand-in — resolves the cancel confirm dialog in-turn (picks the first row).",
      inputSchema: cancelBookingByRoomSchema,
      execute: async ({ bookings }) => {
        const first = bookings?.[0];
        return confirmed && first
          ? {
              confirmed: true,
              bookingId: first.bookingId,
              roomName: first.roomName,
            }
          : declined;
      },
    }),
    [TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT]: createTool({
      id: TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
      description:
        "Eval HITL stand-in — picks the first matching booking in-turn.",
      inputSchema: modifyBookingByRoomSchema,
      execute: async ({ bookingIds, bookings }) => {
        const bookingId = bookingIds?.[0] ?? bookings?.[0]?.bookingId;
        return confirmed && bookingId
          ? { confirmed: true, bookingId, roomName: bookings?.[0]?.roomName ?? "" }
          : declined;
      },
    }),
  };
};
