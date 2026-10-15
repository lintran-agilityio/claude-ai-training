enum HitlMutationAction {
  BOOKING = "booking",
  UPDATE = "update",
  CANCELLATION = "cancellation",
};

export const BOOKING_ERRORS = {
  NOT_FOUND: "Booking not found",
  NOT_FOUND_OR_INACTIVE: "Booking not found or no longer active",
  NOT_MODIFIABLE:
    "Booking can no longer be modified — the stay has already started",
  INVALID_ID: "Invalid booking ID",
};

const buildHitlSuccessReplyRequirement = ({
  action,
  successPattern,
}: {
  action: HitlMutationAction;
  successPattern: string;
}): string =>
  `After success, send exactly ONE short sentence in the guest's language confirming the ${action} and naming result.room.name exactly once. English pattern: "${successPattern}". Do NOT repeat dates, guests, total, status, IDs, or any other HITL-card field. For failures, send one short retry-oriented sentence without repeating card details.`;

export const HITL_REPLY_SUCCESS = {
  CREATE: buildHitlSuccessReplyRequirement({
    action: HitlMutationAction.BOOKING,
    successPattern: "Your booking for {{room_name}} was successful.",
  }),
  UPDATE: buildHitlSuccessReplyRequirement({
    action: HitlMutationAction.UPDATE,
    successPattern: "Your booking for {{room_name}} was successfully updated.",
  }),
  CANCEL: buildHitlSuccessReplyRequirement({
    action: HitlMutationAction.CANCELLATION,
    successPattern: "Your booking for {{room_name}} was successfully cancelled.",
  })
};
