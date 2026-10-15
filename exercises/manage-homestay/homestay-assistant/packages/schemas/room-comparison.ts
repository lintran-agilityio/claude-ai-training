import { z } from "zod";

/** A2UI catalog id the web chat registers `RoomComparison` under. */
export const ROOM_COMPARISON_CATALOG_ID = "homestay-assistant";

/** A2UI component name of the room comparison surface. */
export const ROOM_COMPARISON_COMPONENT = "RoomComparison";

/** Most rooms one comparison lines up side by side. */
export const ROOM_COMPARISON_MAX = 4;

/** Most highlights (amenities) carried per compared room. */
export const ROOM_COMPARISON_HIGHLIGHT_MAX = 5;

/**
 * One compared room. Mirrors the canonical `Room` the chat Room List cards
 * render from, so the comparison shows the same level / capacity / image as
 * the cards above it. Price and availability arrive preformatted.
 */
export const roomComparisonRoomSchema = z.object({
  id: z.string().describe("The stable room id."),
  name: z.string().describe("The room name."),
  level: z.number().describe("Floor level number."),
  levelColor: z
    .string()
    .describe("Hex color for the level accent bar, e.g. #E6C547."),
  capacity: z.number().describe("Maximum number of guests."),
  imageUrl: z.string().describe("URL of the room image."),
  nightlyRate: z.string().describe("Preformatted nightly price."),
  availability: z.string().describe("Preformatted availability status."),
  highlights: z
    .array(z.string())
    .max(ROOM_COMPARISON_HIGHLIGHT_MAX)
    .describe("Up to five room amenities."),
});

/**
 * Props of the `RoomComparison` A2UI component. Built in code by the agent's
 * `compare_rooms` tool from the latest find_room search result (never by an
 * LLM), and rendered by the web catalog — both sides share this schema.
 */
export const roomComparisonPropsSchema = z.object({
  eyebrow: z
    .string()
    .optional()
    .describe("A short label, such as 'Your shortlisted stays'."),
  title: z.string().describe("A concise comparison heading."),
  note: z
    .string()
    .optional()
    .describe("Optional context, e.g. that the list was trimmed."),
  rooms: z
    .array(roomComparisonRoomSchema)
    .min(1)
    .max(ROOM_COMPARISON_MAX)
    .describe("One to four rooms from the guest's latest room search."),
});

export type RoomComparisonRoom = z.infer<typeof roomComparisonRoomSchema>;
export type RoomComparisonProps = z.infer<typeof roomComparisonPropsSchema>;
