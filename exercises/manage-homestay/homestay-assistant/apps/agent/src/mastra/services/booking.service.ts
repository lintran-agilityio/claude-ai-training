import { z } from "zod";

import { BookingStatus } from "@repo/types";
import {
  isAbortError,
  isTimeInFuture,
  isTimeTodayOrLater,
  sanitizeBookingId,
} from "@repo/utils";
import type {
  CreateBookingInput,
  FindBookingsInput,
  UpdateBookingInput,
} from "@repo/schemas";
import {
  bookingSchema,
  bookingResolutionSchema,
  checkRoomAvailabilityResponseSchema,
  type Booking,
  type BookingResolution,
  type FindBookingByIdOutput,
} from "@/mastra/schemas/booking";
import {
  ROUTES,
  TOOL_PURPOSE,
  type FindBookingByIdPurpose,
} from "@repo/constants";
import {
  get,
  post,
  del,
  update,
  assertClerkTokenForApi,
  ApiError,
} from "@/mastra/services/common";
import type { RequestContext } from "@mastra/core/request-context";
import { getRoom } from "@/mastra/services/rooms.service";
import { BOOKING_ERRORS } from "@/mastra/constants/messages";

export type ServiceContext = {
  requestContext?: RequestContext;
  abortSignal?: AbortSignal;
};

export type CreateBookingPayload = CreateBookingInput;
export type UpdateBookingPayload = Omit<UpdateBookingInput, "bookingId"> & {
  bookingId: string;
};
export type GetBookingsParams = {
  roomId?: string;
  /** Case-insensitive partial room-name match — resolves a cancel/modify target without a prior find_room call. */
  roomName?: string;
  status?: BookingStatus;
  /** YYYY-MM-DD — stays where checkIn <= onDate < checkOut */
  onDate?: string;
};

export const createBooking = async (
  booking: CreateBookingPayload,
  serviceContext?: ServiceContext,
): Promise<Booking> => {
  assertClerkTokenForApi(serviceContext?.requestContext);
  return post(
    ROUTES.BOOKINGS,
    booking,
    bookingSchema,
    "Failed to create booking",
    serviceContext,
  );
};

export const getBookings = async (
  params?: GetBookingsParams,
  serviceContext?: ServiceContext,
): Promise<Booking[]> => {
  assertClerkTokenForApi(serviceContext?.requestContext);
  return get(ROUTES.BOOKINGS, z.array(bookingSchema), {
    searchParams: params,
    errorMessage: "Failed to fetch bookings",
    requestContext: serviceContext?.requestContext,
    abortSignal: serviceContext?.abortSignal,
  });
};

/** Resolve zero, one, or many active bookings without asking the model to count. */
export const findBookings = async (
  params: FindBookingsInput = {},
  serviceContext?: ServiceContext,
): Promise<BookingResolution> => {
  assertClerkTokenForApi(serviceContext?.requestContext);
  return get(ROUTES.FIND_BOOKINGS, bookingResolutionSchema, {
    searchParams: params,
    errorMessage: "Failed to find bookings",
    requestContext: serviceContext?.requestContext,
    abortSignal: serviceContext?.abortSignal,
  });
};

export type CheckRoomAvailabilityApiInput = {
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  excludeBookingId?: string;
};

export const checkRoomAvailability = async (
  input: CheckRoomAvailabilityApiInput,
  serviceContext?: ServiceContext,
) =>
  get(ROUTES.BOOKING_AVAILABILITY, checkRoomAvailabilityResponseSchema, {
    searchParams: input,
    errorMessage: "Failed to check room availability",
    abortSignal: serviceContext?.abortSignal,
  });

export const updateBooking = async (
  input: UpdateBookingPayload,
  serviceContext?: ServiceContext,
): Promise<Booking> => {
  const { checkInDate, checkOutDate, guests } = input;
  assertClerkTokenForApi(serviceContext?.requestContext);
  const bookingId = sanitizeBookingId(input.bookingId);
console.log("=== UPDATE BOOKING ===", bookingId, input)
  const res = update(
    `${ROUTES.BOOKINGS}/${encodeURIComponent(bookingId)}`,
    {
      ...(checkInDate !== undefined
        ? { checkInDate }
        : {}),
      ...(checkOutDate !== undefined
        ? { checkOutDate: checkOutDate }
        : {}),
      ...(guests !== undefined ? { guests: guests } : {}),
    },
    bookingSchema,
    "Failed to update booking",
    serviceContext,
  );
console.log("=== UPDATE BOOKING ===", res)
  return res;
};

export const cancelBooking = async (
  bookingId: string,
  serviceContext?: ServiceContext,
): Promise<Booking> => {
  assertClerkTokenForApi(serviceContext?.requestContext);
  return del(
    `${ROUTES.BOOKINGS}/${encodeURIComponent(sanitizeBookingId(bookingId))}`,
    bookingSchema,
    "Failed to cancel booking",
    serviceContext,
  );
};

