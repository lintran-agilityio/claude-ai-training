// Libs
import { createTool } from "@mastra/core/tools";

import { TOOL_KEYS } from "@repo/constants/tool-keys";
import { createBookingInputSchema } from "@repo/schemas";
import { bookingMutationOutputSchema } from "@/mastra/schemas/booking";
import { createBooking } from "@/mastra/services";
import { HITL_REPLY_SUCCESS } from "@/mastra/constants";
import {
  resolveCreateBookingInput,
  buildCreateBookingCommand,
} from "@/mastra/utils/booking";
import {
  commitIfNotAborted,
  runBookingMutation,
  serviceContextFromTool,
  throwIfAborted,
  toCreateBookingModelOutput,
} from "@/mastra/utils";

export const createBookingTool = createTool({
  id: TOOL_KEYS.BOOKING.CREATE_BOOKING,
  description: `
    Create a confirmed booking for a room and stay after confirm_booking returns confirmed: true.
    The booking is created for the signed-in user.
      - ${HITL_REPLY_SUCCESS.CREATE}
      - The same confirm HITL card updates in place to success/failed — do not expect a separate success card.
  `,
  inputSchema: createBookingInputSchema,
  outputSchema: bookingMutationOutputSchema,
  execute: async (input, context) => {
    throwIfAborted(context.abortSignal);

    const resolvedInput = resolveCreateBookingInput(
      input,
      context.requestContext,
    );

    const command = buildCreateBookingCommand(resolvedInput);

    return runBookingMutation(() =>
      commitIfNotAborted(context.abortSignal, () =>
        createBooking(command, serviceContextFromTool(context)),
      ),
    );
  },
  toModelOutput: toCreateBookingModelOutput,
});
