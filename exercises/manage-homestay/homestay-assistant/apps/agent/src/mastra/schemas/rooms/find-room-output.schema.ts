import { z } from "zod";
import { findRoomInputSchema as findRoomInputBaseSchema, roomSchema } from "@repo/schemas";

/**
 * Availability probe attached to a `book_resolve` result with exactly one
 * match, present only when the guest count is already known (stated this turn
 * or from an earlier search). `findRoomTool.execute` calls the
 * `/bookings/availability` endpoint for the resolved room so the CREATE flow
 * no longer needs a separate `check_room_availability` tool call. Absent →
 * neither guest count nor check-in date is known yet — the Booking Form opens
 * and runs its own check.
 *
 * Two shapes, depending on whether a check-in date is ALSO known:
 *   - date known: the real probe result — `checkInDate`/`checkOutDate`/
 *     `datesAvailable` are all set.
 *   - date unknown: a deterministic guest-capacity-only verdict (party size vs
 *     `room.capacity`, no API call, no invented date) — `checkInDate` /
 *     `checkOutDate` / `datesAvailable` are all absent, and `available` stays
 *     `true` (dates were never the problem, because they were never checked).
 */
export const findRoomAvailabilitySchema = z.object({
  available: z.boolean(),
  guestsWithinCapacity: z.boolean(),
  /** Absent when only guest capacity was evaluated (no check-in date yet). */
  datesAvailable: z.boolean().optional(),
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  guests: z.number(),
});

export type FindRoomAvailability = z.infer<typeof findRoomAvailabilitySchema>;

export const findRoomOutputSchema = z.object({
  rooms: z.array(roomSchema),
  name: z.string().optional(),
  date: z.string().optional(),
  guests: z.number().optional(),
  /**
   * Echoed stated stay length in nights. The BOOK step machine routes off this
   * output (not the input), so the length has to travel back out here to reach
   * the Booking Form hint and the check-out calculation.
   */
  nights: z.number().optional(),
  /**
   * Whether `date` came from a cue in the guest's own message rather than the
   * prompt's "default to today" rule for undated availability searches. Read a
   * turn later by the Date-continuity scan, which must not treat an auto-filled
   * today as a check-in the guest established.
   */
  dateStated: z.boolean().optional(),
  level: z.number().optional(),
  /** Echoed from input — ranking order actually applied to `rooms`. */
  sortBy: findRoomInputBaseSchema.shape.sortBy,
  /** Echoed from input — price ceiling actually applied to `rooms` (VND). */
  maxPrice: findRoomInputBaseSchema.shape.maxPrice,
  /** Echoed from input — FE uses this to skip Room List on book_resolve + 1 match. */
  purpose: findRoomInputBaseSchema.shape.purpose,
  /** book_resolve + exactly one match only — see findRoomAvailabilitySchema. */
  availability: findRoomAvailabilitySchema.optional(),
});

export type FindRoomOutput = z.infer<typeof findRoomOutputSchema>;
