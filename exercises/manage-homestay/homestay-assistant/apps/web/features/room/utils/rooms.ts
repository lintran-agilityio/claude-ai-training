import { PREFIX_URL } from "@repo/types";

import { getRooms } from "@/features/room/services";
import { useRoomStore } from "@/features/room/stores/room-store";
import type { FindRoomResult, Room } from "@/features/room/types";
import { DEFAULT_ROOM_GALLERY_IMAGES } from "@/mocks/room";
import { StaticImageData } from "next/dist/shared/lib/image-external";

/**
 * Builds a short heading for findRoom chat results from applied filters.
 *
 * @param result - Parsed findRoom tool output
 * @returns Heading text for the room preview list
 */
export const buildFindRoomTitle = (result: FindRoomResult): string => {
  const parts: string[] = [];
  const { name, date, guests, level } = result;

  if (name?.trim()) {
    parts.push(`“${name.trim()}”`);
  }
  if (date?.trim()) {
    parts.push(date.trim());
  }
  if (typeof guests === "number") {
    parts.push(`${guests} guests`);
  }
  if (typeof level === "number") {
    parts.push(`level ${level}`);
  }

  if (parts.length === 0) {
    return "Room results";
  }

  return `Rooms · ${parts.join(" · ")}`;
};

export const FALLBACK_ROOM_IMAGE = DEFAULT_ROOM_GALLERY_IMAGES[0]!;

const ALLOWED_REMOTE_IMAGE_HOSTS = new Set(["images.unsplash.com"]);

export const resolveRoomImage = (
  src: string | StaticImageData | null | undefined
): string | StaticImageData => {
  if (!src) {
    return FALLBACK_ROOM_IMAGE;
  }

  if (typeof src !== "string") {
    return src;
  }

  if (src.startsWith("/")) {
    return src;
  }

  try {
    const url = new URL(src);

    if (
      url.protocol === "https:" &&
      ALLOWED_REMOTE_IMAGE_HOSTS.has(url.hostname)
    ) {
      return src;
    }
  } catch {
    return FALLBACK_ROOM_IMAGE;
  }

  return FALLBACK_ROOM_IMAGE;
};


/**
 * Records that the agent ran a room search so chat suggestions can react.
 * Deliberately does not touch the page room grid — agent search results are
 * presented in chat only.
 */
export const markAgentRoomSearch = () => {
  useRoomStore.getState().markAgentRoomSearch();
};

/**
 * Resolves room IDs against rooms already in the store, falling back to one
 * fetch when the store is empty or an id is unknown (e.g. chat opened on a
 * page that never seeded the grid).
 */
export const resolveRoomsByIds = async (roomIds: string[]): Promise<Room[]> => {
  const roomsById = new Map(
    useRoomStore.getState().rooms.map((room) => [room.id, room]),
  );

  if (roomIds.some((id) => !roomsById.has(id))) {
    const fetched = await getRooms({ via: PREFIX_URL.WEB });
    fetched?.forEach((room) => roomsById.set(room.id, room));
  }

  return roomIds
    .map((id) => roomsById.get(id))
    .filter((room): room is Room => Boolean(room));
};

export const formatRoomListSyncResult = (rooms: Room[], title?: string) =>
  title
    ? `Showed ${rooms.length} room(s) in chat (${title}).`
    : `Showed ${rooms.length} room(s) in chat.`;
