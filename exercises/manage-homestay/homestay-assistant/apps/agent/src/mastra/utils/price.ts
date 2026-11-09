import {
  computePriceBreakdown as computeBreakdown,
  countNightOfDates,
  isCheckOutAfterCheckIn,
  type PriceBreakdown,
} from "@repo/utils";

/**
 * Validates the stay, then delegates to the shared price calculation. Throws
 * on an invalid date range or when guests exceed room capacity so the guest
 * never sees a bogus quote.
 */
export const computePriceBreakdown = (args: {
  pricePerNight: number;
  capacity: number;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
}): PriceBreakdown => {
  const { pricePerNight, capacity, checkInDate, checkOutDate, guests } = args;

  if (!isCheckOutAfterCheckIn(checkInDate, checkOutDate)) {
    throw new Error("checkOutDate must be after checkInDate");
  }
  if (guests > capacity) {
    throw new Error(`Room capacity is ${capacity} guests`);
  }

  return computeBreakdown({
    pricePerNight,
    guests,
    nights: countNightOfDates(checkInDate, checkOutDate),
  });
};
