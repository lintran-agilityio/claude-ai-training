import { z } from "zod";

import { FIND_BOOKINGS_PURPOSE_VALUES } from "@repo/constants";

export const findBookingsInputSchema = z.object({
  purpose: z
    .enum(FIND_BOOKINGS_PURPOSE_VALUES)
    .optional()
    .describe(
      'Which workflow is resolving the target: "cancel", "modify", or "change_room". ALWAYS pass this. It gates dateFrom/dateTo (see below) — omitting it is treated as non-cancel, so any dateFrom/dateTo you send is dropped.',
    ),
  roomName: z
    .string()
    .trim()
    .min(1, "roomName cannot be empty")
    .optional()
    .describe("Optional case-insensitive partial room-name match"),
  dateFrom: z
    .string()
    .optional()
    .describe(
      "YYYY-MM-DD — with dateTo, return only active bookings whose stay overlaps [dateFrom, dateTo). Only ever applied when purpose is \"cancel\" — set together when the guest's cancel message states an explicit calendar date or weekend cue disambiguating WHICH booking to cancel (e.g. 'this weekend', 'next weekend', 'on Aug 15'), so a mismatched date reports not_found instead of resolving an unrelated booking. For purpose \"modify\"/\"change_room\" these are silently ignored even if set — never populate them there, including for a relative extend/shorten amount ('one more night', 'one more day', 'extend 2 nights'), which is a requested CHANGE, not a date cue (it belongs on requestedCheckOutDeltaDays for find_booking_by_id instead). Omit both when no explicit calendar date/weekend cue is stated.",
    ),
  dateTo: z
    .string()
    .optional()
    .describe(
      "YYYY-MM-DD — exclusive end of the range with dateFrom. See dateFrom.",
    ),
});

export type FindBookingsInput = z.infer<typeof findBookingsInputSchema>;
