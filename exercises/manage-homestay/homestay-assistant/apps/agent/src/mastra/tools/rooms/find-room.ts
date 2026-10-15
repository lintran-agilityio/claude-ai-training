import { createTool } from "@mastra/core/tools";

import { DEFAULT_SORT_LIMIT, TOOL_KEYS, TOOL_PURPOSE } from "@repo/constants";
import { isAbortError, resolveStayWindow, type StayWindow } from "@repo/utils";
import {
  findRoomInputSchema,
  findRoomOutputSchema,
  type FindRoomAvailability,
} from "@/mastra/schemas/rooms";
import { checkRoomAvailability, findRooms } from "@/mastra/services";
import { toFindRoomModelOutput } from "@/mastra/utils";
import {
  readBookingFormStayHint,
  readCheckInCueOverride,
  readRankingCueOverride,
  readRelativeCheckInOverride,
} from "@/mastra/utils/book-form-prefill";
import {
  serviceContextFromTool,
  throwIfAborted,
} from "@/mastra/utils/abort";

const NAME_ONLY_PURPOSES = new Set<string | undefined>([
  TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
  TOOL_PURPOSE.FIND_ROOM.RESOLVE,
]);

type FindRoomProbeInput = { date?: string; guests?: number; nights?: number };
type FindRoomToolContext = Parameters<typeof serviceContextFromTool>[0];

type ProbeStayHint = ReturnType<typeof readBookingFormStayHint>;

/**
 * Guest count already known for the CREATE probe — this call's stated
 * `guests`, or an earlier search's (`hint`, `PENDING_BOOKING_FORM_STAY_HINT`).
 * Independent of whether a check-in date is known: guest capacity is a static
 * room fact, so it never needs a date to evaluate.
 */
const resolveProbeGuests = (
  input: FindRoomProbeInput,
  hint: ProbeStayHint,
): number | undefined => input.guests ?? hint?.guests;

/**
 * Resolve the CREATE-flow stay window, or `null` when the guest has not
 * committed to a real check-in date.
 *
 * Sources, in order: the value echoed on this call (already normalized to an
 * absolute date by `normalizeFindRoomInput`), then an earlier dated
 * `find_room` in this conversation (`hint`, `PENDING_BOOKING_FORM_STAY_HINT`,
 * restashed every step by `BookingFormPrefillProcessor`). A stated stay
 * LENGTH alone ("4 nights") is NOT enough — only a real check-in date is;
 * `resolveStayWindow` returns `null` without one, and `nights` only ever
 * refines the window's length once a date IS known — so a "today / 1 guest"
 * placeholder never drives routing.
 */
const resolveProbeStay = (
  input: FindRoomProbeInput,
  hint: ProbeStayHint,
): StayWindow | null =>
  resolveStayWindow({
    checkInDate: (input.date?.trim() || undefined) ?? hint?.checkInDate,
    nights: input.nights ?? hint?.nights,
  });

/**
 * BOOK CREATE flow: probe availability for a resolved named room so the flow
 * never needs a separate `check_room_availability` tool call.
 *
 * Two independent checks, since guest capacity never needs a date to know:
 *   - guests known but no check-in date yet → a deterministic over-capacity
 *     verdict against `room.capacity` (no API call, no invented date) when the
 *     party is too big, else `undefined` (Booking Form opens and runs its own
 *     check once dates are known).
 *   - guests known AND a real check-in date resolved → the actual
 *     `/bookings/availability` probe, carrying `datesAvailable` alongside
 *     `guestsWithinCapacity` so a guest already over capacity also learns
 *     whether the dates they asked about are free.
 *
 * A missing guest count or a failed probe returns `undefined` — the platform
 * opens the Booking Form or forces `confirm_booking` anyway, and
 * `POST /bookings` stays the authoritative gate.
 */
