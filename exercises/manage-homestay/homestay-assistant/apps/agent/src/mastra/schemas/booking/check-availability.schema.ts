import { z } from "zod";
import { roomSchema } from "@repo/schemas";

/**
 * Response shape of the `/bookings/availability` HTTP endpoint. Used by the
 * `checkRoomAvailability` service to validate the API response for the CREATE
 * probe (`find_room(book_resolve)`) and the MODIFY probe
 * (`find_booking_by_id(purpose:"modify")`). There is no longer a
 * `check_room_availability` agent tool.
 */
export const checkRoomAvailabilityResponseSchema = z.object({
  available: z
    .boolean()
    .describe(
      "True only when dates are free AND guests fit room.capacity (when guests were sent)",
    ),
  guestsWithinCapacity: z
    .boolean()
    .describe(
      "False when guests exceed room.capacity. Compare guests to capacity, never to availableSlots.",
    ),
  datesAvailable: z
    .boolean()
    .describe(
      "Whether the room is free for the dates alone, independent of guest count. `available` is datesAvailable && guestsWithinCapacity, so it stays false once capacity fails even when the dates themselves are free.",
    ),
  room: roomSchema,
  checkInDate: z.string(),
  checkOutDate: z.string(),
  guests: z.number().optional(),
});

export type CheckRoomAvailabilityResponse = z.infer<
  typeof checkRoomAvailabilityResponseSchema
>;
