import { RunAgentInputSchema, type Message } from "@ag-ui/core";
import {
  BOOKING_CANCEL_CONFIRM_PROMPT_PREFIX,
  BOOKING_CANCEL_PROMPT_PREFIX,
  BOOKING_FORM_PROMPT_PREFIX,
  BOOKING_MODIFY_PROMPT_PREFIX,
  BOOKING_STAY_PROMPT_PREFIX,
} from "@repo/constants";

export const PROMPT_FLOW_HINTS = ["book", "modify", "cancel"] as const;
export type PromptFlowHint = (typeof PROMPT_FLOW_HINTS)[number];

const FLOW_HINT_BY_PREFIX: Record<string, PromptFlowHint> = {
  [BOOKING_STAY_PROMPT_PREFIX]: "book",
  [BOOKING_FORM_PROMPT_PREFIX]: "book",
  [BOOKING_MODIFY_PROMPT_PREFIX]: "modify",
  [BOOKING_CANCEL_PROMPT_PREFIX]: "cancel",
  [BOOKING_CANCEL_CONFIRM_PROMPT_PREFIX]: "cancel",
};

const extractText = (content: Message["content"]): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .join(" ");
};

const lastUserMessageText = (messages: Message[]): string | undefined => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === "user") return extractText(message.content);
  }
  return undefined;
};

/**
 * Best-effort, fail-open detection of which booking workflow (if any) this
 * request already commits to — used to skip irrelevant WORKFLOW_* playbook
 * sections in buildHomestayAssistantPrompt (see building-instruction.ts).
 *
 * Signal: the latest role:"user" message starts with a [book-stay]-style tag
 * (see @repo/constants/prompt-tags, "golden — do not change without a
 * coordinated FE/agent update"), e.g. a Booking Form / cancel-card submit.
 * That tag stays the "latest user message" for every step of the HITL chain
 * it kicks off (find_room → confirm_booking → create_booking, ...), since none
 * of those steps append a new role:"user" message — so this one check covers
 * the whole tagged flow, not just its first turn.
 *
 * Deliberately narrower than earlier attempted: `useHumanInTheLoop`'s
 * `respond()` (CopilotKit v2) does NOT resolve a dialog confirm/cancel click
 * by appending a role:"tool" message with a matching toolCallId to
 * `messages` — verified empirically (a modify-confirm continuation's last
 * "tool" message was still an older find_booking_by_id result, not
 * confirm_modify_booking). So a free-text-initiated flow with no tag (the
 * common case for MODIFY/CANCEL today) gets no hint at any point, including
 * after the guest confirms a dialog — full prompt throughout, same as before
 * this mechanism existed. Only tag-initiated flows benefit.
 *
 * Reads the raw request body directly (via RunAgentInputSchema, the AG-UI
 * wire contract this runtime is built on) rather than waiting for Mastra's
 * own input processors, which only run AFTER instructions() has already been
 * resolved for this call — too late to shrink this turn's system prompt.
 *
 * Any parse failure or unmatched tag silently returns undefined — callers
 * must treat that as "full prompt", never as an error condition.
 */
export const detectPromptFlowHint = async (
  request: Request,
): Promise<PromptFlowHint | undefined> => {
  try {
    const body: unknown = await request.clone().json();
    const parsed = RunAgentInputSchema.safeParse(body);
    if (!parsed.success) return undefined;

    const text = lastUserMessageText(parsed.data.messages as Message[]);
    if (!text) return undefined;

    const prefix = Object.keys(FLOW_HINT_BY_PREFIX).find((tag) =>
      text.startsWith(tag),
    );
    return prefix ? FLOW_HINT_BY_PREFIX[prefix] : undefined;
  } catch {
    return undefined;
  }
};
