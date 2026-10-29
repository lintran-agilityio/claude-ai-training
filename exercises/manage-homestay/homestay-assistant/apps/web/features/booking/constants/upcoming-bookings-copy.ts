import type { UpcomingPeriod } from "@/features/booking/types/booking";

export const UPCOMING_PERIODS: { value: UpcomingPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next3days", label: "Next 3 days" },
];

/** Suffix used in the per-list empty state, e.g. "No check-ins today". */
export const UPCOMING_PERIOD_PHRASE: Record<UpcomingPeriod, string> = {
  today: "today",
  tomorrow: "tomorrow",
  next3days: "in the next 3 days",
};

export const UPCOMING_BOOKINGS_COPY = {
  title: "Upcoming bookings",
  checkIns: "Check-in",
  checkOuts: "Check-out",
  emptyCheckIns: "No check-ins",
  emptyCheckOuts: "No check-outs",
  loading: "Loading...",
  error: "Could not load upcoming bookings.",
  retry: "Retry",
};