const probeBookResolveAvailability = async (
  room: { id: string; capacity: number },
  input: FindRoomProbeInput,
  context: FindRoomToolContext,
): Promise<FindRoomAvailability | undefined> => {
  const hint = readBookingFormStayHint(context.requestContext);
  const guests = resolveProbeGuests(input, hint);
  if (!guests) {
    return undefined;
  }

  const window = resolveProbeStay(input, hint);

  if (!window) {
    return guests > room.capacity
      ? { available: true, guestsWithinCapacity: false, guests }
      : undefined;
  }

  try {
    const result = await checkRoomAvailability(
      {
        roomId: room.id,
        checkInDate: window.checkInDate,
        checkOutDate: window.checkOutDate,
        guests,
      },
      serviceContextFromTool(context),
    );

    return {
      available: result.available,
      guestsWithinCapacity: result.guestsWithinCapacity,
      datesAvailable: result.datesAvailable,
      checkInDate: window.checkInDate,
      checkOutDate: window.checkOutDate,
      guests,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return undefined;
  }
};

export const findRoomTool = createTool({
  id: TOOL_KEYS.GET.FIND_ROOM,
  description: `
    Find rooms matching the guest's request.

    Use when the guest:
    - searches for rooms
    - asks which rooms are available
    - filters rooms by name, date, guests, or room level
    - asks for the cheapest / most affordable, most expensive, or most-amenity rooms (sortBy), optionally with a price ceiling (maxPrice)
    - requests a booking for a specific named room

    Purpose:
    - search: find/show/filter rooms for the guest
    - book_resolve: resolve a specific named room for a booking flow
    - recommend: find suitable rooms when no specific room was requested
  `,
  strict: true,
  inputSchema: findRoomInputSchema,
  outputSchema: findRoomOutputSchema,
  execute: async (rawInput, context) => {
    throwIfAborted(context.abortSignal);
    // inputSchema already runs normalizeFindRoomInput
    // A model-resolved `date` can already look valid (YYYY-MM-DD) while being
    // wrong — models cannot be trusted to compute today/weekend arithmetic
    // reliably (see PENDING_RELATIVE_CHECKIN). When the guest's latest message
    // stated a relative cue, that deterministic value wins over whatever the
    // model attached.
    const relativeOverride = readRelativeCheckInOverride(
      context.requestContext,
    );
    let input = relativeOverride
      ? { ...rawInput, date: relativeOverride }
      : rawInput;

    if (NAME_ONLY_PURPOSES.has(input.purpose)) {
      // date/guests on `input` here are stated hints only (see
      // normalizeFindRoomInput) — never let them filter a named-room lookup.
      // They are echoed back for the BOOK step machine to route on, and (for
      // book_resolve + exactly one match) drive the availability probe below
      // that replaces the CREATE-flow check_room_availability call.
      const result = await findRooms(
        { purpose: input.purpose, name: input.name },
        serviceContextFromTool(context),
      );

      const echoed = {
        ...result,
        date: input.date,
        guests: input.guests,
        nights: input.nights,
        // Stamp whether this `date` is the guest's or the prompt's
        // default-to-today — only meaningful while the flag is fresh, so it is
        // recorded here rather than re-derived from history a turn later.
        ...(input.date
          ? { dateStated: readCheckInCueOverride(context.requestContext) }
          : {}),
      };

      if (
        input.purpose === TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE &&
        result.rooms.length === 1 &&
        result.rooms[0]?.id
      ) {
        const availability = await probeBookResolveAvailability(
          result.rooms[0],
          input,
          context,
        );
        return availability ? { ...echoed, availability } : echoed;
      }

      return echoed;
    }

    // gpt-4o-mini can attach sortBy/maxPrice to a plain browse request ("show
    // available rooms") despite the prompt saying not to — find_room's
    // `strict: true` has no effect on this OpenAI tool-calling path (Mastra
    // only honors strict/structured-schema mode for the separate
    // responseFormat feature, never for function-tool parameters), so nothing
    // constrains the model's output here. Drop an uncorroborated sortBy/
    // maxPrice — no ranking/price wording anywhere in the guest's own latest
    // message (see PENDING_RANKING_CUE) — before it reaches the rooms API,
    // and undo normalizeFindRoomInput's DEFAULT_SORT_LIMIT backstop with it
    // (that backstop only exists to cap an uncounted ranking request).
    if (
      (input.sortBy || input.maxPrice) &&
      !readRankingCueOverride(context.requestContext)
    ) {
      input = {
        ...input,
        sortBy: undefined,
        maxPrice: undefined,
        limit: input.limit === DEFAULT_SORT_LIMIT ? undefined : input.limit,
      };
    }

    const result = await findRooms(input, serviceContextFromTool(context));
    // The rooms API applies `sortBy`/`maxPrice` server-side (RoomsRepository)
    // and `findRooms` forwards `rooms` unchanged, already in final ranked
    // order — slicing here is a correct top-N, not a truncation of arbitrary
    // DB order. `limit` trims to the top N matches when the
    // guest asked for a specific count ("find me 3 rooms", "the 3 cheapest
    // rooms"), or normalizeFindRoomInput backstopped an uncounted ranking
    // request to the default of 5. Applied here so both the chat cards
    // (FindRoomNotice reads the raw result) and the model's compare
    // candidates see the same trimmed set.
    // Same date-provenance stamp as the book_resolve branch above, and the one
    // that actually matters for the reported bug: it is a SEARCH result the
    // Date-continuity scan reads back, and an undated "show available rooms"
    // carries the prompt's default-to-today in `date`.
    const stamped = input.date
      ? {
          ...result,
          dateStated: readCheckInCueOverride(context.requestContext),
        }
      : result;

    return input.limit && input.limit < stamped.rooms.length
      ? { ...stamped, rooms: stamped.rooms.slice(0, input.limit) }
      : stamped;
  },
  toModelOutput: toFindRoomModelOutput,
});
