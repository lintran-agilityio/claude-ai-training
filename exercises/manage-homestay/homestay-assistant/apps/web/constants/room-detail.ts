import type { Amenity } from "@/features/room/types/room";

/** Static display values for room detail UI (not backed by API). */
export const ROOM_DETAIL_STATIC_RATING = 4.9;
export const ROOM_DETAIL_STATIC_REVIEW_COUNT = 124;

export type AmenityHighlight = {
  title: string;
  description: string;
};

export const AMENITY_HIGHLIGHTS: Record<Amenity, AmenityHighlight> = {
  monitor: {
    title: "Monitor",
    description: "Workspace display",
  },
  coffee: {
    title: "Complimentary",
    description: "Coffee & refreshments",
  },
  mic: {
    title: "Microphone",
    description: "Clear audio ready",
  },
  wifi: {
    title: "High-speed Wi‑Fi",
    description: "Stay connected",
  },
  video: {
    title: "Video ready",
    description: "Conference friendly",
  },
  whiteboard: {
    title: "Whiteboard",
    description: "Plan and collaborate",
  },
  phone: {
    title: "Phone",
    description: "Business calls ready",
  },
};

export const ROOM_DETAIL_VARIANT = {
  PAGE: "page",
  CHAT_BOOKING: "chat-booking",
} as const;

export type RoomDetailVariant =
  (typeof ROOM_DETAIL_VARIANT)[keyof typeof ROOM_DETAIL_VARIANT];

export const ROOM_DETAIL_ENTRY_MODE = {
  VIEW: "view",
  BOOK: "book",
} as const;

export type RoomDetailEntryMode =
  (typeof ROOM_DETAIL_ENTRY_MODE)[keyof typeof ROOM_DETAIL_ENTRY_MODE];