const toCancellationSummary = (booking: Booking) => ({
  bookingId: booking.id,
  roomId: booking.roomId,
  roomName: booking.room?.name ?? "",
  checkInDate: booking.checkInDate,
  checkOutDate: booking.checkOutDate,
  guests: booking.guests,
  totalPrice: booking.totalPrice,
});

export const isActiveBooking = (booking: Booking) => {
  const status = booking.status.toUpperCase();

  if (status === BookingStatus.CANCELLED) {
    return false;
  }

  if (status !== BookingStatus.PENDING && status !== BookingStatus.CONFIRMED) {
    return false;
  }

  return isTimeTodayOrLater(booking.checkOutDate);
};

/**
 * True for an active booking whose stay has not started yet. Once check-in
 * arrives, the stay is in progress (or over) and dates/guests can no longer
 * be modified — only cancellation is allowed.
 */
export const isModifiableBooking = (booking: Booking) =>
  isActiveBooking(booking) && isTimeInFuture(booking.checkInDate);

const loadOwnedBooking = async (
  bookingId: string,
  serviceContext?: ServiceContext,
): Promise<Booking> => {
  assertClerkTokenForApi(serviceContext?.requestContext);
  const id = sanitizeBookingId(bookingId);

  if (!id) {
    throw new Error(BOOKING_ERRORS.NOT_FOUND);
  }

  try {
    return await get<Booking>(
      `${ROUTES.BOOKINGS}/${encodeURIComponent(id)}`,
      bookingSchema,
      {
        errorMessage: "Failed to load booking",
        requestContext: serviceContext?.requestContext,
        abortSignal: serviceContext?.abortSignal,
      },
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    // Only a genuine 404 means "no such booking" — a 401/5xx/network failure
    // is a real outage and must surface as such, not be misreported as
    // not-found (the guest would be told their booking doesn't exist).
    if (error instanceof ApiError && error.status === 404) {
      throw new Error(BOOKING_ERRORS.NOT_FOUND);
    }
    throw error;
  }
};

/**
 * Load a booking owned by the signed-in user (Nest scopes by JWT) and ensure
 * it is still active (not cancelled / past checkout). Used before cancel.
 */
export const assertOwnedActiveBooking = async (
  bookingId: string,
  serviceContext?: ServiceContext,
): Promise<Booking> => {
  const booking = await loadOwnedBooking(bookingId, serviceContext);

  if (!isActiveBooking(booking)) {
    throw new Error(BOOKING_ERRORS.NOT_FOUND_OR_INACTIVE);
  }

  return booking;
};

/**
 * Load a booking owned by the signed-in user and ensure it can still be
 * modified: active AND check-in has not started yet. Used before update.
 */
export const assertOwnedModifiableBooking = async (
  bookingId: string,
  serviceContext?: ServiceContext,
): Promise<Booking> => {
  const booking = await loadOwnedBooking(bookingId, serviceContext);

  if (!isModifiableBooking(booking)) {
    throw new Error(BOOKING_ERRORS.NOT_MODIFIABLE);
  }

  return booking;
};

/**
 * Look up a single owned booking. `purpose: "modify"` additionally requires
 * the stay not to have started yet — an already-checked-in booking comes
 * back empty with `reason: "not_modifiable"` so callers can never resolve an
 * edit form for it (deterministic gate; not left to prompt instructions).
 */
export const findBookingById = async (
  bookingId: string,
  serviceContext?: ServiceContext,
  purpose: FindBookingByIdPurpose = TOOL_PURPOSE.FIND_BOOKING_BY_ID.CANCEL,
): Promise<FindBookingByIdOutput> => {
  assertClerkTokenForApi(serviceContext?.requestContext);
  const id = sanitizeBookingId(bookingId);

  if (!id) {
    return { bookings: [], bookingId: "", queryName: "" };
  }

  try {
    const booking = await get<Booking>(
      `${ROUTES.BOOKINGS}/${encodeURIComponent(id)}`,
      bookingSchema,
      {
        errorMessage: "Failed to find booking by id",
        requestContext: serviceContext?.requestContext,
        abortSignal: serviceContext?.abortSignal,
      },
    );

    if (!isActiveBooking(booking)) {
      return { bookings: [], bookingId: id, queryName: "" };
    }

    if (
      purpose === TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY &&
      !isModifiableBooking(booking)
    ) {
      return {
        bookings: [],
        bookingId: id,
        queryName: "",
        reason: "not_modifiable",
      };
    }

    const summary = toCancellationSummary(booking);
    const room = await getRoom(booking.roomId, serviceContext);

    return {
      bookings: [summary],
      bookingId: id,
      queryName: summary.roomName,
      room,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    // A genuine 404 means no such booking. Any other failure (401/5xx/network)
    // is a real outage — report it distinctly via `reason: "lookup_failed"`
    // rather than the same empty result as not-found, so the guest hears
    // "please try again" instead of "that booking doesn't exist".
    if (error instanceof ApiError && error.status === 404) {
      return { bookings: [], bookingId: id, queryName: "" };
    }
    return { bookings: [], bookingId: id, queryName: "", reason: "lookup_failed" };
  }
};
