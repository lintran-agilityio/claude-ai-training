import { TOOL_KEYS, TOOL_PURPOSE } from "@repo/constants";

import { stepContractEval } from "../../support/step-contract";

/**
 * `find_room` — every result shape → step-machine transition outcome, no LLM.
 *
 * `find_room` is the only discovery tool the booking step machine reacts to,
 * and only through the `book_resolve` purpose with exactly one match. This file
 * owns the whole `find_room` junction:
 *   - search / recommend / internal resolve, or book_resolve with 0 or 2+
 *     matches → no forced step (the model responds freely)
 *   - book_resolve · 1 match → the platform forces `confirm_booking` (stay fully
 *     known + probe free), stops (probe taken / over capacity), or forces
 *     `get_room_by_id` (Booking Form, stay not fully known) — never `check_room_availability`
 *
 * CREATE no longer routes through `check_room_availability` — `findRoomTool`
 * probes `/bookings/availability` itself and attaches the verdict as
 * `output.availability`; this file's CREATE-fork cases assert the routing off
 * that. `homestay-assistant/behavioral/find-room.eval.ts` proves a real model
 * reaches these same outcomes end-to-end.
 */
stepContractEval("find_room — discovery never forces a booking step", [
  {
    name: "search → no forced step",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.SEARCH },
      output: {
        rooms: [{ id: "room-riverside-twin" }, { id: "room-bamboo-family-suite" }],
        purpose: TOOL_PURPOSE.FIND_ROOM.SEARCH,
      },
    },
    expected: "pass",
  },
  {
    name: "recommend → no forced step",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.RECOMMEND },
      output: {
        rooms: [{ id: "room-riverside-twin" }],
        purpose: TOOL_PURPOSE.FIND_ROOM.RECOMMEND,
      },
    },
    expected: "pass",
  },
  {
    name: "resolve (internal name → id lookup) → no forced step",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.RESOLVE },
      output: {
        rooms: [{ id: "room-riverside-twin" }],
        purpose: TOOL_PURPOSE.FIND_ROOM.RESOLVE,
      },
    },
    expected: "pass",
  },
  {
    name: "book_resolve · 0 matches → no forced step (nothing to book)",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: { rooms: [], purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
    },
    expected: "pass",
  },
  {
    name: "book_resolve · 2+ matches → no forced step (ambiguous room name)",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-riverside-twin" }, { id: "room-bamboo-family-suite" }],
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
      },
    },
    expected: "pass",
  },
]);

/**
 * `find_room(book_resolve)` · exactly one match — the CREATE-flow fork. Routes
 * on whether check-in date AND guest count are both already known, corroborated
 * against the guest's own latest message (`resolveCorroboratedBookFacts` /
 * `book-form-prefill.ts`): an echoed value with no matching cue in the latest
 * text is treated as unstated and the Booking Form opens anyway. When both ARE
 * known, `findRoomTool`'s own availability probe (`output.availability`) decides
 * `confirm_booking` vs a stop — CREATE never calls `check_room_availability`.
 */
const AVAILABLE = {
  available: true,
  guestsWithinCapacity: true,
  checkInDate: "2026-10-22",
  checkOutDate: "2026-10-23",
  guests: 2,
};

