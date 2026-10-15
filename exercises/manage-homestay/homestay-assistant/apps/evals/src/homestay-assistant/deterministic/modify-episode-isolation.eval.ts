import { evalite } from "evalite";

import { TOOL_KEYS } from "@repo/constants";
import {
  selectConfirmModifyCardView,
  selectModifyEpisode,
  type ConfirmModifyCardArgs,
  type ConfirmModifyEditStash,
} from "@repo/utils";

import { scoreResult } from "../../support/checks";

/**
 * Consecutive MODIFYs must never bleed into each other's confirm card —
 * `selectModifyEpisode` + `selectConfirmModifyCardView`, the exact selectors
 * `HitlConfirmModifyStayModal` renders and confirms from.
 *
 * Reported (2026-09-10):
 *   1. "extend one more night" on Tea House Studio → success; then the same on
 *      Sunrise Balcony Room → the Sunrise card showed Tea House Studio's room
 *      and stay, and Confirm wrote Tea House's dates onto the Sunrise booking
 *      (update_booking trusts the card's Confirm payload via the
 *      PENDING_UPDATE_STAY pin). The card hydrated from "the newest
 *      find_booking_by_id result in the whole transcript" and fell back to
 *      `bookings[0]` of ANY result when its bookingId did not match.
 *   2. Confirming modify B flipped the settled modify-A card back to
 *      "Updating booking…": both cards resolved to the same stay, and the card
 *      phase lived in a store keyed by that stay.
 *
 * Fixtures mimic the live frontend transcript: model-authored HITL args (often
 * re-sending the previous room), no readable tool message for a HITL answer
 * after the turn reconciles, and sparse force-called `update_booking` args.
 */

type Room = { id: string; name: string; pricePerNight: number };

type Booking = {
  bookingId: string;
  roomId: string;
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
};

type Msg = {
  id: string;
  role: string;
  content?: string;
  toolCallId?: string;
  toolCalls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
};

const TEA: Room = { id: "room-tea", name: "Tea House Studio", pricePerNight: 540_000 };
const SUNRISE: Room = { id: "room-sunrise", name: "Sunrise Balcony Room", pricePerNight: 620_000 };
const ORCHID: Room = { id: "room-orchid", name: "Orchid Twin Loft", pricePerNight: 890_000 };

const BOOKING_TEA: Booking = {
  bookingId: "bk-tea",
  roomId: TEA.id,
  roomName: TEA.name,
  checkInDate: "2026-09-12",
  checkOutDate: "2026-09-16",
  guests: 2,
};
const BOOKING_SUNRISE: Booking = {
  bookingId: "bk-sunrise",
  roomId: SUNRISE.id,
  roomName: SUNRISE.name,
  checkInDate: "2026-09-20",
  checkOutDate: "2026-09-22",
  guests: 2,
};
const BOOKING_ORCHID: Booking = {
  bookingId: "bk-orchid",
  roomId: ORCHID.id,
  roomName: ORCHID.name,
  checkInDate: "2026-09-11",
  checkOutDate: "2026-09-14",
  guests: 2,
};

