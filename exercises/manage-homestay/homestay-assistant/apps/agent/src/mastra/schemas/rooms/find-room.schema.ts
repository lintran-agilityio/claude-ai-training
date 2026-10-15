import { z } from "zod";
import { findRoomInputSchema as findRoomInputBaseSchema } from "@repo/schemas";

import { normalizeFindRoomInput } from "@/mastra/utils/room";

/**
 * Mastra inputSchema — sanitize name/date together so a date cue stuffed into
 * `name` (e.g. "show available room at 16th") is recovered before fillers strip
 * the ordinal.
 */
export const findRoomInputSchema = findRoomInputBaseSchema.transform((input) =>
  normalizeFindRoomInput(input),
);

export type FindRoomInput = z.infer<typeof findRoomInputSchema>;

export {
  findRoomOutputSchema,
  findRoomAvailabilitySchema,
  type FindRoomOutput,
  type FindRoomAvailability,
} from "./find-room-output.schema";
