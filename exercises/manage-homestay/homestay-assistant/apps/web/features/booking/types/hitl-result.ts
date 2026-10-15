/**
 * CopilotKit may deliver HITL tool results as objects or JSON strings.
 */
export type HitlToolResult<T> = T | string | null | undefined;

/**
 * Shared respond() payload shape for confirm dialogs (create/modify/cancel).
 * Concrete schema result types remain preferred at modal boundaries.
 */
export type HitlConfirmDialogResult =
  | { confirmed: false; reason?: "declined" | "not_found" }
  | {
      confirmed: true;
      bookingId?: string;
      roomId?: string;
      roomName?: string;
      checkInDate?: string;
      checkOutDate?: string;
      guests?: number;
    };
