import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RoomAvailabilityOverview } from "@repo/schemas";
import { toRoomAvailabilityModelOutput } from "./check-room-availability-overview";

const room = {
  id: "r1",
  name: "Lotus Garden",
  level: 1,
  levelColor: "#E6C547",
  capacity: 2,
  description: "Quiet room",
  imageUrl: "https://example.com/a.jpg",
  availableSlots: 1,
  amenities: ["wifi"],
  pricePerNight: 100,
};

const base: RoomAvailabilityOverview = {
  date: "2026-07-16",
  checkOutDate: "2026-07-17",
  available: [room],
  summary: { total: 2, availableCount: 1, bookedCount: 1 },
};

describe("toRoomAvailabilityModelOutput", () => {
  it("exposes free rooms as id + name and marks booked as not visible without `booked`", () => {
    const { value } = toRoomAvailabilityModelOutput(base);

    assert.equal(value.bookedVisible, false);
    assert.deepEqual(value.available, [{ id: "r1", name: "Lotus Garden" }]);
    assert.equal(value.availableCount, 1);
    assert.equal(value.bookedCount, 1);
    assert.match(value.replyHint, /Never mention booked rooms/);
  });

  it("passes free room names but no guest names or booked entries, even for managers", () => {
    const { value } = toRoomAvailabilityModelOutput({
      ...base,
      booked: [
        {
          room: { ...room, id: "r2", name: "Moonlight Loft" },
          bookingId: "b1",
          guestName: "Jane Doe",
          checkInDate: "2026-07-16",
          checkOutDate: "2026-07-17",
        },
      ],
    });
    const serialized = JSON.stringify(value);

    assert.equal(value.bookedVisible, true);
    assert.ok(!serialized.includes("Jane Doe"));
    assert.ok(!serialized.includes("Moonlight Loft"));
    assert.ok(!serialized.includes("b1"));
    assert.ok(serialized.includes("Lotus Garden"));
  });
});
