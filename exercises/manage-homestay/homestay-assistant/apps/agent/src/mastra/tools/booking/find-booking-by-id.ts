import { createTool } from "@mastra/core/tools";

import { TOOL_KEYS } from "@repo/constants/tool-keys";
import { TOOL_PURPOSE } from "@repo/constants";
import { addDaysYmd, isAbortError, sanitizeBookingId } from "@repo/utils";
import {
  findBookingByIdInputSchema,
  findBookingByIdOutputSchema,
  type FindBookingAvailability,
  type FindBookingByIdOutput,
} from "@/mastra/schemas/booking";
import { REQUEST_CONTEXT_KEYS } from "@/mastra/middleware/constants";
import { checkRoomAvailability, findBookingById } from "@/mastra/services";
import { isSameModifyStay } from "@/mastra/utils/modify-booking";
import {
  takePinnedBookingId,
  takePinnedModifyRequestedFields,
} from "@/mastra/utils/resolve-pinned-stay";
import {
  serviceContextFromTool,
  throwIfAborted,
} from "@/mastra/utils/abort";

type ModifyStayInput = {
  requestedCheckInDate?: string;
  requestedCheckOutDate?: string;
  requestedGuests?: number;
};

/**
 * Resolves a guest's stated RELATIVE check-out change ("one more night",
 * "extend 2 nights", "shorten by one night", "count one more date") into an
 * absolute YYYY-MM-DD, computed from the booking's own authoritative current
 * check-out — the model never does this date math. Returns:
 *   - the current check-out unchanged when `deltaDays === 0` (explicit no-op —
 *     the stated-change path then reports `stayUnchanged` exactly as before)
 *   - `undefined` when the shifted date would land on or before check-in (an
 *     invalid stay) — the caller then treats it as "no check-out change" and
 *     the edit form opens instead of probing an invalid range
 */
const applyCheckOutDelta = (
  booking: { checkInDate: string; checkOutDate: string },
  deltaDays: number,
): string | undefined => {
  if (deltaDays === 0) return booking.checkOutDate;
  const shifted = addDaysYmd(booking.checkOutDate, deltaDays);
  return shifted > booking.checkInDate ? shifted : undefined;
};

/**
 * Hard reply hint when the MODIFY stated-change availability probe came back
 * unavailable — mirrors `toFindRoomModelOutput`'s BookingUnavailable branch.
 * FindBookingByIdNotice renders the card from the raw result, so the model
 * gets no dates/guests/room facts to leak into chat.
 */
const MODIFY_UNAVAILABLE_REPLY_HINT =
  'BookingUnavailable Generic UI is already rendered and the turn is stopping. Reply with exactly ONE very short sentence in the guest\'s language offering to help with other dates or a larger room. Do NOT repeat the room name, reason, capacity, dates, guests, or any availability value — the card shows them. English example: "I can help you pick other dates or find a larger room."';

/** Hard reply hint when the merged stated change equals the current stay. */
const MODIFY_UNCHANGED_REPLY_HINT =
  "The booking already has those exact dates and guests — no change is needed and the turn is stopping. Reply with exactly ONE short sentence in the guest's language that the booking already has those details. Do NOT open any confirmation, do NOT suggest other edits, and do NOT ask what else to change.";

/** Companion hint when the stated change is free — the app opens the modify confirmation next. */
const MODIFY_AVAILABLE_REPLY_HINT =
  "The app is opening the modify confirmation card (old → new + new total) now. Reply with exactly ONE short review sentence in the guest's language, such as \"Please review and confirm the changes.\" Never restate the room, dates, guests, or total.";

/**
 * MODIFY stated-change path: probe `/bookings/availability` for the merged stay
 * (booking's current stay + whichever requested* fields resolved), excluding
 * this booking from overlap detection, so the flow never needs a separate
 * `check_room_availability` tool call. A no-op merge skips the probe and is
 * reported via `stayUnchanged`. A failed probe returns `undefined` — the step
 * machine still forces `confirm_modify_booking` and `update_booking` is the
 * authoritative gate.
 */
