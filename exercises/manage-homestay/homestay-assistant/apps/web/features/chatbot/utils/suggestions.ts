import {
  HOMESTAY_AGENT_SCREEN,
  HOMESTAY_AGENT_TASK_STATUS,
  HOMESTAY_AGENT_TASK_TYPE,
} from "@repo/constants";
import { buildBookingFormMessage } from "@/features/booking/utils";
import {
  ACTIVE_BOOKINGS_SUGGESTIONS,
  AFTER_BOOKING_SUGGESTIONS,
  AFTER_SEARCH_SUGGESTIONS,
  FIRST_VISIT_SUGGESTIONS,
  MAX_SUGGESTION_PILLS,
  SUGGESTION,
  type StaticSuggestion,
  type SuggestionGuestState,
} from "@/features/chatbot/constants/suggestions";
import type { HomestayAgentContext, HomestayAgentTaskStatus } from "@/features/chatbot/types";

const bookThisRoom = (roomId: string, roomName: string): StaticSuggestion => ({
  title: "Book this room",
  // Artifact is minted on click in SuggestionBar (avoid register-on-render).
  message: buildBookingFormMessage(roomId, roomName),
});

const openBookingForm = (roomId: string, roomName: string): StaticSuggestion => ({
  title: "Open booking form",
  message: buildBookingFormMessage(roomId, roomName),
});

const isActiveUiFocusTask = (context: HomestayAgentContext): boolean => {
  if (!context.task) {
    return false;
  }

  const { type, status } = context.task;

  if (
    type === HOMESTAY_AGENT_TASK_TYPE.BOOK ||
    type === HOMESTAY_AGENT_TASK_TYPE.CANCEL
  ) {
    return status !== HOMESTAY_AGENT_TASK_STATUS.IDLE;
  }

  return (
    type === HOMESTAY_AGENT_TASK_TYPE.MANAGE &&
    status !== HOMESTAY_AGENT_TASK_STATUS.IDLE
  );
};

const getFocusedRoomId = (context: HomestayAgentContext) =>
  context.focus?.type === "room" ? context.focus.id : undefined;

type GetBookingSuggestionsArgs = {
  status: HomestayAgentTaskStatus;
  roomId?: string;
  name: string;
};
const getBookingSuggestions = ({
  status,
  roomId,
  name,
}: GetBookingSuggestionsArgs): StaticSuggestion[] => {
  switch (status) {
    case HOMESTAY_AGENT_TASK_STATUS.AWAITING_CONFIRMATION:
      return [
        SUGGESTION.changeDates,
        SUGGESTION.changeGuests,
        SUGGESTION.otherRooms,
      ];

    case HOMESTAY_AGENT_TASK_STATUS.IN_PROGRESS:
      return [
        ...(roomId ? [openBookingForm(roomId, name)] : []),
        SUGGESTION.changeDates,
        SUGGESTION.otherRooms,
      ];

    case HOMESTAY_AGENT_TASK_STATUS.COMPLETED:
      return AFTER_BOOKING_SUGGESTIONS;

    default:
      return [SUGGESTION.availableToday, SUGGESTION.findWeekendRooms, SUGGESTION.myBookings];
  }
};

const getManageSuggestions = (status: HomestayAgentTaskStatus) => {
  switch (status) {
    case HOMESTAY_AGENT_TASK_STATUS.AWAITING_CONFIRMATION:
      return [
        SUGGESTION.changeDates,
        SUGGESTION.changeGuests,
        SUGGESTION.keepBooking,
      ];
    case HOMESTAY_AGENT_TASK_STATUS.IN_PROGRESS:
      return [
        SUGGESTION.changeDates,
        SUGGESTION.changeGuests,
        SUGGESTION.myBookings,
      ];
    case HOMESTAY_AGENT_TASK_STATUS.COMPLETED:
      return [SUGGESTION.myBookings, SUGGESTION.findWeekendRooms];
    default:
      return [SUGGESTION.myBookings, SUGGESTION.findWeekendRooms];
  }
}

