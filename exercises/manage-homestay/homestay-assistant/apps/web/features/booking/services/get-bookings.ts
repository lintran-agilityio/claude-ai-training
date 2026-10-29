import { fetchResilient, getBaseUrl } from "@/utils";
import {
  BookingStatus,
  type BookingFilters,
  type BookingResponse,
} from "@/features/booking/types/booking";
import { PREFIX_URL } from "@repo/types";
import { ROUTES } from "@repo/constants";

type GetMyBookingsProps = {
  via?: PREFIX_URL;
  /** Clerk JWT — required when calling Nest (`PREFIX_URL.BACKEND`). */
  accessToken?: string;
  signal?: AbortSignal;
  filters?: BookingFilters;
};

/** Only filters that can target past or cancelled stays lift the active-only default. */
const needsHistory = ({ status, checkInDate }: BookingFilters): boolean =>
  Boolean(checkInDate) ||
  status === BookingStatus.CANCELLED ||
  status === BookingStatus.CHECKED_OUT;

/**
 * Query string for GET /bookings. The API enum is uppercase while the web enum
 * is lowercase, so status is uppercased here. A check-in date, Cancelled or
 * Checked-out also sets includeHistory so those bookings can be found.
 */
export const buildBookingsQuery = (filters: BookingFilters = {}): string => {
  const params = new URLSearchParams();
  const roomName = filters.roomName?.trim();

  if (roomName) params.set("roomName", roomName);
  if (filters.checkInDate) params.set("checkInDate", filters.checkInDate);
  if (filters.status) params.set("status", filters.status.toUpperCase());
  if (needsHistory(filters)) params.set("includeHistory", "true");

  const query = params.toString();
  return query ? `?${query}` : "";
};

export const getMyBookings = async ({
  via = PREFIX_URL.WEB,
  accessToken,
  signal,
  filters,
}: GetMyBookingsProps = {}): Promise<BookingResponse[]> => {
  const baseUrl = getBaseUrl(via);
  const headers: HeadersInit = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetchResilient(
    `${baseUrl}${ROUTES.BOOKINGS}${buildBookingsQuery(filters)}`,
    {
      cache: "no-store",
      headers,
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch bookings");
  }

  return (await response.json()) as BookingResponse[];
};
