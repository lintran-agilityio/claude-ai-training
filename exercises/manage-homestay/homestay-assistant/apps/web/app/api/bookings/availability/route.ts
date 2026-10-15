import { auth } from "@clerk/nextjs/server";

import { checkRoomAvailability } from "@/features/booking/services";
import { PREFIX_URL } from "@repo/types";

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");
  const checkInDate = searchParams.get("checkInDate");
  const checkOutDate = searchParams.get("checkOutDate");
  const guestsParam = searchParams.get("guests");
  const excludeBookingId = searchParams.get("excludeBookingId") ?? undefined;
  const guests =
    guestsParam != null && guestsParam !== ""
      ? Number(guestsParam)
      : undefined;

  if (!roomId || !checkInDate || !checkOutDate) {
    return Response.json(
      { error: "roomId, checkInDate, and checkOutDate are required" },
      { status: 400 },
    );
  }

  if (
    guests != null &&
    (!Number.isInteger(guests) || guests < 1)
  ) {
    return Response.json(
      { error: "guests must be a positive integer when provided" },
      { status: 400 },
    );
  }

  const result = await checkRoomAvailability({
    via: PREFIX_URL.BACKEND,
    roomId,
    checkInDate,
    checkOutDate,
    guests,
    excludeBookingId,
  });

  return Response.json(result);
}
