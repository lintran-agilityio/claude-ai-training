import { auth } from "@clerk/nextjs/server";

import { getUpcomingBookings } from "@/features/booking/services";
import type { UpcomingPeriod } from "@/features/booking/types/booking";
import { PREFIX_URL } from "@repo/types";

const PERIODS: UpcomingPeriod[] = ["today", "tomorrow", "next3days"];

export async function GET(request: Request) {
  const { userId, getToken } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getToken();
  if (!accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get("period");
  const period = PERIODS.find((p) => p === requested) ?? "today";

  const upcoming = await getUpcomingBookings({
    period,
    via: PREFIX_URL.BACKEND,
    accessToken,
  });

  return Response.json(upcoming);
}
