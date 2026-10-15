import {
  BOOKING_CANCEL_CONFIRM_PROMPT_PREFIX,
  BOOKING_CANCEL_PROMPT_PREFIX,
  BOOKING_FORM_PROMPT_PREFIX,
  BOOKING_MODIFY_PROMPT_PREFIX,
  BOOKING_STAY_PROMPT_PREFIX,
  PAGE_ROOMS_PROMPT_PREFIX,
} from "@repo/constants";

/**
 * Prompts the web app assembles itself from a button click or suggestion pill
 * rather than free-typed guest text: the bracket-tagged flow triggers
 * (`@repo/constants/prompt-tags`, "golden — do not change without a
 * coordinated FE/agent update") plus the bare `buildActionPrompt` openers
 * (`packages/utils/format.ts`, `apps/web/features/**`).
 *
 * Every one is built from a seeded room name plus UUIDs, so the LLM
 * prompt-injection detector must not screen them — their imperative,
 * bracketed shape scores as `system-override` / `injection`, and
 * `strategy: "block"` then hard-stops a core homestay action (guest clicks
 * "Book Lotus Garden Room" → `[book-form] …` → "Blocked by security filter").
 * The booking step-machine still validates every id against the API, so a
 * skipped check here does not widen what the agent will actually act on.
 */
const FIRST_PARTY_PROMPT_PREFIXES = [
  BOOKING_FORM_PROMPT_PREFIX,
  BOOKING_STAY_PROMPT_PREFIX,
  BOOKING_CANCEL_PROMPT_PREFIX,
  BOOKING_CANCEL_CONFIRM_PROMPT_PREFIX,
  BOOKING_MODIFY_PROMPT_PREFIX,
  PAGE_ROOMS_PROMPT_PREFIX,
];

/**
 * Bare (untagged) UI-action prompts — `Show booking form for <room>. roomId: …`
 * and `Show detail room for <room>. roomId: …`. The trailing `roomId:` token
 * keeps a guest sentence that merely starts the same way from matching.
 */
const FIRST_PARTY_ACTION_PROMPT =
  /^(?:Show booking form for|Show detail room for) .+\.\s*roomId:\s*\S+/i;

/** Hidden page-sync prompts (`apps/web/features/chatbot/declarative-ui/config/page-generative-ui.ts`). */
const FIRST_PARTY_PAGE_SYNC = /^Load (?:all rooms\.|rooms for \d{4}-\d{2}-\d{2}\.)/i;

export const isFirstPartyActionPrompt = (content: string): boolean => {
  const text = content.trimStart();

  return (
    FIRST_PARTY_PROMPT_PREFIXES.some((prefix) => text.startsWith(prefix)) ||
    FIRST_PARTY_ACTION_PROMPT.test(text) ||
    FIRST_PARTY_PAGE_SYNC.test(text)
  );
};
