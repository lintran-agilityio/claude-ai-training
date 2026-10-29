import { fetchResilient, getBaseUrl } from "@/utils";
import type {
  UpcomingBookingsResponse,
  UpcomingPeriod,
} from "@/features/booking/types/booking";
import { PREFIX_URL } from "@repo/types";
import { ROUTES } from "@repo/constants";

type GetUpcomingBookingsProps = {
  period?: UpcomingPeriod;
  via?: PREFIX_URL;
  /** Clerk JWT — required when calling Nest (`PREFIX_URL.BACKEND`). */
  accessToken?: string;
  signal?: AbortSignal;
};

export const getUpcomingBookings = async ({
  period = "today",
  via = PREFIX_URL.WEB,
  accessToken,
  signal,
}: GetUpcomingBookingsProps = {}): Promise<UpcomingBookingsResponse> => {
  const baseUrl = getBaseUrl(via);
  const headers: HeadersInit = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetchResilient(
    `${baseUrl}${ROUTES.UPCOMING_BOOKINGS}?period=${period}`,
    { cache: "no-store", headers, signal },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch upcoming bookings");
  }

  return (await response.json()) as UpcomingBookingsResponse;
};
