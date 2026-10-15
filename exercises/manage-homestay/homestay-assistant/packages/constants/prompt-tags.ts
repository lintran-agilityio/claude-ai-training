/**
 * Hidden / UI-action prompt tags shared by web builders and agent routing.
 * String values are golden — do not change without a coordinated FE/agent update.
 */

export const BOOKING_CANCEL_PROMPT_PREFIX = "[booking-cancel]";
export const BOOKING_CANCEL_CONFIRM_PROMPT_PREFIX = "[booking-cancel-confirm]";
export const BOOKING_MODIFY_PROMPT_PREFIX = "[booking-modify]";
/** UI: open RoomDetail booking form in chat (no availability yet). */
export const BOOKING_FORM_PROMPT_PREFIX = "[book-form]";
/** UI: submit dates/guests — full create-booking tool chain. */
export const BOOKING_STAY_PROMPT_PREFIX = "[book-stay]";
/** Hidden page sync prompt — not shown as guest chat. */
export const PAGE_ROOMS_PROMPT_PREFIX = "[page-rooms]";

/** Separates guest-facing copy from agent-only booking metadata in cancel prompts. */
export const BOOKING_CANCEL_METADATA_SEPARATOR = " || ";
