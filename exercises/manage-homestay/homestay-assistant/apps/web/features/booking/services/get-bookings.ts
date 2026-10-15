import { fetchResilient, getBaseUrl } from "@/utils";
import type { BookingResponse } from "@/features/booking/types/booking";
import { PREFIX_URL } from "@repo/types";
import { ROUTES } from "@repo/constants";

type GetMyBookingsProps = {
  via?: PREFIX_URL;
  /** Clerk JWT — required when calling Nest (`PREFIX_URL.BACKEND`). */
  accessToken?: string;
  signal?: AbortSignal;
};

export const getMyBookings = async ({
  via = PREFIX_URL.WEB,
  accessToken,
  signal,
}: GetMyBookingsProps = {}): Promise<BookingResponse[]> => {
  const baseUrl = getBaseUrl(via);
  const headers: HeadersInit = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetchResilient(`${baseUrl}${ROUTES.BOOKINGS}`, {
    cache: "no-store",
    headers,
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch bookings");
  }

  return (await response.json()) as BookingResponse[];
};
