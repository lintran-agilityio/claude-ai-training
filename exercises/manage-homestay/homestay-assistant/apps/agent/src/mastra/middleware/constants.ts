import { THREAD_METADATA_BLOCKED_MESSAGE_IDS } from "@repo/constants";

export const REQUEST_CONTEXT_KEYS = {
  AUTH: "auth",
  BLOCKED_MESSAGE_IDS: THREAD_METADATA_BLOCKED_MESSAGE_IDS,
  /**
   * Confirmed stay from confirm_modify_booking confirmed:true — used to override
   * update_booking args when the model fills stale dates.
   */
  PENDING_UPDATE_STAY: "pendingUpdateStay",
  /**
   * Confirmed stay from confirm_booking confirmed:true — used to override
   * create_booking args when the model fills stale dates.
   */
  PENDING_CREATE_STAY: "pendingCreateStay",
  /**
   * Booking id from show_cancel_dialog_confirm confirmed:true — used to override
   * cancel_booking args when the model fills a stale id from an earlier turn.
   */
  PENDING_CANCEL_BOOKING_ID: "pendingCancelBookingId",
  /**
   * Booking id from show_modify_dialog_select confirmed:true — used to override
   * find_booking_by_id args when the model fills a stale id from an earlier turn.
   */
  PENDING_MODIFY_BOOKING_ID: "pendingModifyBookingId",
  /**
   * requestedCheckInDate/requestedCheckOutDate/requestedGuests captured from
   * the guest's own show_modify_dialog_select call (the picker for an
   * ambiguous MODIFY match) — carried across the HITL pick pause so the
   * forced find_booking_by_id call that follows confirmed:true doesn't
   * depend on the model re-stating them several tool-calls later, several
   * turns removed from the guest's original wording. See step-machine's
   * pinModifyBookingId.
   */
  PENDING_MODIFY_REQUESTED_FIELDS: "pendingModifyRequestedFields",
  /**
   * Optional {checkInDate, checkOutDate} pinned before get_room_by_id forces
   * open the Booking Form for a named-room BOOK resolution — sourced
   * deterministically from the latest dated find_room (search/recommend)
   * earlier in the conversation, so the form prefills that date instead of
   * defaulting to today. Guest can still edit it before booking.
   */
  PENDING_BOOKING_FORM_STAY_HINT: "pendingBookingFormStayHint",
  /**
   * Deterministic check-in date (YYYY-MM-DD) computed server-side from a
   * relative cue (today/tonight/tomorrow/weekend/next weekend/last weekend) in
   * the guest's own latest message this step — re-pinned before every step by
   * BookingFormPrefillProcessor. Models cannot reliably do this calendar math
   * (observed hallucinating "this weekend" to an arbitrary wrong year); when
   * present, find_room overrides whatever `date` the model attached with this
   * value instead of trusting it, for search/recommend/book_resolve/resolve
   * alike. Undefined when the latest message states no such relative cue (an
   * explicit absolute date, or a follow-up turn with no restated cue, is left
   * to the model / continuity hints).
   */
  PENDING_RELATIVE_CHECKIN: "pendingRelativeCheckIn",
  /**
   * {rooms, language} — the rooms of the latest search/recommend find_room in
   * the conversation (exactly the Room List cards the guest sees) plus the
   * guest's latest-message language. Re-pinned before every step by
   * CompareRoomsCandidatesProcessor so compare_rooms builds its RoomComparison
   * from those rooms instead of anything the model supplies.
   */
  PENDING_COMPARE_ROOMS: "pendingCompareRooms",
  /**
   * Vestigial: {roomId, checkInDate, guests} pin from the old CREATE flow that
   * forced check_room_availability(flow=create). Since that tool was removed
   * (availability is probed inside find_room(book_resolve)), nothing sets or
   * reads this anymore — kept only so historical request-context payloads stay
   * parseable. Safe to drop in a later cleanup.
   */
  PENDING_CREATE_CANDIDATE: "pendingCreateCandidate",
  /**
   * Deterministic workflow hint ('book' | 'modify' | 'cancel') detected from
   * the incoming request's own [book-stay]/[book-form]/[booking-cancel]/
   * [booking-modify] tag (see @repo/constants/prompt-tags and
   * detectPromptFlowHint) — read by buildHomestayAssistantPrompt to skip the
   * OTHER workflow playbook sections that tag guarantees are irrelevant this
   * turn. Undefined for any untagged/free-text message — full prompt, no
   * behavior change.
   */
  PROMPT_FLOW_HINT: "promptFlowHint",
  /**
   * Browser-asserted identity forwarded via CopilotKit v2 `properties` (flat
   * AG-UI `forwardedProps.userId` / `.locale` / `.fullName`), already
   * reconciled against the verified Clerk token in the request pipeline (see
   * middleware/client-identity.ts). Advisory display data — name / locale —
   * layered on top of the verified AUTH context; never an authorization signal.
   * Undefined for any request that did not carry a well-formed, matching identity.
   */
  CLIENT_IDENTITY: "clientIdentity",
  /**
   * Whether the guest's own latest message stated ANY cheap/expensive/
   * amenities ranking wording or a numeric price ceiling (see
   * hasStatedRoomRankingCue) — re-pinned before every step by
   * BookingFormPrefillProcessor. find_room's `strict: true` has no effect on
   * this OpenAI tool-calling path (Mastra only honors it for the separate
   * structured-output response_format, not function tools — see
   * findRoomTool), so nothing stops gpt-4o-mini from attaching a `sortBy` /
   * `maxPrice` to a plain browse request ("show available rooms") despite the
   * prompt saying not to. findRoomTool drops an uncorroborated sortBy/maxPrice
   * before it reaches the rooms API.
   */
  PENDING_RANKING_CUE: "pendingRankingCue",
  /**
   * Whether the guest's own latest message stated ANY check-in date cue (see
   * hasStatedCheckInCue) — re-pinned before every step by
   * BookingFormPrefillProcessor, and echoed by find_room as `dateStated`.
   *
   * Exists because the prompt itself tells the model to pass `date` = CURRENT
   * DATE today for any "available" browse with no stated date (see WORKFLOW —
   * FIND / FILTER). Once echoed on the result, that auto-filled today is
   * indistinguishable from a date the guest actually gave — so a later BOOK
   * turn read it back through Date continuity as an established check-in and
   * booked/probed dates the guest never chose. This flag is what makes the two
   * distinguishable one turn later.
   */
  PENDING_CHECKIN_CUE: "pendingCheckInCue",
} as const;

export const CLERK_TOKEN_HEADER = "x-clerk-token";

/** Guest-facing 401 messages from middleware auth (JWT / userId validation). */
export const AUTH_ERRORS = {
  REQUIRED: "Authentication required",
  TOKEN_EXPIRED: "Token expired",
  INVALID_TOKEN: "Invalid token",
  INVALID_USER: "Invalid user",
} as const;

export type AuthErrorMessage = (typeof AUTH_ERRORS)[keyof typeof AUTH_ERRORS];

export const AUTH_ERROR_MESSAGES: ReadonlySet<string> = new Set(
  Object.values(AUTH_ERRORS),
);
