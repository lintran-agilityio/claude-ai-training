import { createTool } from "@mastra/core/tools";

import { TOOL_KEYS } from "@repo/constants";
import { findBookingsInputSchema } from "@repo/schemas";
import { bookingResolutionSchema } from "@/mastra/schemas/booking";
import { findBookings } from "@/mastra/services";
import {
  buildFindBookingsReplyHint,
  serviceContextFromTool,
  throwIfAborted,
} from "@/mastra/utils";
import { applyFindBookingsDateGate } from "@/mastra/utils/sanitize-find-bookings";

export const findBookingsTool = createTool({
  id: TOOL_KEYS.BOOKING.FIND,
  description: `
    Resolve the signed-in user's active booking target for CANCEL/MODIFY, optionally by room name and/or a date range — never used for a guest-facing show/list bookings request (that's get_bookings).
    User identity always comes from the server session — never pass or invent a userId.
      - purpose: ALWAYS pass "cancel", "modify", or "change_room" — it gates dateFrom/dateTo below.
      - roomName is an optional case-insensitive partial match.
      - dateFrom/dateTo (both YYYY-MM-DD, half-open range) are honored ONLY when purpose is "cancel" — pass both together when the guest's CANCEL message states an explicit calendar date or weekend cue (e.g. "this weekend", "next weekend", "on Aug 15"), so a booking whose stay does NOT overlap that range is excluded instead of being wrongly resolved. For "modify"/"change_room" these are always dropped server-side even if set — never pass them there, including for a relative extend/shorten amount ("one more night", "one more day", "extend 2 nights"), which is a requested change amount, not a date cue (it belongs on find_booking_by_id's requestedCheckOutDeltaDays instead). Omit both when no explicit calendar date/weekend cue is stated.
      - not_found means there are no matching active bookings (including: none overlap the stated date/weekend when dateFrom/dateTo were passed) — do not fall back to an unrelated booking.
      - resolved contains the only matching booking.
      - ambiguous contains every matching booking; never choose one for the guest.
    `,
  inputSchema: findBookingsInputSchema,
  outputSchema: bookingResolutionSchema,
  execute: async (params, context) => {
    throwIfAborted(context.abortSignal);
    return findBookings(
      applyFindBookingsDateGate(params),
      serviceContextFromTool(context),
    );
  },
  toModelOutput: (output) => ({
    type: "json" as const,
    value: {
      ...output,
      replyHint: buildFindBookingsReplyHint(
        output.status,
        output.status === "resolved" ? 1 : output.bookings.length,
      ),
    },
  }),
});
