import { z } from "zod";
import { BookingStatus } from "@repo/types";
import {
  GET_BOOKINGS_PURPOSE_VALUES,
  UPCOMING_CHECK_IN_DAYS,
} from "@repo/constants";

export const getBookingsInputSchema = z.object({
  roomId: z.string().optional().describe("Filter by room ID"),
  roomName: z
    .string()
    .optional()
    .describe(
      "Filter by room name (case-insensitive partial match). Use this to resolve a cancel/modify target named by room — never call find_room to look up the roomId first.",
    ),
  status: z
    .enum(Object.values(BookingStatus) as [string, ...string[]])
    .optional()
    .describe("Filter by booking status"),
  onDate: z
    .string()
    .optional()
    .describe(
      "YYYY-MM-DD — return active bookings whose stay includes this date (checkIn <= onDate < checkOut). Use for show/list my bookings with a date cue (e.g. at 15 → this month's 15th) and for cancel/modify disambiguation with a date cue.",
    ),
  purpose: z
    .enum(GET_BOOKINGS_PURPOSE_VALUES)
    .optional()
    .describe(
      '"list" (or omit) for a guest-facing show/list my bookings request. "resolve" when this call only resolves the target booking for a cancel/modify/change-room workflow that has no bookingId — the booking-list card is suppressed since the HITL that follows (confirm dialog or picker) is the response.',
    ),
  // Declared after `purpose` so the web notice still sees `purpose` stream first.
  upcomingCheckIns: z
    .boolean()
    .optional()
    .describe(
      `true returns the guest's bookings checking in within the next ${UPCOMING_CHECK_IN_DAYS} days (today included) that are not yet checked in (excludes checked-in / checked-out). Use for upcoming check-ins / who is checking in soon / check-ins in the next few days. Never combine with onDate or status - the date window is computed for you.`,
    ),
});

export type GetBookingsInput = z.infer<typeof getBookingsInputSchema>;
