import { z } from "zod";

/**
 * Canonical room shape returned by Mastra tools and passed into FE HITL / render cards.
 * Keep amenities as string[] so API values never fail FE Zod while icons stay UI-local.
 */
export const roomSchema = z.object({
  id: z.string().describe("Unique room identifier"),
  name: z.string().describe("Room display name"),
  level: z.number().describe("Floor level number"),
  levelColor: z
    .string()
    .describe("Hex color for the level accent bar, e.g. #E6C547"),
  capacity: z.number().describe("Maximum number of people"),
  description: z.string().describe("Short room description"),
  imageUrl: z.string().describe("URL of the room image"),
  availableSlots: z.number().describe("Number of available booking slots"),
  amenities: z.array(z.string()).describe("List of room amenities"),
  pricePerNight: z.number().describe("Price per night in VND"),
});

export type Room = z.infer<typeof roomSchema>;