const ROOM_BY_ID: Record<string, Room> = {
  [TEA.id]: TEA,
  [SUNRISE.id]: SUNRISE,
  [ORCHID.id]: ORCHID,
};

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${++sequence}`;

const user = (content: string): Msg => ({ id: nextId("user"), role: "user", content });

const say = (content: string): Msg => ({ id: nextId("assistant"), role: "assistant", content });

const call = (toolCallId: string, name: string, args: object): Msg => ({
  id: nextId("assistant"),
  role: "assistant",
  content: "",
  toolCalls: [
    { id: toolCallId, type: "function", function: { name, arguments: JSON.stringify(args) } },
  ],
});

const toolResult = (toolCallId: string, content: object): Msg => ({
  id: nextId("tool"),
  role: "tool",
  toolCallId,
  content: JSON.stringify(content),
});

/** The confirm_modify_booking args a correct model would author for this change. */
const correctArgs = (booking: Booking, newCheckOut: string): ConfirmModifyCardArgs<Room> => ({
  bookingId: booking.bookingId,
  room: ROOM_BY_ID[booking.roomId],
  checkInDate: booking.checkInDate,
  checkOutDate: newCheckOut,
  guests: booking.guests,
  originalCheckInDate: booking.checkInDate,
  originalCheckOutDate: booking.checkOutDate,
  originalGuests: booking.guests,
});

const updateSuccess = (booking: Booking, newCheckOut: string) => ({
  id: booking.bookingId,
  roomId: booking.roomId,
  checkInDate: booking.checkInDate,
  checkOutDate: newCheckOut,
  guests: booking.guests,
  totalPrice: 1,
  status: "confirmed",
});

type UpdateOutcome = "success" | "failed" | "pending" | "none";

/**
 * One "i want to extend my stay one more date of <room>" modify:
 * find_bookings → find_booking_by_id(modify, delta 1) → confirm_modify_booking
 * → update_booking. `probe`: "free" (availability block), "failed" (probe
 * call errored — no availability block, the step machine still forces the
 * confirm), "skipped" (the model never called find_booking_by_id).
 */
const extendEpisode = ({
  key,
  booking,
  newCheckOut,
  probe = "free",
  confirmArgs,
  update = "success",
}: {
  key: string;
  booking: Booking;
  newCheckOut: string;
  probe?: "free" | "failed" | "skipped";
  confirmArgs?: ConfirmModifyCardArgs<Room>;
  update?: UpdateOutcome;
}): Msg[] => {
  const room = ROOM_BY_ID[booking.roomId]!;
  const messages: Msg[] = [
    user(`i want to extend my stay one more date of ${booking.roomName}`),
    call(`find-bookings-${key}`, TOOL_KEYS.BOOKING.FIND, { roomName: booking.roomName }),
    toolResult(`find-bookings-${key}`, {
      status: "resolved",
      booking: { ...booking, id: booking.bookingId },
    }),
  ];

  if (probe !== "skipped") {
    messages.push(
      call(`lookup-${key}`, TOOL_KEYS.BOOKING.FIND_BY_ID, {
        bookingId: booking.bookingId,
        purpose: "modify",
        requestedCheckOutDeltaDays: 1,
      }),
      toolResult(`lookup-${key}`, {
        bookings: [booking],
        bookingId: booking.bookingId,
        queryName: booking.roomName,
        room,
        requestedCheckOutDate: newCheckOut,
        ...(probe === "free"
          ? {
              availability: {
                available: true,
                guestsWithinCapacity: true,
                checkInDate: booking.checkInDate,
                checkOutDate: newCheckOut,
                guests: booking.guests,
              },
            }
          : {}),
      }),
    );
  }

  messages.push(
    call(
      `confirm-${key}`,
      TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
      confirmArgs ?? correctArgs(booking, newCheckOut),
    ),
  );

  if (update !== "none") {
    // Force-called with no args — the stay comes from the request-context pin.
    messages.push(call(`update-${key}`, TOOL_KEYS.BOOKING.UPDATE_BOOKING, {}));
  }
  if (update === "success") {
    messages.push(
      toolResult(`update-${key}`, updateSuccess(booking, newCheckOut)),
      say(`Your booking for ${booking.roomName} was successfully updated.`),
    );
  }
  if (update === "failed") {
    messages.push(
      toolResult(`update-${key}`, { message: "Something went wrong while modify your booking." }),
      say("Something went wrong while updating your booking."),
    );
  }

  return messages;
};

/** "[booking-modify] bookingId: …" → edit form → confirm → update (form path). */
const formEpisode = ({
  key,
  booking,
  update = "success",
  pickedCheckOut,
}: {
  key: string;
  booking: Booking;
  update?: UpdateOutcome;
  pickedCheckOut: string;
}): Msg[] => {
  const room = ROOM_BY_ID[booking.roomId]!;
  const messages: Msg[] = [
    user(`[booking-modify] bookingId: ${booking.bookingId}. Modify my booking.`),
    call(`lookup-${key}`, TOOL_KEYS.BOOKING.FIND_BY_ID, {
      bookingId: booking.bookingId,
      purpose: "modify",
    }),
    toolResult(`lookup-${key}`, {
      bookings: [booking],
      bookingId: booking.bookingId,
      queryName: booking.roomName,
      room,
    }),
    call(`edit-${key}`, TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING, {
      bookingId: booking.bookingId,
      room,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      guests: booking.guests,
    }),
    call(`confirm-${key}`, TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING, correctArgs(booking, pickedCheckOut)),
  ];

  if (update !== "none") {
    messages.push(call(`update-${key}`, TOOL_KEYS.BOOKING.UPDATE_BOOKING, {}));
  }
  if (update === "success") {
    messages.push(toolResult(`update-${key}`, updateSuccess(booking, pickedCheckOut)));
  }

  return messages;
};

const editStash = (booking: Booking, checkOutDate: string): ConfirmModifyEditStash => ({
  bookingId: booking.bookingId,
  checkInDate: booking.checkInDate,
  checkOutDate,
  guests: booking.guests,
  original: {
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    guests: booking.guests,
  },
});

type CardSnapshot = {
  hasEpisode: boolean;
  hasLookup: boolean;
  /** What the card shows AND what its Confirm sends to update_booking. */
  bookingId: string;
  roomName: string | null;
  checkOutDate: string;
  originalCheckOutDate: string | null;
  editToolCallId: string | null;
  updateToolCallId: string | null;
  updatePending: boolean | null;
};

type Case = {
  name: string;
  transcript: Msg[];
  cardToolCallId: string;
  args: ConfirmModifyCardArgs<Room>;
  /** Booking-store stashes keyed by edit_modify_booking toolCallId. */
  stashes?: Record<string, ConfirmModifyEditStash>;
  expected: Partial<CardSnapshot>;
};

const argsOf = (transcript: Msg[], toolCallId: string): ConfirmModifyCardArgs<Room> => {
  for (const message of transcript) {
    const hit = message.toolCalls?.find((toolCall) => toolCall.id === toolCallId);
    if (hit) {
      return JSON.parse(hit.function.arguments) as ConfirmModifyCardArgs<Room>;
    }
  }
  throw new Error(`no tool call ${toolCallId} in fixture`);
};

/** A → B, where the model re-sends Tea House's args on the Sunrise card. */
const teaThenSunriseWithStaleArgs = (probe: "free" | "failed") => [
  ...extendEpisode({ key: "A", booking: BOOKING_TEA, newCheckOut: "2026-09-17" }),
  ...extendEpisode({
    key: "B",
    booking: BOOKING_SUNRISE,
    newCheckOut: "2026-09-23",
    probe,
    confirmArgs: { ...correctArgs(BOOKING_TEA, "2026-09-17"), bookingId: BOOKING_SUNRISE.bookingId },
    update: "none",
  }),
];

const teaThenSunrisePending = [
  ...extendEpisode({ key: "A", booking: BOOKING_TEA, newCheckOut: "2026-09-17" }),
  ...extendEpisode({ key: "B", booking: BOOKING_SUNRISE, newCheckOut: "2026-09-23", update: "pending" }),
];

const threeModifies = [
  ...extendEpisode({ key: "A", booking: BOOKING_TEA, newCheckOut: "2026-09-17" }),
  ...extendEpisode({ key: "B", booking: BOOKING_SUNRISE, newCheckOut: "2026-09-23" }),
  ...extendEpisode({ key: "C", booking: BOOKING_ORCHID, newCheckOut: "2026-09-15", update: "pending" }),
];

/** Same booking, same proposed stay, twice: the first update failed. */
const sameStayTwice = [
  ...extendEpisode({ key: "A1", booking: BOOKING_TEA, newCheckOut: "2026-09-17", update: "failed" }),
  ...extendEpisode({ key: "A2", booking: BOOKING_TEA, newCheckOut: "2026-09-17", update: "pending" }),
];

const retryInLaterTurn = [
  ...extendEpisode({ key: "A", booking: BOOKING_TEA, newCheckOut: "2026-09-17", update: "failed" }),
  user("Retry modify this booking."),
  call("update-A-retry", TOOL_KEYS.BOOKING.UPDATE_BOOKING, { bookingId: BOOKING_TEA.bookingId }),
  toolResult("update-A-retry", updateSuccess(BOOKING_TEA, "2026-09-17")),
];

const foreignUpdateLater = [
  ...extendEpisode({ key: "A", booking: BOOKING_TEA, newCheckOut: "2026-09-17", update: "failed" }),
  user("never mind, extend the Orchid one instead"),
  call("update-orchid-stray", TOOL_KEYS.BOOKING.UPDATE_BOOKING, {}),
  toolResult("update-orchid-stray", updateSuccess(BOOKING_ORCHID, "2026-09-15")),
];

/** AG-UI replays card A's call into B's turn, between B's lookup and B's card. */
const replayedCallInLaterTurn = (() => {
  const episodeA = extendEpisode({ key: "A", booking: BOOKING_TEA, newCheckOut: "2026-09-17" });
  const episodeB = extendEpisode({ key: "B", booking: BOOKING_SUNRISE, newCheckOut: "2026-09-23", update: "pending" });
  const confirmBIndex = episodeB.findIndex((message) =>
    message.toolCalls?.some((toolCall) => toolCall.id === "confirm-B"),
  );
  const replay = call("confirm-A", TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING, correctArgs(BOOKING_TEA, "2026-09-17"));
  return [...episodeA, ...episodeB.slice(0, confirmBIndex), replay, ...episodeB.slice(confirmBIndex)];
})();

const sameBookingTwiceByForm = [
  ...formEpisode({ key: "F1", booking: BOOKING_TEA, pickedCheckOut: "2026-09-18" }),
  ...formEpisode({ key: "F2", booking: BOOKING_TEA, pickedCheckOut: "2026-09-19", update: "pending" }),
];
const formStashes = {
  "edit-F1": editStash(BOOKING_TEA, "2026-09-18"),
  "edit-F2": editStash(BOOKING_TEA, "2026-09-19"),
};

const cases: Case[] = [
  {
    name: "ISSUE 1 · Sunrise card shows Sunrise even when the model re-sends Tea House's room + stay",
    transcript: teaThenSunriseWithStaleArgs("free"),
    cardToolCallId: "confirm-B",
    args: argsOf(teaThenSunriseWithStaleArgs("free"), "confirm-B"),
    expected: {
      bookingId: BOOKING_SUNRISE.bookingId,
      roomName: SUNRISE.name,
      checkOutDate: "2026-09-23",
      originalCheckOutDate: "2026-09-22",
    },
  },
  {
    name: "ISSUE 1 · Sunrise probe call failed → still Sunrise's own lookup (echoed check-out), never Tea House's",
    transcript: teaThenSunriseWithStaleArgs("failed"),
    cardToolCallId: "confirm-B",
    args: argsOf(teaThenSunriseWithStaleArgs("failed"), "confirm-B"),
    expected: {
      hasLookup: true,
      bookingId: BOOKING_SUNRISE.bookingId,
      roomName: SUNRISE.name,
      checkOutDate: "2026-09-23",
      originalCheckOutDate: "2026-09-22",
    },
  },
  {
    name: "ISSUE 1 · model hint is Tea House's bookingId on the Sunrise card → Confirm still targets Sunrise with Sunrise's stay",
    transcript: teaThenSunriseWithStaleArgs("free"),
    cardToolCallId: "confirm-B",
    args: correctArgs(BOOKING_TEA, "2026-09-17"),
    expected: {
      bookingId: BOOKING_SUNRISE.bookingId,
      roomName: SUNRISE.name,
      checkOutDate: "2026-09-23",
    },
  },
  {
    name: "Sunrise episode has no find_booking_by_id → nothing borrowed from the Tea House episode",
    transcript: [
      ...extendEpisode({ key: "A", booking: BOOKING_TEA, newCheckOut: "2026-09-17" }),
      ...extendEpisode({ key: "B", booking: BOOKING_SUNRISE, newCheckOut: "2026-09-23", probe: "skipped", update: "none" }),
    ],
    cardToolCallId: "confirm-B",
    args: correctArgs(BOOKING_SUNRISE, "2026-09-23"),
    expected: {
      hasEpisode: true,
      hasLookup: false,
      bookingId: BOOKING_SUNRISE.bookingId,
      roomName: SUNRISE.name,
      checkOutDate: "2026-09-23",
      originalCheckOutDate: "2026-09-22",
    },
  },
  {
    name: "settled Tea House card keeps Tea House after the Sunrise lookup lands",
    transcript: teaThenSunrisePending,
    cardToolCallId: "confirm-A",
    args: argsOf(teaThenSunrisePending, "confirm-A"),
    expected: {
      bookingId: BOOKING_TEA.bookingId,
      roomName: TEA.name,
      checkOutDate: "2026-09-17",
      originalCheckOutDate: "2026-09-16",
    },
  },
  {
    name: "ISSUE 2 · confirming Sunrise leaves Tea House settled — its outcome is its OWN update",
    transcript: teaThenSunrisePending,
    cardToolCallId: "confirm-A",
    args: argsOf(teaThenSunrisePending, "confirm-A"),
    expected: { updateToolCallId: "update-A", updatePending: false },
  },
  {
    name: "ISSUE 2 · only the Sunrise card is submitting while its update runs",
    transcript: teaThenSunrisePending,
    cardToolCallId: "confirm-B",
    args: argsOf(teaThenSunrisePending, "confirm-B"),
    expected: { updateToolCallId: "update-B", updatePending: true },
  },
  {
    name: "ISSUE 2 · same booking, identical new stay, two episodes → the first card stays failed, not submitting",
    transcript: sameStayTwice,
    cardToolCallId: "confirm-A1",
    args: argsOf(sameStayTwice, "confirm-A1"),
    expected: { updateToolCallId: "update-A1", updatePending: false },
  },
  {
    name: "three modifies (Tea → Sunrise → Orchid): Tea House card never becomes Orchid",
    transcript: threeModifies,
    cardToolCallId: "confirm-A",
    args: argsOf(threeModifies, "confirm-A"),
    expected: {
      bookingId: BOOKING_TEA.bookingId,
      roomName: TEA.name,
      checkOutDate: "2026-09-17",
      updateToolCallId: "update-A",
      updatePending: false,
    },
  },
  {
    name: "three modifies: Sunrise card never becomes Orchid",
    transcript: threeModifies,
    cardToolCallId: "confirm-B",
    args: argsOf(threeModifies, "confirm-B"),
    expected: {
      bookingId: BOOKING_SUNRISE.bookingId,
      roomName: SUNRISE.name,
      checkOutDate: "2026-09-23",
      updateToolCallId: "update-B",
      updatePending: false,
    },
  },
  {
    name: "three modifies: Orchid card is the one submitting",
    transcript: threeModifies,
    cardToolCallId: "confirm-C",
    args: argsOf(threeModifies, "confirm-C"),
    expected: {
      bookingId: BOOKING_ORCHID.bookingId,
      roomName: ORCHID.name,
      checkOutDate: "2026-09-15",
      updateToolCallId: "update-C",
      updatePending: true,
    },
  },
  {
    name: "Retry sent in a later turn settles the SAME card (latest attempt decides)",
    transcript: retryInLaterTurn,
    cardToolCallId: "confirm-A",
    args: argsOf(retryInLaterTurn, "confirm-A"),
    expected: { updateToolCallId: "update-A-retry", updatePending: false },
  },
  {
    name: "another booking's update_booking (no confirm card) never settles this card",
    transcript: foreignUpdateLater,
    cardToolCallId: "confirm-A",
    args: argsOf(foreignUpdateLater, "confirm-A"),
    expected: { updateToolCallId: "update-A", updatePending: false },
  },
  {
    name: "a replayed Tea House call inside the Sunrise turn neither cuts Sunrise's episode…",
    transcript: replayedCallInLaterTurn,
    cardToolCallId: "confirm-B",
    args: argsOf(replayedCallInLaterTurn, "confirm-B"),
    expected: {
      bookingId: BOOKING_SUNRISE.bookingId,
      roomName: SUNRISE.name,
      updateToolCallId: "update-B",
      updatePending: true,
    },
  },
  {
    name: "…nor moves the Tea House card's own anchor",
    transcript: replayedCallInLaterTurn,
    cardToolCallId: "confirm-A",
    args: correctArgs(BOOKING_TEA, "2026-09-17"),
    expected: {
      bookingId: BOOKING_TEA.bookingId,
      roomName: TEA.name,
      updateToolCallId: "update-A",
      updatePending: false,
    },
  },
  {
    name: "form path, same booking twice: card 1 reads only edit form 1's stash",
    transcript: sameBookingTwiceByForm,
    cardToolCallId: "confirm-F1",
    args: correctArgs(BOOKING_TEA, "2026-09-16"),
    stashes: formStashes,
    expected: {
      editToolCallId: "edit-F1",
      checkOutDate: "2026-09-18",
      originalCheckOutDate: "2026-09-16",
      updateToolCallId: "update-F1",
      updatePending: false,
    },
  },
  {
    name: "form path, same booking twice: card 2 reads only edit form 2's stash",
    transcript: sameBookingTwiceByForm,
    cardToolCallId: "confirm-F2",
    args: correctArgs(BOOKING_TEA, "2026-09-16"),
    stashes: formStashes,
    expected: {
      editToolCallId: "edit-F2",
      checkOutDate: "2026-09-19",
      updateToolCallId: "update-F2",
      updatePending: true,
    },
  },
  {
    name: "card toolCallId not in the transcript → no episode, args only",
    transcript: teaThenSunrisePending,
    cardToolCallId: "confirm-unknown",
    args: correctArgs(BOOKING_ORCHID, "2026-09-15"),
    expected: {
      hasEpisode: false,
      bookingId: BOOKING_ORCHID.bookingId,
      roomName: ORCHID.name,
      updateToolCallId: null,
    },
  },
];

const snapshotCard = (input: Case): CardSnapshot => {
  const episode = selectModifyEpisode<Room>(input.transcript, {
    toolCallId: input.cardToolCallId,
    bookingId: input.args.bookingId,
  });
  const stash = episode?.edit ? (input.stashes?.[episode.edit.toolCallId] ?? null) : null;
  const view = selectConfirmModifyCardView<Room>({ episode, args: input.args, editStash: stash });

  return {
    hasEpisode: episode != null,
    hasLookup: episode?.booking != null,
    bookingId: view.bookingId,
    roomName: view.room?.name ?? null,
    checkOutDate: view.checkOutDate,
    originalCheckOutDate: view.original?.checkOutDate ?? null,
    editToolCallId: episode?.edit?.toolCallId ?? null,
    updateToolCallId: episode?.update?.toolCallId ?? null,
    updatePending: episode?.update ? episode.update.result == null : null,
  };
};

evalite<Case, CardSnapshot, Case["expected"]>(
  "confirm_modify_booking episode isolation — each card shows, confirms, and settles only its own modify",
  {
    data: () => cases.map((testCase) => ({ input: testCase, expected: testCase.expected })),
    task: snapshotCard,
    scorers: [
      {
        name: "card view matches its own episode",
        scorer: ({ output, expected }) => {
          const problems = Object.entries(expected ?? {})
            .filter(([key, value]) => output[key as keyof CardSnapshot] !== value)
            .map(
              ([key, value]) =>
                `${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(output[key as keyof CardSnapshot])}`,
            );
          return scoreResult(
            problems.length === 0,
            problems.length === 0 ? `matched: ${JSON.stringify(output)}` : problems.join("; "),
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Case", value: input.name },
      { label: "Card", value: JSON.stringify(output) },
    ],
  },
);
