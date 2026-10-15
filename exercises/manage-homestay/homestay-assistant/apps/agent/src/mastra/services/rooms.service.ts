import { ROUTES } from "@repo/constants";
import { roomSchema, type Room } from "@repo/schemas";
import { formatTodayYmd, isAbortError } from "@repo/utils";
import {
  roomsListResponseSchema,
  type FindRoomInput,
  type FindRoomOutput,
} from "@/mastra/schemas/rooms";
import { get, ApiError, type ApiRequestContext } from "@/mastra/services/common";

export type RoomServiceContext = ApiRequestContext;

/**
 * Fetches all rooms from the API, falling back to today's availability on failure.
 *
 * @returns All rooms, or rooms available today when the unfiltered call fails
 */
export const getRooms = async (
  serviceContext?: RoomServiceContext,
): Promise<Room[]> => {
  try {
    return await get(`${ROUTES.ROOMS}`, roomsListResponseSchema, {
      errorMessage: "Failed to fetch rooms",
      requestContext: serviceContext?.requestContext,
      abortSignal: serviceContext?.abortSignal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    // Older API returned 404 "No rooms found" for empty filters — treat as
    // empty. Any other failure (401/5xx/network error) must surface, not be
    // disguised as "no rooms today".
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
    const today = formatTodayYmd();
    const { rooms } = await findRooms({ date: today }, serviceContext);
    return rooms;
  }
};

/**
 * Searches and filters rooms by name, date, guests, and/or level.
 * Guest count matches capacity >= guests (not exact equality).
 * Empty matches return `{ rooms: [] }` (never throw) so chat tool UI can complete.
 *
 * @param filters - Optional search/filter criteria
 * @returns Matching rooms plus the filters that were applied
 */
export const findRooms = async (
  filters: FindRoomInput = {},
  serviceContext?: RoomServiceContext,
): Promise<FindRoomOutput> => {
  const { name, date, guests, level, purpose, sortBy, maxPrice } = filters;
  // purpose is UI/agent metadata only — never send it to the rooms API.
  // sortBy/maxPrice ARE sent — the Nest rooms API applies them server-side
  // (RoomsRepository.applyRoomRanking) so the returned set is already
  // filtered/sorted; the agent is a thin passthrough here.
  const applied = {
    name: name?.trim() || undefined,
    date: date?.trim() || undefined,
    guests,
    level,
    sortBy,
    maxPrice,
  };
  const withPurpose = { ...applied, purpose };

  try {
    const rooms = await get(`${ROUTES.ROOMS}`, roomsListResponseSchema, {
      searchParams: applied,
      errorMessage: "Failed to find rooms",
      requestContext: serviceContext?.requestContext,
      abortSignal: serviceContext?.abortSignal,
    });

    return {
      rooms: rooms || [],
      ...withPurpose,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    // Older API returned 404 "No rooms found" for empty filters — treat as empty.
    if (error instanceof ApiError && error.status === 404) {
      return { rooms: [], ...withPurpose };
    }
    throw error;
  }
};

/**
 * Fetches a single room by id.
 *
 * @param roomId - Room identifier
 * @returns Room detail
 */
export const getRoom = async (
  roomId: string,
  serviceContext?: RoomServiceContext,
): Promise<Room> =>
  get(`${ROUTES.ROOMS}/${roomId}`, roomSchema, {
    errorMessage: "Failed to fetch room",
    requestContext: serviceContext?.requestContext,
    abortSignal: serviceContext?.abortSignal,
  });