const probeModifyAvailability = async (
  result: FindBookingByIdOutput,
  bookingId: string,
  stated: ModifyStayInput,
  context: Parameters<typeof serviceContextFromTool>[0],
): Promise<{ availability?: FindBookingAvailability; stayUnchanged?: true }> => {
  const booking = result.bookings[0];
  const roomId = result.room?.id ?? booking?.roomId;

  const hasStatedChange =
    Boolean(stated.requestedCheckInDate) ||
    Boolean(stated.requestedCheckOutDate) ||
    stated.requestedGuests !== undefined;

  if (!booking || !roomId || !hasStatedChange) {
    return {};
  }

  const current = {
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    guests: booking.guests,
  };
  const merged = {
    checkInDate: stated.requestedCheckInDate ?? current.checkInDate,
    checkOutDate: stated.requestedCheckOutDate ?? current.checkOutDate,
    guests: stated.requestedGuests ?? current.guests,
  };

  if (isSameModifyStay(current, merged)) {
    return { stayUnchanged: true };
  }

  try {
    const probe = await checkRoomAvailability(
      {
        roomId,
        checkInDate: merged.checkInDate,
        checkOutDate: merged.checkOutDate,
        guests: merged.guests,
        excludeBookingId: bookingId,
      },
      serviceContextFromTool(context),
    );

    return {
      availability: {
        available: probe.available,
        guestsWithinCapacity: probe.guestsWithinCapacity,
        datesAvailable: probe.datesAvailable,
        checkInDate: merged.checkInDate,
        checkOutDate: merged.checkOutDate,
        guests: merged.guests,
      },
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return {};
  }
};

/**
 * Shapes what the LLM sees. The FE renderer (FindBookingByIdNotice) always gets
 * the RAW execute output — this only steers the model's one companion sentence
 * for the MODIFY stated-change outcomes. CANCEL and the edit-form MODIFY path
 * fall through unchanged.
 */
export const toFindBookingByIdModelOutput = (output: FindBookingByIdOutput) => {
  // stayUnchanged / unavailable: the turn is stopping. Slim payload (no
  // bookings/dates/guests to restate) + a hard replyHint, mirroring
  // toFindRoomModelOutput's BookingUnavailable branch. NOT `bookings: []` —
  // that means "no such booking" (not_modifiable / lookup_failed), a different
  // reply.
  if (output.stayUnchanged) {
    return {
      type: "json" as const,
      value: { modifyOutcome: "unchanged", replyHint: MODIFY_UNCHANGED_REPLY_HINT },
    };
  }

  const probe = output.availability;
  if (probe && (probe.available === false || probe.guestsWithinCapacity === false)) {
    return {
      type: "json" as const,
      value: {
        modifyOutcome: "unavailable",
        available: probe.available,
        guestsWithinCapacity: probe.guestsWithinCapacity,
        replyHint: MODIFY_UNAVAILABLE_REPLY_HINT,
      },
    };
  }

  if (probe) {
    return {
      type: "json" as const,
      value: { ...output, replyHint: MODIFY_AVAILABLE_REPLY_HINT },
    };
  }

  return { type: "json" as const, value: output };
};

export const findBookingByIdTool = createTool({
  id: TOOL_KEYS.BOOKING.FIND_BY_ID,
  description: `
    Look up one specific active booking by its ID, for a CANCEL or MODIFY action.
      - Use only when a bookingId is already known — a bookingId: value in the message (including [booking-cancel] / [booking-modify] from BookingCard clicks), or a booking id chosen via a prior find_bookings result. If you only have a room name (no id), call find_bookings instead. For a guest-facing "show/list my bookings" request, call get_bookings instead — never this tool.
      - purpose selects CANCEL vs MODIFY eligibility rules; see the purpose parameter.
      - For MODIFY, also set requestedCheckInDate / requestedCheckOutDate / requestedGuests when the guest's LATEST message states a new value for that field. For a stated RELATIVE extend/shorten ("one more night", "extend 2 nights", "shorten by one night"), pass requestedCheckOutDeltaDays: N (negative to shorten) — do NOT compute a date; the app adds N to the resolved booking's current check-out. When any requested* field is set, this tool probes availability for the merged stay itself (excluding this booking) — the app then forces confirm_modify_booking (available), stops with a BookingUnavailable card (taken / over capacity), or stops with an "already has those details" reply (no-op). Never call check_room_availability for MODIFY.
    `,
  inputSchema: findBookingByIdInputSchema,
  outputSchema: findBookingByIdOutputSchema,
  execute: async (
    {
      bookingId,
      purpose,
      requestedCheckInDate,
      requestedCheckOutDate,
      requestedCheckOutDeltaDays,
      requestedGuests,
    },
    context,
  ) => {
    throwIfAborted(context.abortSignal);

    // Prefer the id pinned by prepareStep from the modify picker / sole match.
    // Both pins below are MODIFY-only — never set for a CANCEL call — but the
    // purpose check makes that a structural guarantee, not just a coincidence
    // of what step-machine happens to set today.
    const isModify = purpose === TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY;
    const pinnedBookingId = isModify
      ? takePinnedBookingId(context.requestContext, REQUEST_CONTEXT_KEYS.PENDING_MODIFY_BOOKING_ID)
      : null;
    // Same idea for the requested-change fields: a picker pick's forced
    // follow-up call shouldn't have to re-derive what the guest already
    // stated before the picker opened — fall back to what was pinned then.
    const pinnedRequestedFields = isModify
      ? takePinnedModifyRequestedFields(context.requestContext, REQUEST_CONTEXT_KEYS.PENDING_MODIFY_REQUESTED_FIELDS)
      : null;

    const id = sanitizeBookingId(pinnedBookingId ?? bookingId);
    const resolvedCheckInDate = isModify ? requestedCheckInDate ?? pinnedRequestedFields?.checkInDate : undefined;
    const statedCheckOutDate = isModify ? requestedCheckOutDate ?? pinnedRequestedFields?.checkOutDate : undefined;
    const resolvedCheckOutDeltaDays = isModify
      ? requestedCheckOutDeltaDays ?? pinnedRequestedFields?.checkOutDeltaDays
      : undefined;
    const resolvedGuests = isModify ? requestedGuests ?? pinnedRequestedFields?.guests : undefined;

    const result = await findBookingById(id, serviceContextFromTool(context), purpose);

    // A stated RELATIVE check-out change ("one more night", "extend 2 nights",
    // "shorten by one night", "count one more date") is resolved to an absolute
    // date HERE, against the booking's own authoritative current check-out —
    // the model never does this arithmetic.
    //
    // When a delta is present it is AUTHORITATIVE, even if the model also sent a
    // requestedCheckOutDate: observed models over-helpfully compute the date
    // themselves alongside the delta, and that self-computed value is exactly
    // what this field exists to stop trusting (a wrong one reintroduces the
    // "already has that checkout" no-op bug). A model-supplied absolute date is
    // used only when there is no usable delta. A delta that would land on/before
    // check-in is invalid → dropped, then the absolute (if any) is tried, else
    // the edit form opens instead of probing an invalid range.
    const currentBooking =
      result.bookings.length === 1 ? result.bookings[0] : undefined;
    const deltaCheckOutDate =
      resolvedCheckOutDeltaDays !== undefined && currentBooking
        ? applyCheckOutDelta(currentBooking, resolvedCheckOutDeltaDays)
        : undefined;
    const resolvedCheckOutDate = deltaCheckOutDate ?? statedCheckOutDate;

    const echoed = {
      ...result,
      ...(resolvedCheckInDate ? { requestedCheckInDate: resolvedCheckInDate } : {}),
      ...(resolvedCheckOutDate ? { requestedCheckOutDate: resolvedCheckOutDate } : {}),
      ...(resolvedGuests !== undefined ? { requestedGuests: resolvedGuests } : {}),
    };

    if (!isModify || result.bookings.length !== 1) {
      return echoed;
    }

    const { availability, stayUnchanged } = await probeModifyAvailability(
      echoed,
      id,
      {
        requestedCheckInDate: resolvedCheckInDate,
        requestedCheckOutDate: resolvedCheckOutDate,
        requestedGuests: resolvedGuests,
      },
      context,
    );

    return {
      ...echoed,
      ...(availability ? { availability } : {}),
      ...(stayUnchanged ? { stayUnchanged: true as const } : {}),
    };
  },
  toModelOutput: toFindBookingByIdModelOutput,
});
