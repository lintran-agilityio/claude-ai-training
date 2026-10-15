import { getRooms } from "@/features/room/services";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  const rooms = await getRooms({
    date: date ?? undefined
  });

  return Response.json(rooms);
}
