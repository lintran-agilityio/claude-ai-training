import { createTool } from "@mastra/core/tools";

import { TOOL_KEYS } from "@repo/constants/tool-keys";
import { sanitizeBookingId } from "@repo/utils";
import { cancelBookingInputSchema } from "@repo/schemas";
import { bookingMutationOutputSchema } from "@/mastra/schemas/booking";
import { assertOwnedActiveBooking, cancelBooking } from "@/mastra/services";
import { REQUEST_CONTEXT_KEYS } from "@/mastra/middleware/constants";
import { HITL_REPLY_SUCCESS } from "@/mastra/constants";
import {
  commitIfNotAborted,
  runBookingMutation,
  serviceContextFromTool,
  throwIfAborted,
  takePinnedBookingId,
  toCancelBookingModelOutput,
} from "@/mastra/utils";

export const cancelBookingTool = createTool({
  id: TOOL_KEYS.BOOKING.CANCEL,
  description: `
    Cancel an active booking by ID.
    Only the signed-in owner can cancel their own active, non-past booking.
    ${HITL_REPLY_SUCCESS.CANCEL}
    `,
  inputSchema: cancelBookingInputSchema,
  outputSchema: bookingMutationOutputSchema,
  execute: async ({ bookingId }, context) => {
    const { requestContext, abortSignal } = context;
    throwIfAborted(abortSignal);

    const serviceContext = serviceContextFromTool(context);

    // Prefer the id pinned by prepareStep from the cancel dialog — the model
    // often reuses a stale booking id when toolChoice forces this call.
    const pinnedBookingId = takePinnedBookingId(
      requestContext,
      REQUEST_CONTEXT_KEYS.PENDING_CANCEL_BOOKING_ID,
    );

    const id = sanitizeBookingId(pinnedBookingId ?? bookingId);

    return runBookingMutation(async () => {
      await assertOwnedActiveBooking(id, serviceContext);

      return commitIfNotAborted(abortSignal, () =>
        cancelBooking(id, serviceContext),
      );
    });
  },
  toModelOutput: toCancelBookingModelOutput,
});