/**
 * Active UI-focus pills — must match the guest's current task step.
 * Prefer concrete next actions over generic page navigation.
 * (UI focus stack only — not Mastra booking step-machine authority.)
 */
export const getUiFocusStaticSuggestions = (
  context: HomestayAgentContext,
  roomName?: string | null,
): StaticSuggestion[] => {
  if (!context.task || !isActiveUiFocusTask(context)) {
    return [];
  }

  const { type, status } = context.task;
  const roomId = getFocusedRoomId(context);
  const name = roomName?.trim() || "this room";

  switch (type) {
    case HOMESTAY_AGENT_TASK_TYPE.BOOK:
      return getBookingSuggestions({ status, roomId, name });
    case HOMESTAY_AGENT_TASK_TYPE.CANCEL:
      return [SUGGESTION.keepBooking, SUGGESTION.myBookings];
    case HOMESTAY_AGENT_TASK_TYPE.MANAGE:
      return getManageSuggestions(status);
    
    default:
      return [];
  }
};

/**
 * Idle guest-state pills — first visit / active bookings / post-search / post-booking.
 * Priority: booking just completed → after search → has bookings → first visit.
 */
export const getGuestStateStaticSuggestions = (
  guestState: SuggestionGuestState,
): StaticSuggestion[] => {
  const { hasActiveBookings, hasSearchedRooms, bookingJustCompleted } = guestState;
  if (bookingJustCompleted) {
    return AFTER_BOOKING_SUGGESTIONS;
  }

  if (hasSearchedRooms) {
    return AFTER_SEARCH_SUGGESTIONS;
  }

  if (hasActiveBookings) {
    return ACTIVE_BOOKINGS_SUGGESTIONS;
  }

  return FIRST_VISIT_SUGGESTIONS;
};

/**
 * Idle / discover page pills — primary action for the current screen + focus.
 * Home uses guest-state sets; focused screens keep room/booking-specific actions.
 */
export const getPageStaticSuggestions = (
  context: HomestayAgentContext,
  roomName?: string | null,
  guestState?: SuggestionGuestState,
): StaticSuggestion[] => {
  const roomId = getFocusedRoomId(context);
  const name = roomName?.trim() || "this room";
  const state = guestState ?? {
    hasActiveBookings: false,
    hasSearchedRooms: false,
    bookingJustCompleted: false,
  };

  switch (context.screen.name) {
    case HOMESTAY_AGENT_SCREEN.HOME:
      return getGuestStateStaticSuggestions(state);

    case HOMESTAY_AGENT_SCREEN.ROOM_DETAIL:
      if (!roomId) {
        return [SUGGESTION.myBookings];
      }

      return [
        bookThisRoom(roomId, name),
        SUGGESTION.roomAmenities,
        SUGGESTION.myBookings,
      ];

    case HOMESTAY_AGENT_SCREEN.BOOKING_FORM:
      return [
        SUGGESTION.helpDates,
        SUGGESTION.changeGuests,
      ];

    case HOMESTAY_AGENT_SCREEN.BOOKINGS:
      return state.hasActiveBookings
        ? ACTIVE_BOOKINGS_SUGGESTIONS
        : [
            SUGGESTION.findWeekendRooms,
            SUGGESTION.helpBooking,
            SUGGESTION.bookAnother,
          ];
  }
};

/** UI-focus static suggestions take precedence over guest-state / page pills. */
export const getPriorityStaticSuggestions = (
  context: HomestayAgentContext,
  roomName?: string | null,
  guestState?: SuggestionGuestState,
): StaticSuggestion[] => {
  const uiFocus = getUiFocusStaticSuggestions(context, roomName);

  // Post-booking is transient guest state, not a lasting UI-focus report —
  // still prefer it over page pills when no mid-flow focus is active.
  if (!uiFocus.length && guestState?.bookingJustCompleted) {
    return AFTER_BOOKING_SUGGESTIONS.slice(0, MAX_SUGGESTION_PILLS);
  }

  const source = uiFocus.length
    ? uiFocus
    : getPageStaticSuggestions(context, roomName, guestState);

  return source.slice(0, MAX_SUGGESTION_PILLS);
};
