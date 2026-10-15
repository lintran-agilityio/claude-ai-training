/**
 * Generic UI interaction lifecycle (presentation).
 * Active = current user turn; superseded = prior turn (actions hidden).
 */
export const GENERIC_UI_INTERACTION = {
  ACTIVE: "active",
  SUPERSEDED: "superseded",
} as const;

export type GenericUiInteraction =
  (typeof GENERIC_UI_INTERACTION)[keyof typeof GENERIC_UI_INTERACTION];
