/**
 * `purpose` values passed to find_room / get_bookings / find_booking_by_id.
 * Single source of truth for the string literals — Mastra input schemas,
 * Mastra-side suppression logic, and the FE Notice components all compare
 * against these instead of duplicating the raw strings.
 */
export const TOOL_PURPOSE = {
  FIND_ROOM: {
    /** FIND/filter a named room, or default/omit — Room List always shows when matches exist. */
    SEARCH: "search",
    /** Soft-book without a named room — Room List shows so the guest can pick. */
    RECOMMEND: "recommend",
    /** BOOK name lookup only — Room List skipped when exactly 1 match. */
    BOOK_RESOLVE: "book_resolve",
    /** Internal room-name -> roomId lookup for cancel/modify with no bookingId — Room List always suppressed. */
    RESOLVE: "resolve",
  },
  GET_BOOKINGS: {
    /** Guest-facing show/list my bookings request, or default/omit. */
    LIST: "list",
    /** Internal lookup for a cancel/modify/change-room workflow with no bookingId — booking-list card always suppressed. */
    RESOLVE: "resolve",
  },
  FIND_BOOKING_BY_ID: {
    /** Allows any active booking, including one already checked in. Default when omitted. */
    CANCEL: "cancel",
    /** Additionally requires the stay not to have started yet. */
    MODIFY: "modify",
  },
  FIND_BOOKINGS: {
    /** Cancel resolve — the only purpose that may carry dateFrom/dateTo (a stated calendar date/weekend cue disambiguating which booking to cancel). */
    CANCEL: "cancel",
    /** Modify resolve — dateFrom/dateTo are always stripped server-side, even if the model mistakenly attaches them (e.g. misreading a relative "one more night" extend as a date cue). */
    MODIFY: "modify",
    /** Change-room resolve — same date-range gate as MODIFY. */
    CHANGE_ROOM: "change_room",
  },
  /** purpose values passed to resolve_booking_target (in-progress replacement for find_booking_by_id). */
  RESOLVE_BOOKING_TARGET: {
    /** Allows any active booking, including one already checked in. */
    CANCEL: "cancel",
    /** Additionally requires the stay not to have started yet; may suspend for stay-change input. */
    MODIFY: "modify",
  },
} as const;

export type FindRoomPurpose =
  (typeof TOOL_PURPOSE.FIND_ROOM)[keyof typeof TOOL_PURPOSE.FIND_ROOM];
export type GetBookingsPurpose =
  (typeof TOOL_PURPOSE.GET_BOOKINGS)[keyof typeof TOOL_PURPOSE.GET_BOOKINGS];
export type FindBookingByIdPurpose =
  (typeof TOOL_PURPOSE.FIND_BOOKING_BY_ID)[keyof typeof TOOL_PURPOSE.FIND_BOOKING_BY_ID];
export type FindBookingsPurpose =
  (typeof TOOL_PURPOSE.FIND_BOOKINGS)[keyof typeof TOOL_PURPOSE.FIND_BOOKINGS];
export type ResolveBookingTargetPurpose =
  (typeof TOOL_PURPOSE.RESOLVE_BOOKING_TARGET)[keyof typeof TOOL_PURPOSE.RESOLVE_BOOKING_TARGET];

/** zod `.enum()` needs a non-empty tuple — derived from TOOL_PURPOSE so the values never drift apart. */
export const FIND_ROOM_PURPOSE_VALUES = Object.values(
  TOOL_PURPOSE.FIND_ROOM,
) as [FindRoomPurpose, ...FindRoomPurpose[]];
export const GET_BOOKINGS_PURPOSE_VALUES = Object.values(
  TOOL_PURPOSE.GET_BOOKINGS,
) as [GetBookingsPurpose, ...GetBookingsPurpose[]];
export const FIND_BOOKING_BY_ID_PURPOSE_VALUES = Object.values(
  TOOL_PURPOSE.FIND_BOOKING_BY_ID,
) as [FindBookingByIdPurpose, ...FindBookingByIdPurpose[]];
export const FIND_BOOKINGS_PURPOSE_VALUES = Object.values(
  TOOL_PURPOSE.FIND_BOOKINGS,
) as [FindBookingsPurpose, ...FindBookingsPurpose[]];
export const RESOLVE_BOOKING_TARGET_PURPOSE_VALUES = Object.values(
  TOOL_PURPOSE.RESOLVE_BOOKING_TARGET,
) as [ResolveBookingTargetPurpose, ...ResolveBookingTargetPurpose[]];
