import type { Room } from "@repo/schemas";
import { BookingStatus } from "@repo/types";

import type { Booking } from "@agent/mastra/schemas/booking";

/**
 * Deterministic room/booking dataset for evals — never the real apps/api
 * database. Dates are fixed relative to the eval "today" below so
 * availability/overlap math in `fake-api.ts` (and the real
 * `evaluateAvailabilityCandidate` / `isSameModifyStay` production code that
 * consumes it) stays stable regardless of when the suite runs.
 */
export const EVAL_TODAY = "2026-09-02";
export const EVAL_USER_ID = "eval-guest";

export const FIXTURE_ROOMS: Room[] = [
  {
    id: "room-bamboo-family-suite",
    name: "Bamboo Family Suite",
    level: 4,
    levelColor: "#E6C547",
    capacity: 4,
    description:
      "Spacious family suite with bamboo furnishings and a private balcony.",
    imageUrl: "https://example.com/fixtures/bamboo-family-suite.jpg",
    availableSlots: 3,
    amenities: ["Free WiFi", "Air conditioning", "Private balcony", "Family bed"],
    pricePerNight: 1_200_000,
  },
  {
    id: "room-riverside-twin",
    name: "Riverside Twin Room",
    level: 2,
    levelColor: "#4A90D9",
    capacity: 2,
    description: "Cozy twin room overlooking the river, ideal for two guests.",
    imageUrl: "https://example.com/fixtures/riverside-twin.jpg",
    availableSlots: 5,
    amenities: ["Free WiFi", "River view", "Air conditioning"],
    pricePerNight: 650_000,
  },
  {
    id: "room-lotus-single",
    name: "Lotus Single Room",
    level: 1,
    levelColor: "#7FB069",
    capacity: 1,
    description: "Compact single room, perfect for solo travelers.",
    imageUrl: "https://example.com/fixtures/lotus-single.jpg",
    availableSlots: 2,
    amenities: ["Free WiFi", "Air conditioning"],
    pricePerNight: 350_000,
  },
];

export const findFixtureRoom = (id: string) =>
  FIXTURE_ROOMS.find((room) => room.id === id);

const toRoomSummary = (room: Room) => ({ ...room });

/**
 * One existing, modifiable, future-dated booking (check-in well after
 * `EVAL_TODAY`, so `isModifiableBooking` is true) — used by modify/cancel
 * evals to resolve a real target instead of inventing a booking id.
 */
export const FIXTURE_EXISTING_BOOKING: Booking = {
  id: "booking-eval-riverside-existing",
  roomId: FIXTURE_ROOMS[1].id,
  userId: EVAL_USER_ID,
  checkInDate: "2026-10-05",
  checkOutDate: "2026-10-08",
  guests: 2,
  totalPrice: 1_950_000,
  status: BookingStatus.CONFIRMED,
  room: toRoomSummary(FIXTURE_ROOMS[1]),
};

/** A second booking so `find_bookings` has an unambiguous single match by name. */
export const FIXTURE_FAMILY_BOOKING: Booking = {
  id: "booking-eval-bamboo-family",
  roomId: FIXTURE_ROOMS[0].id,
  userId: EVAL_USER_ID,
  checkInDate: "2026-11-01",
  checkOutDate: "2026-11-04",
  guests: 3,
  totalPrice: 3_600_000,
  status: BookingStatus.CONFIRMED,
  room: toRoomSummary(FIXTURE_ROOMS[0]),
};

export const FIXTURE_BOOKINGS: Booking[] = [
  FIXTURE_EXISTING_BOOKING,
  FIXTURE_FAMILY_BOOKING,
];
