import { HOMESTAY_AGENT_CONTEXT_PROMPT_SECTION } from "@repo/constants";
import {
  MANAGE_AGENT_INSTRUCTION_SECTIONS,
  MANAGE_AGENT_PLAYBOOK_SECTIONS,
} from "../constants/prompts/intent-playbook";
import type { PromptFlowHint } from "../middleware/prompt-flow-hint";

const joinSections = (...parts: string[]) => parts.join("\n\n");

/**
 * Workflow playbook sections gated by a confirmed PromptFlowHint (see
 * prompt-flow-hint.ts) — each list is exactly the sections that hint
 * guarantees are irrelevant this turn, based on the workflow's own
 * documented triggers (e.g. WORKFLOW_MODIFY never touches room search/browse
 * or another booking's CANCEL/LIST flow). `undefined` hint means "keep
 * everything" — the only prompt this ever produced before this change.
 */
const WORKFLOW_SECTIONS_BY_HINT: Record<
  PromptFlowHint,
  readonly (keyof typeof MANAGE_AGENT_PLAYBOOK_SECTIONS)[]
> = {
  book: ["BROWSE", "FIND", "RECOMMEND", "DETAIL", "BOOK"],
  modify: ["MODIFY"],
  cancel: ["CANCEL"],
};

const ALL_WORKFLOW_SECTIONS: readonly (keyof typeof MANAGE_AGENT_PLAYBOOK_SECTIONS)[] =
  [
    "BROWSE",
    "FIND",
    "RECOMMEND",
    "DETAIL",
    "COMPARE",
    "BOOK",
    "LIST",
    "CANCEL",
    "MODIFY",
  ];

/**
 * Assembles the homestay-assistant system prompt from the intent playbook.
 * Section order is golden — do not reorder without a regression pass. This
 * output is also the prompt-cache prefix (see `constants/prompts/PROMPT_CACHING.md`):
 * it must stay request-independent, so any new per-request/per-guest content
 * belongs in the caller's tail (`withDateContext`/`withGuestContext` in
 * `homestay-assistant.ts`), never inserted into this function's sections.
 *
 * `flowHint`, when set, comes from a request's own [book-stay]/[book-form]/
 * [booking-modify]/[booking-cancel] tag (see prompt-flow-hint.ts) — a
 * deterministic app-owned signal, never a guess — and drops the WORKFLOW_*
 * playbook sections that tag guarantees are unused this turn. Any other
 * value (including undefined, for untagged/free-text messages) keeps every
 * section, matching this function's prior always-full behavior exactly.
 */
export const buildHomestayAssistantPrompt = (
  flowHint?: PromptFlowHint,
): string => {
  const activeWorkflowSections = flowHint
    ? WORKFLOW_SECTIONS_BY_HINT[flowHint]
    : ALL_WORKFLOW_SECTIONS;

  return joinSections(
    MANAGE_AGENT_INSTRUCTION_SECTIONS.ROLE,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.CORE_PRINCIPLES,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.LANGUAGE,
    HOMESTAY_AGENT_CONTEXT_PROMPT_SECTION,
    MANAGE_AGENT_PLAYBOOK_SECTIONS.BOUNDARY,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.PRIORITY_TRIGGERS,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.TOOL_DISPATCH,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.ROUTING_RULES,
    ...ALL_WORKFLOW_SECTIONS.filter((key) => activeWorkflowSections.includes(key)).map(
      (key) => MANAGE_AGENT_PLAYBOOK_SECTIONS[key],
    ),
    MANAGE_AGENT_INSTRUCTION_SECTIONS.GENERIC_UI_RENDERING,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.TOOL_RESULTS,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.RESPOND_GREETINGS,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.SCOPE_BOUNDARY,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.BUSINESS_CONSTRAINTS,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.ERROR_HANDLING,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.CONVERSATION_RULES,
    MANAGE_AGENT_INSTRUCTION_SECTIONS.SUGGESTED_ACTIONS,
  );
};
