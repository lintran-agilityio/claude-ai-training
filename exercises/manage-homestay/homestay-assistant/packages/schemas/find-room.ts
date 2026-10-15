import { z } from "zod";
import { FIND_ROOM_PURPOSE_VALUES, FIND_ROOM_SORT_VALUES } from "@repo/constants";

/**
 * Why find_room was called — drives chat UI (Room List vs suppress) and replyHint.
 * Default / omit = search (always show Room List when matches exist).
 */
export const findRoomPurposeSchema = z
  .enum(FIND_ROOM_PURPOSE_VALUES)
  .optional()
  .describe(
    'search = FIND/filter ("find/show Misty Pavilion") — Room List always. recommend = soft-book without a named room — Room List. book_resolve = BOOK name lookup ("I want to book Misty Pavilion for 1 guest this weekend") — pass name to match the room, PLUS date/guests when the latest message states them (never used to filter the name match — they seed the tool\'s own availability probe of the resolved room and let the platform decide the next step: skip the Booking Form and go to confirm_booking when both are known and the room is free, render BookingUnavailable when it is taken, open the form otherwise); skip Room List when exactly 1 match, show list when >1, and continue the booking flow with the matched room id. There is no check_room_availability tool. resolve = internal room-name → roomId lookup for cancel/modify without a bookingId (e.g. "modify guest number for Moonlight Loft") — pass name only; Room List always suppressed regardless of match count; use the single match\'s id as get_bookings.roomId, or ask which room when there is more than one match. Never use book_resolve or resolve for find/show/tell-me-about.',
  );

/**
 * Base find_room args shared by Mastra validation and FE useRenderTool.
 * Agent may wrap `name` with a sanitize transform — do not add that here.
 *
 * `purpose` is deliberately the FIRST property: gpt-4o-mini (strict mode)
 * streams tool-call args in schema order, and the chat renderer
 * (`FindRoomNotice`) reads `purpose` off the partial stream to decide whether
 * to paint the Room List skeleton. Keeping it first means an internal
 * `book_resolve` / `resolve` lookup is identified before that skeleton can
 * flash between the search and the Booking Form / Confirm card.
 */
export const findRoomInputSchema = z.object({
  purpose: findRoomPurposeSchema,
  name: z
    .string()
    .optional()
    .describe(
      "Partial room NAME only (e.g. Moonlight, Heritage). Never pass weekdays, months, or calendar words (Mon, Monday, Aug, today, weekend) — those belong in date. Never pass category words like luxury, premium, top-floor, suite — those use level instead. Soft-book without a room title → omit name.",
    ),
  date: z
    .string()
    .optional()
    .describe(
      "Check-in date as absolute YYYY-MM-DD only. Resolve today/tonight/tomorrow/weekend from CURRENT DATE before calling — never pass the words today, tomorrow, or weekend. A stay-LENGTH phrase alone ('in 4 nights', 'for 4 nights', '4 nights', 'in 3 days') is NOT a check-in date and must never be turned into one — never pass CURRENT DATE + N. Omit date entirely when the message states no actual date cue, even when it states a stay length; put that length in nights instead.",
    ),
  nights: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Stay LENGTH in nights, when the guest states one ('4 nights' → 4, 'for a week' → 7, '3 đêm' → 3). This says how LONG the stay is, never WHEN it starts — pass the count as-is and NEVER convert it into a check-in or check-out date yourself; the platform computes check-out as check-in + nights. Independent of date: a message may state nights with no date (omit date, the Booking Form collects it), a date with no nights (omit nights, one night is assumed), or both. Omit entirely when no stay length was stated — never invent one.",
    ),
  guests: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Party size (guest count). Matches rooms with capacity >= guests — NOT exact capacity equality. Pass the party size as stated; never require capacity === guests.",
    ),
  level: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Room floor level. Use level: 4 for luxury / premium / top-floor / penthouse requests — do not put those words in name.",
    ),
  sortBy: z
    .enum(FIND_ROOM_SORT_VALUES)
    .optional()
    .describe(
      'Ranking order for the matched rooms. cheapest = price ascending ("cheapest room", "most affordable rooms", "best price"). most_expensive = price descending ("most expensive room", "priciest rooms"). most_amenities = amenity count descending, ties broken by price ascending ("rooms with the most amenities"). Omit for a plain search with no ranking wording. Ignored for book_resolve / resolve lookups.',
    ),
  maxPrice: z
    .number()
    .positive()
    .optional()
    .describe(
      'Price ceiling in VND — only when the guest states a numeric budget/cap (e.g. "under 1,000,000", "below 500k", "max 2 million"). Matches rooms with pricePerNight <= maxPrice. Independent of sortBy: "affordable rooms under 1M" sets BOTH sortBy: "cheapest" AND maxPrice: 1000000. Never invent a number the guest did not state. Ignored for book_resolve / resolve lookups.',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Max number of rooms to return. Pass the exact count when the guest states one ("find me 3 rooms", "the 3 cheapest rooms" → limit: 3). Singular ranking phrasing ("the cheapest room", "what is the cheapest room?") → limit: 1. Plural ranking phrasing with no stated count ("the most affordable rooms", "cheapest rooms") → omit; the tool defaults to the top 5 automatically. Omit entirely for a plain search with no count or ranking wording. Trims both the chat cards and the compare candidates to the top matches. Ignored for book_resolve / resolve lookups.',
    ),
});

export type FindRoomInput = z.infer<typeof findRoomInputSchema>;
export type FindRoomPurpose = NonNullable<FindRoomInput["purpose"]>;
