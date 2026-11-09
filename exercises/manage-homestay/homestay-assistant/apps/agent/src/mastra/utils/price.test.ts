import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computePriceBreakdown } from "./price";

const base = {
  pricePerNight: 500_000,
  capacity: 4,
  checkInDate: "2026-11-20",
  checkOutDate: "2026-11-23",
};

describe("computePriceBreakdown", () => {
  it("adds extra-guest surcharge, cleaning fee and tax", () => {
    const r = computePriceBreakdown({ ...base, guests: 4 });
    assert.equal(r.nights, 3);
    assert.equal(r.roomSubtotal, 1_500_000);
    assert.equal(r.extraGuestSurcharge, 600_000);
    assert.equal(r.total, Math.round((1_500_000 + 600_000 + 150_000) * 1.08));
  });

  it("charges no surcharge within base occupancy", () => {
    assert.equal(computePriceBreakdown({ ...base, guests: 2 }).extraGuestSurcharge, 0);
  });

  it("rejects invalid range and over-capacity", () => {
    assert.throws(() => computePriceBreakdown({ ...base, guests: 2, checkOutDate: base.checkInDate }));
    assert.throws(() => computePriceBreakdown({ ...base, guests: 5 }));
  });
});
