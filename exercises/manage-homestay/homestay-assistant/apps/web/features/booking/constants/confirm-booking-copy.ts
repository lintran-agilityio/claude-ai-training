/** Shape shared by every multi-booking disambiguation picker's copy. */
export type BookingPickerCopy = {
  title: string;
  description: (queryName: string) => string;
  keepLabel: string;
  completed: {
    rejectedTitle: string;
    approvedTitle: string;
    /** Title shown when the picker settles without a clear approve/reject (supersede or missing decision). */
    expiredTitle: string;
    keptAll: (queryName: string) => string;
    multiMatch: (queryName: string) => string;
    expiredBody: (queryName: string) => string;
  };
};

/**
 * Copy workflow of HITL
 * - CREATE
 * - MODIFY
 * - CANCEL
 */
export const CONFIRM_BOOKING = {
  CREATE: {
    title: {
      review: "Please confirm your booking",
      submitting: "Creating booking…",
      success: "Booking confirmed",
      failed: "Booking failed",
      approved: "Confirmed by you",
      rejected: "Cancelled by you",
      expired: "Confirmation expired",
    },
    label: {
      confirm: "Confirm",
      cancel: "Cancel",
      submitting: "Creating booking…",
      viewBookings: "View bookings",
      retry: "Retry",
    },
    error: {
      confirm: "Failed to confirm booking",
    },
  },
  MODIFY: {
    title: {
      review: "Modify booking",
      altPending: "Confirm booking changes?",
      submitting: "Updating booking…",
      success: "Booking updated",
      failed: "Update failed",
      approved: "Changes confirmed by you",
      rejected: "Changes cancelled by you",
      expired: "Change confirmation expired",
    },
    label: {
      confirm: "Confirm Changes",
      cancel: "Cancel",
      submitting: "Updating…",
      viewBookings: "View bookings",
      retry: "Retry",
    },
    error: {
      confirm: "Failed to confirm booking changes",
    },
  },
  CANCEL: {
    title: {
      review: "Cancel this booking?",
      submitting: "Cancelling booking…",
      success: "Booking cancelled",
      failed: "Cancellation failed",
      rejected: "Kept by you",
      expired: "Confirmation expired",
    },
    label: {
      confirm: "Cancel booking",
      keep: "Keep booking",
      submitting: "Cancelling…",
      viewBookings: "View bookings",
      retry: "Retry",
    },
    error: {
      confirm: "Failed to cancel booking",
    },
  }
};

/**
 * Select options
 * - CANCEL
 * - MODIFY
 */
export const PICKER_BOOKING = {
  CANCEL: {
    title: "Which booking should be cancelled?",
    description: (queryName: string) =>
      `Multiple bookings match “${queryName}”. Select one to cancel.`,
    keepLabel: "Keep bookings",
    completed: {
      rejectedTitle: "Cancelled by you",
      approvedTitle: "Confirmed by you",
      expiredTitle: CONFIRM_BOOKING.CANCEL.title.expired,
      keptAll: (queryName: string) =>
        `You kept all bookings matching “${queryName}”.`,
      multiMatch: (queryName: string) =>
        `Multiple bookings match “${queryName}”.`,
      expiredBody: (queryName: string) =>
        `This cancellation confirmation for “${queryName}” is no longer available.`,
    },
  },
  MODIFY: {
    title: "Which booking do you want to change?",
    description: (queryName: string) =>
      `Multiple bookings match “${queryName}”. Select one to change.`,
    keepLabel: "Keep bookings",
    completed: {
      rejectedTitle: CONFIRM_BOOKING.MODIFY.title.rejected,
      approvedTitle: CONFIRM_BOOKING.MODIFY.title.approved,
      expiredTitle: CONFIRM_BOOKING.MODIFY.title.expired,
      keptAll: (queryName: string) =>
        `You left all bookings matching “${queryName}” unchanged.`,
      multiMatch: (queryName: string) =>
        `Multiple bookings match “${queryName}”.`,
      expiredBody: (queryName: string) =>
        `This change selection for “${queryName}” is no longer available.`,
    },
  }
}

/** Titles that mark ConfirmCreateHitlCard as the modify fallback layout. */
export const MODIFY_PENDING_TITLES = new Set<string>([
  CONFIRM_BOOKING.MODIFY.title.altPending,
  CONFIRM_BOOKING.MODIFY.title.review,
]);
