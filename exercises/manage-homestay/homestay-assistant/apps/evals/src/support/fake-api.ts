import { ROUTES } from "@repo/constants";
import { BookingStatus } from "@repo/types";
import { addDaysYmd, extractRoomNameQuery } from "@repo/utils";

import type { Booking } from "@agent/mastra/schemas/booking";
import { getApiUrl } from "@agent/mastra/services/common";
import {
  EVAL_USER_ID,
  FIXTURE_BOOKINGS,
  FIXTURE_ROOMS,
  findFixtureRoom,
} from "./fixtures";

/**
 * Mock boundary for evals: `apps/agent/src/mastra/services/common.ts` is the
 * single chokepoint every room/booking tool uses to call the real NestJS API
 * (`GET/POST/PATCH/DELETE` via `fetch`). Stubbing `globalThis.fetch` here —
 * instead of mocking the Mastra tools or the agent — means the real tool
 * code, Zod response parsing, and the real `booking/*` step-machine +
 * availability logic all still run; only the network call to apps/api is
 * replaced with deterministic fixture data. This keeps evals independent of
 * a running apps/api process and of whatever happens to be in a dev/prod
 * database.
 *
 * Only requests whose origin matches `getApiUrl()` are faked — every other
 * `fetch` (the model provider call itself, the LLM-judge's own call) is
 * passed straight through to the real network. Matching by full origin
 * (not just intercepting everything) is what keeps this from also
 * swallowing the agent's actual OpenAI/Cerebras call.
 */

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const errorResponse = (message: string, status: number) =>
  jsonResponse({ message }, status);

const rangesOverlap = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) => aStart < bEnd && bStart < aEnd;

const toRequestUrl = (input: RequestInfo | URL): URL => {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
};

export type FakeApiState = {
  bookings: Booking[];
};

export type FakeApiHandle = {
  state: FakeApiState;
  restore: () => void;
};

/**
 * Installs a fixture-backed `fetch` for the duration of one eval case.
 * Always pair with `handle.restore()` (evals call this in a `finally`) so a
 * failing case can't leak the stub into the next one.
 */
