import { ROUTES } from "@repo/constants";
import { PREFIX_URL } from "@repo/types";
import { sanitizeBookingId } from "@repo/utils";

import type { BookingResponse } from "@/features/booking/types/booking";
import { fetchResilient, getBaseUrl } from "@/utils";

type CancelBookingProps = {
  bookingId: string;
  via?: PREFIX_URL;
  /** Clerk JWT — required when calling Nest (`PREFIX_URL.BACKEND`). */
  accessToken?: string;
};

export const cancelBookingById = async ({
  bookingId,
  via = PREFIX_URL.WEB,
  accessToken,
}: CancelBookingProps): Promise<BookingResponse> => {
  const id = sanitizeBookingId(bookingId);

  if (!id) {
    throw new Error("Booking ID is required.");
  }

  const baseUrl = getBaseUrl(via);
  const headers: HeadersInit = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetchResilient(
    `${baseUrl}${ROUTES.BOOKINGS}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      cache: "no-store",
      headers,
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
      error?: string;
    } | null;

    const message =
      (typeof body?.message === "string" && body.message) ||
      (Array.isArray(body?.message) && body.message.join(", ")) ||
      body?.error ||
      "Failed to cancel booking";

    throw new Error(message);
  }

  return (await response.json()) as BookingResponse;
};
