/** Canonical screen.name values — must match HomestayAgentContext JSON from the web app. */
export const HOMESTAY_AGENT_SCREEN = {
  HOME: "home",
  ROOM_DETAIL: "room-detail",
  BOOKING_FORM: "booking-form",
  BOOKINGS: "bookings",
} as const;

export const HOMESTAY_AGENT_SCREEN_NAMES = [
  HOMESTAY_AGENT_SCREEN.HOME,
  HOMESTAY_AGENT_SCREEN.ROOM_DETAIL,
  HOMESTAY_AGENT_SCREEN.BOOKING_FORM,
  HOMESTAY_AGENT_SCREEN.BOOKINGS,
] as const;

export type HomestayAgentScreenName =
  (typeof HOMESTAY_AGENT_SCREEN)[keyof typeof HOMESTAY_AGENT_SCREEN];

/** Canonical task.type values — must match HomestayAgentContext JSON from the web app. */
export const HOMESTAY_AGENT_TASK_TYPE = {
  DISCOVER: "discover",
  BOOK: "book",
  CANCEL: "cancel",
  MANAGE: "manage",
} as const;

export type HomestayAgentTaskType =
  (typeof HOMESTAY_AGENT_TASK_TYPE)[keyof typeof HOMESTAY_AGENT_TASK_TYPE];

/** Canonical task.status values — must match HomestayAgentContext JSON from the web app. */
export const HOMESTAY_AGENT_TASK_STATUS = {
  IDLE: "idle",
  IN_PROGRESS: "in-progress",
  AWAITING_CONFIRMATION: "awaiting-confirmation",
  COMPLETED: "completed",
} as const;

export type HomestayAgentTaskStatus =
  (typeof HOMESTAY_AGENT_TASK_STATUS)[keyof typeof HOMESTAY_AGENT_TASK_STATUS];

const SCREEN_NAMES_PROMPT = HOMESTAY_AGENT_SCREEN_NAMES.join(" | ");

export const HOMESTAY_AGENT_CONTEXT_READABLE_DESCRIPTION =
  `HomestayAgentContext: screen.name (${SCREEN_NAMES_PROMPT}), optional focus (room|booking + id), optional task (discover|book|cancel|manage + status). Match tools/replies to this context; never invent focus ids. Relative stay dates are resolved from the separate Current Date agent context (today/tomorrow), not from prior chat turns.`;

export const HOMESTAY_AGENT_CONTEXT_PROMPT_SECTION = `## HOMESTAY AGENT CONTEXT
The frontend injects HomestayAgentContext as JSON. Use \`screen.name\` only — do not infer location from legacy booleans (e.g. isBookingsPage).
- \`home\` — room grid / discover. Treat the Room Grid as current context: do not re-ask for stay fields (dates, guests, filters) already known from the latest message, working memory, or this context.
- \`room-detail\` — viewing a specific room (\`focus.type\` room + id when set)
- \`booking-form\` — booking or modify draft UI open (\`task.type\` often book)
- \`bookings\` — reservations list (\`task.type\` often manage)
Optional \`focus\` and \`task\` refine intent. Align tool choice and chat handoffs with this context.`;
