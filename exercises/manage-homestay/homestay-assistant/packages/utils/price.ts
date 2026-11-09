/** Guests included in the nightly rate. */
export const BASE_OCCUPANCY = 2;
/** Surcharge per extra guest per night (VND). */
export const EXTRA_GUEST_FEE_PER_NIGHT = 100_000;
/** Flat cleaning fee per stay (VND). */
export const CLEANING_FEE = 150_000;
/** Tax (VAT) applied to room + surcharge + cleaning. */
export const TAX_RATE = 0.08;

export type PriceBreakdown = {
  nights: number;
  roomSubtotal: number;
  extraGuests: number;
  extraGuestSurcharge: number;
  cleaningFee: number;
  taxRate: number;
  tax: number;
  total: number;
};

/**
 * Single source of truth for a stay's price — used by the API (stored
 * totalPrice), the agent's calculate_price tool and the confirm card.
 */
export const computePriceBreakdown = (args: {
  pricePerNight: number;
  nights: number;
  guests: number;
}): PriceBreakdown => {
  const { pricePerNight, nights, guests } = args;
  const roomSubtotal = nights * pricePerNight;
  const extraGuests = Math.max(0, guests - BASE_OCCUPANCY);
  const extraGuestSurcharge = extraGuests * EXTRA_GUEST_FEE_PER_NIGHT * nights;
  const taxable = roomSubtotal + extraGuestSurcharge + CLEANING_FEE;
  const tax = Math.round(taxable * TAX_RATE);

  return {
    nights,
    roomSubtotal,
    extraGuests,
    extraGuestSurcharge,
    cleaningFee: CLEANING_FEE,
    taxRate: TAX_RATE,
    tax,
    total: taxable + tax,
  };
};
