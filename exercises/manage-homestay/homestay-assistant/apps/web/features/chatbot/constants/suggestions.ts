export type StaticSuggestion = {
  title: string;
  message: string;
};

/** Guest session signals used when no active UI focus is driving pills. */
export type SuggestionGuestState = {
  hasActiveBookings: boolean;
  hasSearchedRooms: boolean;
  bookingJustCompleted: boolean;
};

export const MAX_SUGGESTION_PILLS = 5;

/** Shared pills — title = meaning, message = concrete agent/UI action. */
export const SUGGESTION = {
  myBookings: {
    title: "My bookings",
    message: "Show my bookings.",
  },

  viewBooking: {
    title: "View bookings",
    message: "Show my bookings.",
  },

  findWeekendRooms: {
    title: "Rooms this weekend",
    message: "Find available rooms for this weekend.",
  },

  availableToday: {
    title: "Rooms available today",
    message: "Show rooms available today.",
  },

  availableTomorrow: {
    title: "Show room tomorrow",
    message: "Show rooms available tomorrow.",
  },

  showMoreRooms: {
    title: "Show more rooms",
    message: "Show me more rooms available today.",
  },

  familyRooms: {
    title: "Family rooms",
    message: "Show rooms for 4 or more guests.",
  },

  luxuryRooms: {
    title: "Luxury suites rooms",
    message: "Show your premium and luxury rooms",
  },

  cheapestRooms: {
    title: "Best price",
    message: "Show the most affordable rooms.",
  },

  roomAmenities: {
    title: "Room amenities",
    message: "What amenities do your rooms include?",
  },

  helpBooking: {
    title: "How to book",
    message: "How do I book a room?",
  },
  otherRooms: {
    title: "Other rooms",
    message: "Show me other rooms available today.",
  },
  changeDates: {
    title: "Change dates",
    message: "I want to change my stay dates.",
  },
  changeGuests: {
    title: "Change guests",
    message: "I want to change the number of guests.",
  },
  keepBooking: {
    title: "Keep booking",
    message: "Never mind, keep my booking.",
  },
  modifyBooking: {
    title: "Modify booking",
    message: "I want to change the dates or number of guests on one of my bookings.",
  },
  cancelBooking: {
    title: "Cancel booking",
    message: "I want to cancel one of my bookings.",
  },
  bookAnother: {
    title: "Book another room",
    message: "I'd like to book another room.",
  },
  helpDates: {
    title: "Help with dates",
    message: "Help me choose check-in and check-out dates.",
  },
  /** Alias of dates/guests modify — product cannot swap rooms on a booking. */
  modifyRoom: {
    title: "Change dates or guests",
    message: "I want to change the dates or number of guests on one of my bookings.",
  },
} as const satisfies Record<string, StaticSuggestion>;

export const FIRST_VISIT_SUGGESTIONS: StaticSuggestion[] = [
  SUGGESTION.findWeekendRooms,
  SUGGESTION.luxuryRooms,
  SUGGESTION.helpBooking,
  SUGGESTION.availableToday,
];

export const ACTIVE_BOOKINGS_SUGGESTIONS: StaticSuggestion[] = [
  SUGGESTION.myBookings,
  SUGGESTION.modifyRoom,
  SUGGESTION.cancelBooking,
  SUGGESTION.bookAnother,
];

export const AFTER_SEARCH_SUGGESTIONS: StaticSuggestion[] = [
  SUGGESTION.showMoreRooms,
  SUGGESTION.familyRooms,
  SUGGESTION.cheapestRooms,
  SUGGESTION.roomAmenities,
];

export const AFTER_BOOKING_SUGGESTIONS: StaticSuggestion[] = [
  SUGGESTION.viewBooking,
  SUGGESTION.bookAnother,
  SUGGESTION.modifyRoom,
  SUGGESTION.cancelBooking,
];