export const installFakeApi = (): FakeApiHandle => {
  const state: FakeApiState = {
    bookings: FIXTURE_BOOKINGS.map((booking) => ({ ...booking })),
  };
  const apiOrigin = new URL(getApiUrl()).origin;
  const originalFetch = globalThis.fetch;

  const handleRequest = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = toRequestUrl(input);

    if (url.origin !== apiOrigin) {
      return originalFetch(input, init);
    }

    const method = (init?.method ?? "GET").toUpperCase();
    const { pathname, searchParams } = url;

    // --- Rooms -------------------------------------------------------
    if (pathname === ROUTES.ROOMS && method === "GET") {
      const name = searchParams.get("name")?.trim().toLowerCase();
      const guests = searchParams.get("guests");
      const level = searchParams.get("level");

      const rooms = FIXTURE_ROOMS.filter((room) => {
        if (name && !room.name.toLowerCase().includes(name)) return false;
        if (guests && room.capacity < Number(guests)) return false;
        if (level && room.level !== Number(level)) return false;
        return true;
      });

      return jsonResponse(rooms);
    }

    // Mirrors the API's role gate: the eval user is a guest, so `booked`
    // (guest names) is omitted entirely. Must precede the `/rooms/:id` match.
    if (pathname === ROUTES.ROOM_AVAILABILITY_OVERVIEW && method === "GET") {
      const date = searchParams.get("date") ?? "";
      const checkOutDate =
        searchParams.get("checkOutDate") ?? addDaysYmd(date, 1);
      const bookedRoomIds = new Set(
        state.bookings
          .filter(
            (booking) =>
              booking.status !== BookingStatus.CANCELLED &&
              rangesOverlap(
                date,
                checkOutDate,
                booking.checkInDate,
                booking.checkOutDate,
              ),
          )
          .map((booking) => booking.roomId),
      );
      const available = FIXTURE_ROOMS.filter(
        (room) => !bookedRoomIds.has(room.id),
      );

      return jsonResponse({
        date,
        checkOutDate,
        available,
        summary: {
          total: FIXTURE_ROOMS.length,
          availableCount: available.length,
          bookedCount: bookedRoomIds.size,
        },
      });
    }

    const roomIdMatch = pathname.match(
      new RegExp(`^${ROUTES.ROOMS}/([^/]+)$`),
    );
    if (roomIdMatch && method === "GET") {
      const room = findFixtureRoom(roomIdMatch[1]!);
      if (!room) return errorResponse("Room not found", 404);
      return jsonResponse(room);
    }

    // --- Booking resolution (find_bookings) ---------------------------
    if (pathname === ROUTES.FIND_BOOKINGS && method === "GET") {
      const roomNameParam = searchParams.get("roomName")?.trim();
      // Mirrors booking.repository.ts: strip filler ("Moonlight room" →
      // "moonlight") and require every remaining token to appear in the
      // room name, so a generic noun around the name doesn't hide a match.
      const roomNameTokens = roomNameParam
        ? extractRoomNameQuery(roomNameParam).split(" ").filter(Boolean)
        : [];
      const dateFrom = searchParams.get("dateFrom");
      const dateTo = searchParams.get("dateTo");
      const matches = state.bookings.filter((booking) => {
        if (booking.status === BookingStatus.CANCELLED) return false;
        const roomName = booking.room?.name.toLowerCase() ?? "";
        if (
          roomNameTokens.length > 0 &&
          !roomNameTokens.every((token) => roomName.includes(token))
        ) {
          return false;
        }
        // Stay overlaps [dateFrom, dateTo) — mirrors booking.repository.ts's
        // dateFrom/dateTo filter.
        if (dateFrom && dateTo) {
          return rangesOverlap(
            booking.checkInDate,
            booking.checkOutDate,
            dateFrom,
            dateTo,
          );
        }
        return true;
      });

      if (matches.length === 0) {
        return jsonResponse({ status: "not_found", bookings: [] });
      }
      if (matches.length === 1) {
        return jsonResponse({ status: "resolved", booking: matches[0] });
      }
      return jsonResponse({ status: "ambiguous", bookings: matches });
    }

    // --- Availability ---------------------------------------------------
    if (pathname === ROUTES.BOOKING_AVAILABILITY && method === "GET") {
      const roomId = searchParams.get("roomId") ?? "";
      const room = findFixtureRoom(roomId);
      if (!room) return errorResponse("Room not found", 404);

      const checkInDate = searchParams.get("checkInDate") ?? "";
      const checkOutDate = searchParams.get("checkOutDate") ?? "";
      const guestsParam = searchParams.get("guests");
      const guests = guestsParam ? Number(guestsParam) : undefined;
      const excludeBookingId = searchParams.get("excludeBookingId") ?? undefined;

      const guestsWithinCapacity = guests === undefined || guests <= room.capacity;
      const overlapsExisting = state.bookings.some(
        (booking) =>
          booking.id !== excludeBookingId &&
          booking.roomId === roomId &&
          booking.status !== BookingStatus.CANCELLED &&
          rangesOverlap(
            checkInDate,
            checkOutDate,
            booking.checkInDate,
            booking.checkOutDate,
          ),
      );

      return jsonResponse({
        available: !overlapsExisting && guestsWithinCapacity,
        guestsWithinCapacity,
        room,
        checkInDate,
        checkOutDate,
        guests,
      });
    }

    // --- Bookings list -------------------------------------------------
    if (pathname === ROUTES.BOOKINGS && method === "GET") {
      let list = state.bookings;
      const roomId = searchParams.get("roomId");
      const status = searchParams.get("status");
      const onDate = searchParams.get("onDate");
      if (roomId) list = list.filter((b) => b.roomId === roomId);
      if (status) list = list.filter((b) => b.status === status);
      if (onDate) {
        list = list.filter(
          (b) => b.checkInDate <= onDate && onDate < b.checkOutDate,
        );
      }
      return jsonResponse(list);
    }

    const bookingIdMatch = pathname.match(
      new RegExp(`^${ROUTES.BOOKINGS}/([^/]+)$`),
    );

    if (bookingIdMatch && method === "GET") {
      const booking = state.bookings.find((b) => b.id === bookingIdMatch[1]);
      if (!booking) return errorResponse("Booking not found", 404);
      return jsonResponse(booking);
    }

    // --- Mutations -------------------------------------------------------
    if (pathname === ROUTES.BOOKINGS && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const room = findFixtureRoom(body.roomId);
      const created: Booking = {
        id: `booking-eval-created-${state.bookings.length + 1}`,
        roomId: body.roomId,
        userId: EVAL_USER_ID,
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        guests: body.guests,
        totalPrice: room?.pricePerNight ?? 0,
        status: body.status ?? BookingStatus.CONFIRMED,
        room: room ? { ...room } : undefined,
      };
      state.bookings.push(created);
      return jsonResponse(created, 201);
    }

    if (bookingIdMatch && method === "PATCH") {
      const index = state.bookings.findIndex(
        (b) => b.id === bookingIdMatch[1],
      );
      if (index === -1) return errorResponse("Booking not found", 404);
      const body = JSON.parse(String(init?.body ?? "{}"));
      state.bookings[index] = { ...state.bookings[index]!, ...body };
      return jsonResponse(state.bookings[index]);
    }

    if (bookingIdMatch && method === "DELETE") {
      const index = state.bookings.findIndex(
        (b) => b.id === bookingIdMatch[1],
      );
      if (index === -1) return errorResponse("Booking not found", 404);
      state.bookings[index] = {
        ...state.bookings[index]!,
        status: BookingStatus.CANCELLED,
      };
      return jsonResponse(state.bookings[index]);
    }

    throw new Error(`[fake-api] Unhandled fixture request: ${method} ${pathname}`);
  };

  globalThis.fetch = handleRequest as typeof fetch;

  return {
    state,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
};