stepContractEval("find_room(book_resolve) — CREATE fork: form vs confirm", [
  {
    name: "1 room · check-in + guests stated + room free → skip the form, force confirm_booking",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-riverside-twin" }],
        date: "2026-10-22",
        guests: 2,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
        availability: AVAILABLE,
      },
    },
    latestUserText: "Book the Riverside Twin Room for 2 guests on October 22",
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_BOOKING}`,
  },
  {
    name: "1 room · check-in + guests stated + room taken → stop (BookingUnavailable)",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-riverside-twin" }],
        date: "2026-10-22",
        guests: 2,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
        availability: { ...AVAILABLE, available: false },
      },
    },
    latestUserText: "Book the Riverside Twin Room for 2 guests on October 22",
    expected: "stop",
  },
  {
    name: "1 room · check-in + guests stated + over capacity → stop (BookingUnavailable)",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-riverside-twin" }],
        date: "2026-10-22",
        guests: 9,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
        availability: { ...AVAILABLE, guests: 9, guestsWithinCapacity: false },
      },
    },
    latestUserText: "Book the Riverside Twin Room for 9 guests on October 22",
    expected: "stop",
  },
  {
    name: "1 room · check-in + guests stated + probe absent (call failed) → still force confirm_booking",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-riverside-twin" }],
        date: "2026-10-22",
        guests: 2,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
      },
    },
    latestUserText: "Book the Riverside Twin Room for 2 guests on October 22",
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_BOOKING}`,
  },
  {
    name: "1 room · no stay stated → force the Booking Form (get_room_by_id)",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-riverside-twin" }],
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
      },
    },
    expected: `force:${TOOL_KEYS.BOOKING.GET_ROOM_BY_ID}`,
  },
  {
    name: "1 room · guests stated but no check-in → still the form",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-riverside-twin" }],
        guests: 2,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
      },
    },
    latestUserText: "Book the Riverside Twin Room for 2 guests",
    expected: `force:${TOOL_KEYS.BOOKING.GET_ROOM_BY_ID}`,
  },
  {
    name: "1 room · date echoed but absent from the latest message → treat as unstated, force the form",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-riverside-twin" }],
        date: "2026-10-22",
        guests: 2,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
      },
    },
    latestUserText: "Book the Riverside Twin Room",
    expected: `force:${TOOL_KEYS.BOOKING.GET_ROOM_BY_ID}`,
  },
  {
    // Reported 2026-09-14, and reconfirmed the same day: a stay-length phrase
    // is NOT enough to route on, no matter what the model attaches to `date` —
    // only a real check-in date is (stated, or an earlier DATED search). The
    // model read "in 4 nights" as a check-in OFFSET and echoed today + 4 as
    // `date`; the corroboration gate rejects it (no cue for a date in "in 4
    // nights for 4 people"), so `checkInDate` resolves to undefined here. With
    // no check-in, `findRoomTool` never runs the probe in the first place (see
    // resolveProbeStay — it requires a real checkInDate), so `availability` is
    // realistically ABSENT from the tool output, not merely unavailable. The
    // platform must still open the form rather than guess a date to check
    // capacity against — the capacity mismatch surfaces once the guest picks a
    // check-in in the form itself.
    name: "1 room · stay length only, no check-in anywhere → form, never a probe/refusal",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-moonlight-loft" }],
        date: "2026-09-18",
        guests: 4,
        nights: 4,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
        // No `availability` — the real probe never ran without a check-in.
      },
    },
    latestUserText: "I want to book Moonlight Loft in 4 nights for 4 people",
    expected: `force:${TOOL_KEYS.BOOKING.GET_ROOM_BY_ID}`,
  },
  {
    name: "1 room · STATED date taken → stop (card keeps the real dates)",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-bamboo-family-suite" }],
        date: "2026-09-18",
        guests: 2,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
        availability: {
          available: false,
          guestsWithinCapacity: true,
          checkInDate: "2026-09-18",
          checkOutDate: "2026-09-19",
          guests: 2,
        },
      },
    },
    latestUserText: "I want to book Bamboo Family Suite on the 18th for 2 people",
    expected: "stop",
  },
  {
    // Guest capacity is a static room fact — it never needs a check-in date to
    // evaluate. findRoomTool's probe (probeBookResolveAvailability) reports
    // this over-capacity verdict with NO dates at all when the party is too
    // big and the guest hasn't given a check-in yet; the step machine must
    // stop the turn (BookingUnavailable) instead of silently opening the
    // Booking Form the way an ordinary "no stay stated" case would.
    name: "1 room · guests stated, no check-in, over capacity → stop (BookingUnavailable, no invented date)",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-moonlight-loft" }],
        guests: 3,
        nights: 2,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
        // No checkInDate/checkOutDate/datesAvailable — dates were never
        // checked, only guests vs room.capacity.
        availability: { available: true, guestsWithinCapacity: false, guests: 3 },
      },
    },
    latestUserText: "I want to book Moonlight Loft for 3 guests for 2 nights",
    expected: "stop",
  },
  {
    // Both the party size and the requested dates are bad at once — the step
    // machine only needs to know SOMETHING failed to stop the turn; which
    // reason(s) the guest sees is a FindRoomNotice/BookingUnavailable concern
    // (see resolveBookingUnavailableReason), not a routing one.
    name: "1 room · guests + dates stated, over capacity AND dates taken → stop",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-moonlight-loft" }],
        date: "2026-09-18",
        guests: 3,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
        availability: {
          available: false,
          guestsWithinCapacity: false,
          datesAvailable: false,
          checkInDate: "2026-09-18",
          checkOutDate: "2026-09-20",
          guests: 3,
        },
      },
    },
    latestUserText:
      "I want to book Moonlight Loft from September 18 to September 20 for 3 guests",
    expected: "stop",
  },
  {
    name: "1 room · stay length AND a real date stated → both known, force confirm_booking",
    last: {
      toolName: TOOL_KEYS.GET.FIND_ROOM,
      input: { purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      output: {
        rooms: [{ id: "room-moonlight-loft" }],
        date: "2026-09-18",
        guests: 2,
        nights: 4,
        purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE,
        availability: {
          available: true,
          guestsWithinCapacity: true,
          checkInDate: "2026-09-18",
          checkOutDate: "2026-09-22",
          guests: 2,
        },
      },
    },
    latestUserText:
      "I want to book Moonlight Loft for 4 nights starting September 18 for 2 people",
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_BOOKING}`,
  },
]);
