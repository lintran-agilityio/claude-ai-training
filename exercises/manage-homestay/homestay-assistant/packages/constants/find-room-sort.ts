/**
 * `sortBy` values for find_room ranking requests ("cheapest", "most
 * affordable", "most expensive", "most amenities"). This is a different axis
 * from `TOOL_PURPOSE.FIND_ROOM` (why the tool was called) — it's how the
 * matched rooms should be ordered — so it lives in its own file rather than
 * tool-purposes.ts, whose header comment scopes it specifically to `purpose`
 * values for find_room/get_bookings/find_booking_by_id.
 */
export const FIND_ROOM_SORT = {
  /** price ascending — "cheapest", "most affordable", "best price". */
  CHEAPEST: "cheapest",
  /** price descending — "most expensive", "priciest", "highest price". */
  MOST_EXPENSIVE: "most_expensive",
  /** amenities.length descending, ties broken by price ascending — "most amenities", "best equipped". */
  MOST_AMENITIES: "most_amenities",
} as const;

export type FindRoomSort = (typeof FIND_ROOM_SORT)[keyof typeof FIND_ROOM_SORT];

/** zod `.enum()` needs a non-empty tuple — derived from FIND_ROOM_SORT so the values never drift apart. */
export const FIND_ROOM_SORT_VALUES = Object.values(
  FIND_ROOM_SORT,
) as [FindRoomSort, ...FindRoomSort[]];

/**
 * Cap applied when a ranking `sortBy` is requested with no explicit count
 * ("the most affordable rooms", "cheapest rooms"). Singular phrasing ("the
 * cheapest room") and an explicit count ("the 3 cheapest rooms") must still
 * be expressed via `limit` by the model itself (see intent-playbook.ts) —
 * this constant only backstops the unspecified-plural case.
 */
export const DEFAULT_SORT_LIMIT = 5;
