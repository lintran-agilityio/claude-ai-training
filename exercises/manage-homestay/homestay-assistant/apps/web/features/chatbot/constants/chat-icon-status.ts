/**
 * Closed-chat toggle status kinds.
 * Single source of truth for resolve + render switch cases.
 */
export const CHAT_ICON_STATUS = {
  IDLE: "idle",
  UNREAD: "unread",
  PROCESSING: "processing",
  TYPING: "typing",
  COMPLETED: "completed",
} as const;

export type ChatIconStatusKind =
  (typeof CHAT_ICON_STATUS)[keyof typeof CHAT_ICON_STATUS];
