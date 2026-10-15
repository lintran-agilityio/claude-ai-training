import { auth } from "@clerk/nextjs/server";

import { getMyBookings } from "@/features/booking/services";
import { PREFIX_URL } from "@repo/types";

export async function GET() {
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
  });

  return Response.json(bookings);
}
