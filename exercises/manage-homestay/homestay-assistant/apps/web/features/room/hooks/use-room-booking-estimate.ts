import { useMemo } from "react";

import {
  countNightOfDates,
  formatPrice,
  isCheckOutAfterCheckIn,
} from "@repo/utils";

type UseRoomBookingEstimateArgs = {
  checkInDate: string | null;
  checkOutDate: string | null;
  pricePerNight: number | null | undefined;
  guests: number;
  capacity: number;
};

export const useRoomBookingEstimate = ({
  checkInDate,
  checkOutDate,
  pricePerNight,
  guests,
  capacity,
}: UseRoomBookingEstimateArgs) => {
  const hasValidDateRange =
    checkInDate != null &&
    checkOutDate != null &&
    isCheckOutAfterCheckIn(checkInDate, checkOutDate);

  const canProceed =
    hasValidDateRange &&
    pricePerNight != null &&
    guests >= 1 &&
    guests <= capacity;

  const estimatedTotal = useMemo(() => {
    if (!canProceed || !pricePerNight || !checkInDate || !checkOutDate) {
      return null;
    }

    return formatPrice(
      countNightOfDates(checkInDate, checkOutDate) * pricePerNight,
    );
  }, [canProceed, checkInDate, checkOutDate, pricePerNight]);

  return { hasValidDateRange, canProceed, estimatedTotal };
};
