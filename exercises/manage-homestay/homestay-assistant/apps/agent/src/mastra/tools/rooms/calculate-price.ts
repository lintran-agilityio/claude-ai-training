import { createTool } from "@mastra/core/tools";

import { TOOL_KEYS } from "@repo/constants/tool-keys";
import { getRoom } from "@/mastra/services";
import {
  calculatePriceInputSchema,
  calculatePriceOutputSchema,
  type CalculatePriceOutput,
} from "@/mastra/schemas/rooms";
import {
  computePriceBreakdown,
  serviceContextFromTool,
  throwIfAborted,
} from "@/mastra/utils";

/** The UI card shows the full breakdown; the model only gets the total-free hint. */
export const toCalculatePriceModelOutput = (output: CalculatePriceOutput) => ({
  type: "json" as const,
  value: {
    roomId: output.roomId,
    nights: output.nights,
    replyHint:
      "The price breakdown card is already visible. Reply with at most ONE short sentence in the guest's language; do not repeat amounts.",
  },
});

export const calculatePriceTool = createTool({
  id: TOOL_KEYS.GET.CALCULATE_PRICE,

  description: `
    Calculate the total price of a stay BEFORE the guest confirms a booking:
    nights x room rate + extra-guest surcharge + cleaning fee + tax.

    Use when the guest asks for the price / total / quote of a specific room
    and roomId, checkInDate, checkOutDate and guests are all known.

    In the BOOK flow call it with purpose "booking" right before confirm_booking.

    Read-only: never creates or changes a booking. Never invent missing dates
    or guest count — ask the guest instead.
  `.trim(),

  inputSchema: calculatePriceInputSchema,
  outputSchema: calculatePriceOutputSchema,

  execute: async (input, context) => {
    throwIfAborted(context.abortSignal);

    const room = await getRoom(input.roomId, serviceContextFromTool(context));

    const breakdown = computePriceBreakdown({
      pricePerNight: room.pricePerNight,
      capacity: room.capacity,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      guests: input.guests,
    });

    return {
      roomId: room.id,
      roomName: room.name,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      guests: input.guests,
      pricePerNight: room.pricePerNight,
      currency: "VND" as const,
      ...breakdown,
    };
  },

  toModelOutput: toCalculatePriceModelOutput,
});
