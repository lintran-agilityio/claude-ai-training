import type { Room } from "@/features/room/types/room";
import { PREFIX_URL } from "@repo/types";
import { fetchResilient, getBaseUrl } from "@/utils";
import { ROUTES } from "@repo/constants";

type GetRoomsProps = {
  via?: PREFIX_URL;
  date?: string;
};

export const getRooms = async ({
  via = PREFIX_URL.BACKEND,
  date,
}: GetRoomsProps = {}): Promise<Room[] | undefined> => {
  const path = date
    ? `${ROUTES.ROOMS}?date=${encodeURIComponent(date)}`
    : ROUTES.ROOMS;
  const baseUrl = getBaseUrl(via);
  console.log("[API REQUEST]", {
    baseUrl,
    apiConfigured: Boolean(process.env.API_URL),
  });

  console.error(
    "GET_ROOMS",
    `[getRooms] via=${via}, baseUrl=${baseUrl}, path=${path}`,
  );
  try {
    const response = await fetchResilient(`${baseUrl}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();

      console.error("[API ERROR]", {
        status: response.status,
        body,
      });
      throw new Error("Failed to fetch rooms");
    }

    return (await response.json()) as Room[];
  } catch (error) {
    console.error("========== API ERROR ==========");
    console.error("[getRooms] FAILED:", error);
  }
};
