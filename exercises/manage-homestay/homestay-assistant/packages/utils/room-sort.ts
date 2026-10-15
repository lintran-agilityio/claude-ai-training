import { FIND_ROOM_SORT, type FindRoomSort } from "@repo/constants";

export type SortableRoom = {
  name: string;
  pricePerNight?: number;
  amenities: readonly unknown[];
};

const byNameAsc = (a: SortableRoom, b: SortableRoom): number =>
  a.name.localeCompare(b.name);

/** Missing price always sorts last, regardless of direction. */
const comparePrice = (
  a: SortableRoom,
  b: SortableRoom,
  direction: 1 | -1,
): number => {
  if (a.pricePerNight == null && b.pricePerNight == null) return 0;
  if (a.pricePerNight == null) return 1;
  if (b.pricePerNight == null) return -1;
  return direction * (a.pricePerNight - b.pricePerNight);
};

/**
 * Ranks rooms by price or amenity count, mirroring find_room's `sortBy`.
 *
 * The rooms API (`apps/api` RoomsRepository) is the source of truth — it
 * applies this same ordering server-side. This is a defensive client-side
 * re-sort so the FE never renders an out-of-order list even if an
 * intermediate layer (the agent's passthrough, a cache, a future API
 * regression) returns rooms out of order. Deterministic, always fully
 * tie-broken; never mutates the input.
 */
export const sortRooms = <T extends SortableRoom>(
  rooms: T[],
  sortBy?: FindRoomSort,
): T[] => {
  if (!sortBy) {
    return rooms;
  }

  switch (sortBy) {
    case FIND_ROOM_SORT.CHEAPEST:
      return [...rooms].sort(
        (a, b) => comparePrice(a, b, 1) || byNameAsc(a, b),
      );
    case FIND_ROOM_SORT.MOST_EXPENSIVE:
      return [...rooms].sort(
        (a, b) => comparePrice(a, b, -1) || byNameAsc(a, b),
      );
    case FIND_ROOM_SORT.MOST_AMENITIES:
      return [...rooms].sort(
        (a, b) =>
          b.amenities.length - a.amenities.length ||
          comparePrice(a, b, 1) ||
          byNameAsc(a, b),
      );
    default:
      return rooms;
  }
};
