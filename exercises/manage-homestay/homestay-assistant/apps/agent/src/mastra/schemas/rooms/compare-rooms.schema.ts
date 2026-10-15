import { z } from "zod";
import { ROOM_COMPARISON_MAX } from "@repo/schemas";

export const compareRoomsInputSchema = z.object({
  roomIds: z
    .array(z.string())
    .max(ROOM_COMPARISON_MAX)
    .optional()
    .describe(
      'Ids copied from the latest find_room result\'s rooms[].id — ONLY when the guest narrowed the list ("compare Moonlight and Bamboo", "the first two"). Omit for "compare these / all / the 3 rooms" to compare every room that search showed. Never pass ids from anywhere else; ids not in that search are ignored.',
    ),
});

export type CompareRoomsInput = z.infer<typeof compareRoomsInputSchema>;

/**
 * `rendered` carries the `a2ui_operations` envelope the A2UIMiddleware paints
 * (it only requires that key to be an array, so `status` / `roomCount` ride
 * along). `no_candidates` = no search/recommend find_room returned rooms yet.
 */
export const compareRoomsOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("rendered"),
    roomCount: z.number(),
    a2ui_operations: z.array(z.record(z.string(), z.unknown())),
  }),
  z.object({ status: z.literal("no_candidates") }),
]);

export type CompareRoomsOutput = z.infer<typeof compareRoomsOutputSchema>;
