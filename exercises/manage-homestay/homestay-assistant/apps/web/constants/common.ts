export const HITL_DECISION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
} as const;

export const FLOW_KEY = {
  BOOK: "book-flow",
  CANCEL: "cancel-flow",
  MODIFY: "modify-flow",
} as const;
