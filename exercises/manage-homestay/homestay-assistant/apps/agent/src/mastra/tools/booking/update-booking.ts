import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { TOOL_KEYS } from "@repo/constants/tool-keys";
import { sanitizeBookingId } from "@repo/utils";
import { bookingMutationOutputSchema } from "@/mastra/schemas/booking";
import { assertOwnedModifiableBooking, updateBooking } from "@/mastra/services";
import { REQUEST_CONTEXT_KEYS } from "@/mastra/middleware/constants";
import { HITL_REPLY_SUCCESS } from "@/mastra/constants";
import {
  commitIfNotAborted,
  runBookingMutation,
  serviceContextFromTool,
  takePinnedStay,
  throwIfAborted,
  toUpdateBookingModelOutput
} from "@/mastra/utils";

/**
 * Permissive on purpose. `update_booking` is force-called by the step machine
 * right after `confirm_modify_booking` returns `confirmed: true`, and the
 * guest-confirmed stay is pinned in request context (`PENDING_UPDATE_STAY`) —
 * that pin, not these args, is the authoritative source. Requiring the fields
 * here only lets a sparse/mistyped forced call (the model often has no readable
 * `confirm_modify_booking` result to copy from — `respond()` does not append a
 * `role:"tool"` message) fail AI-SDK input validation *before* `execute` runs,
 * which surfaces as a silent `tool-error` the AG-UI bridge never forwards, so
 * the HITL card is stuck on "Updating booking…" forever. Keep the descriptions
 * so the model still tries to pass them; recover from the pin when it doesn't.
 */
const updateBookingToolInputSchema = z.object({
  bookingId: z
    .string()
    .optional()
    .describe(
      "Booking ID from the confirm_modify_booking result. The app also carries the guest-confirmed stay internally, so a missing value is recovered — but pass it whenever you have it.",
    ),
  checkInDate: z
    .string()
    .optional()
    .describe("Updated check-in (YYYY-MM-DD) from the confirm_modify_booking result."),
  checkOutDate: z
    .string()
    .optional()
    .describe("Updated check-out (YYYY-MM-DD) from the confirm_modify_booking result."),
  guests: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Updated guest count from the confirm_modify_booking result."),
});

const coerceGuests = (value: number | string | undefined): number | undefined => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

export const updateBookingTool = createTool({
  id: TOOL_KEYS.BOOKING.UPDATE_BOOKING,
  description: `
    Update an existing booking's dates/guests by bookingId after confirm_modify_booking returns confirmed: true — only the signed-in owner's active bookings whose check-in has not started yet can be updated (throws once check-in is today or past). roomId is not updatable.
      - Use bookingId, checkInDate, checkOutDate, and guests from the confirm_modify_booking result.
      - ${HITL_REPLY_SUCCESS.UPDATE}
      - Do NOT call get_bookings — the same HITL card updates to success/failed and refreshes the bookings list automatically.
    `,
  inputSchema: updateBookingToolInputSchema,
  outputSchema: bookingMutationOutputSchema,
  execute: async (
    { bookingId, checkInDate, checkOutDate, guests },
    context,
  ) => {
    const { requestContext, abortSignal } = context;
    throwIfAborted(abortSignal);

    const serviceContext = serviceContextFromTool(context);

    // Prefer the HITL confirm result pinned by prepareStep — the model often
    // reuses stale draft/original dates (or omits fields entirely) when
    // toolChoice forces this call.
    const pinned = takePinnedStay(
      requestContext,
      REQUEST_CONTEXT_KEYS.PENDING_UPDATE_STAY,
    );
    const resolvedBookingId = sanitizeBookingId(
      pinned?.bookingId ?? bookingId ?? "",
    );
    const resolvedCheckIn = pinned?.checkInDate ?? checkInDate;
    const resolvedCheckOut = pinned?.checkOutDate ?? checkOutDate;
    const resolvedGuests = pinned?.guests ?? coerceGuests(guests);

    // Neither the pin nor the model gave us a usable stay — return a failure
    // the HITL card can render (FAILED + retry) instead of throwing, which
    // would strand the card on "Updating booking…".
    if (
      !resolvedBookingId ||
      !resolvedCheckIn ||
      !resolvedCheckOut ||
      typeof resolvedGuests !== "number" ||
      !Number.isInteger(resolvedGuests) ||
      resolvedGuests <= 0
    ) {
      console.warn(
        "[update_booking] Could not resolve the confirmed stay (pin missing and model args incomplete)",
        {
          hasPin: Boolean(pinned),
          bookingId: resolvedBookingId || null,
          checkInDate: resolvedCheckIn ?? null,
          checkOutDate: resolvedCheckOut ?? null,
          guests: resolvedGuests ?? null,
        },
      );
      return {
        message:
          "We lost the confirmed change details. Please try modifying the booking again.",
      };
    }

    return runBookingMutation(async () => {
      await assertOwnedModifiableBooking(resolvedBookingId, serviceContext);

      return commitIfNotAborted(abortSignal, () =>
        updateBooking(
          {
            bookingId: resolvedBookingId,
            checkInDate: resolvedCheckIn,
            checkOutDate: resolvedCheckOut,
            guests: resolvedGuests,
          },
          serviceContext,
        ),
      );
    });
  },
  toModelOutput: toUpdateBookingModelOutput,
});
