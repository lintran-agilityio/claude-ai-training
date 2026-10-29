import { auth } from "@clerk/nextjs/server";

import { getMyBookings } from "@/features/booking/services";
import {
  BookingStatus,
  type BookingFilters,
} from "@/features/booking/types/booking";
import { PREFIX_URL } from "@repo/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Real calendar day, so 2026-13-45 is ignored instead of failing the API call. */
const isValidDay = (value: string): boolean =>
  DATE_PATTERN.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const parseFilters = (searchParams: URLSearchParams): BookingFilters => {
  const roomName = searchParams.get("roomName") ?? undefined;
  const checkInDate = searchParams.get("checkInDate") ?? undefined;
  const status = searchParams.get("status")?.toLowerCase();

  return {
    roomName,
    checkInDate:
      checkInDate && isValidDay(checkInDate) ? checkInDate : undefined,
    status: Object.values(BookingStatus).find((value) => value === status),
  };
};

export async function GET(request: Request) {
  const { userId, getToken } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getToken();
  if (!accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await getMyBookings({
    via: PREFIX_URL.BACKEND,
    accessToken,
    filters: parseFilters(new URL(request.url).searchParams),
  });

  return Response.json(bookings);
}
