import type {
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
  Processor,
} from "@mastra/core/processors";
import { MESSAGE_ROLE } from "@repo/constants";

type LlmPrompt = ProcessLLMRequestArgs["prompt"];
type LlmMessage = LlmPrompt[number];
type AssistantPart = Extract<LlmMessage, { role: "assistant" }>["content"][number];
type ToolPart = Extract<LlmMessage, { role: "tool" }>["content"][number];

const keepFirstOccurrence = <TPart extends AssistantPart | ToolPart>(
  parts: TPart[],
  seen: Set<string>,
) =>
  parts.filter((part) => {
    if (part.type !== "tool-call" && part.type !== "tool-result") {
      return true;
    }

    const key = `${part.type}:${part.toolCallId}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });

/**
 * Safety net for conversations whose stored history already repeats the same
 * toolCallId across assistant messages. Repeated confirmation dialogs read as
 * approvals the model has already collected, so it stops opening the HITL
 * dialog and asks in chat instead. Only the first occurrence of each call and
 * result reaches the provider; this rewrite is transient and never persists.
 *
 * A second, independent defense against the same invariant —
 * `excludeResolvedToolCalls` in `apps/agent/src/ag-ui/transcript-filters.ts`
 * — strips already-resolved tool calls from the *incoming* AG-UI transcript
 * before it reaches Mastra memory. That one guards against the transport
 * replaying a call memory already owns; this one guards the LLM-bound prompt
 * built from memory. Keep both in sync if the dedupe key (toolCallId) or the
 * "resolved" definition changes.
 */
export class DedupeToolCallsProcessor implements Processor {
  id = "dedupe-tool-calls";

  name = "Dedupe Tool Calls";

  processLLMRequest({
    prompt,
  }: ProcessLLMRequestArgs): ProcessLLMRequestResult {
    const seen = new Set<string>();
    const deduped: LlmMessage[] = [];
    let changed = false;

    for (const message of prompt) {
      if (
        message.role !== MESSAGE_ROLE.ASSISTANT &&
        message.role !== MESSAGE_ROLE.TOOL
      ) {
        deduped.push(message);
        continue;
      }

      const parts = keepFirstOccurrence(message.content, seen);

      if (parts.length === message.content.length) {
        deduped.push(message);
        continue;
      }

      changed = true;

      if (parts.length === 0) {
        continue;
      }

      deduped.push({ ...message, content: parts } as LlmMessage);
    }

    return changed ? { prompt: deduped } : undefined;
  }
}
