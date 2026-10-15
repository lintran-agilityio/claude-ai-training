import { ROUTES } from "@repo/constants";

import { PREFIX_URL } from "@repo/types";
import { fetchResilient, getBaseUrl } from "@/utils";

import type {
  CheckRoomAvailabilityInput,
  CheckRoomAvailabilityResult,
} from "@/features/booking/types/availability";

type CheckRoomAvailabilityProps = CheckRoomAvailabilityInput & {
  via?: PREFIX_URL;
};

export const checkRoomAvailability = async ({
  via = PREFIX_URL.WEB,
  roomId,
  checkInDate,
  checkOutDate,
  guests,
  excludeBookingId,
}: CheckRoomAvailabilityProps): Promise<CheckRoomAvailabilityResult> => {
  const params = new URLSearchParams({
    roomId,
    checkInDate,
    checkOutDate,
  });
  if (guests != null) {
    params.set("guests", String(guests));
  }
  if (excludeBookingId) {
    params.set("excludeBookingId", excludeBookingId);
  }
  const baseUrl = getBaseUrl(via);
  const response = await fetchResilient(
    `${baseUrl}${ROUTES.BOOKING_AVAILABILITY}?${params}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Failed to check room availability");
  }

  return (await response.json()) as CheckRoomAvailabilityResult;
};
