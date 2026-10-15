/**
 * Extraction over Mastra's `FullOutput`/`LLMStepResult`. Both the top-level
 * `result.toolCalls` and each `result.steps[i].toolCalls` are
 * `ToolCallChunk[]` (`@mastra/core` stream types) — a chunk envelope
 * (`{ type: 'tool-call', payload: { toolCallId, toolName, args, ... } }`),
 * not a bare `{toolName, args}` record — so extraction always unwraps
 * `chunk.payload`. Kept local instead of importing the real types so eval
 * files don't couple to `@mastra/core`'s internal stream type paths.
 *
 * `extractToolCalls` runs once, inside `run-case.ts`, over the raw agent
 * result. Every eval file works with the already-extracted `EvalToolCall[]`
 * on `CaseResult.toolCalls` — the helpers below (`toolCallArgs`, etc.) take
 * that extracted list, not a raw result.
 */
export type EvalToolCall = {
  toolCallId: string;
  toolName: string;
  args: unknown;
};

type ToolCallChunkLike = {
  payload?: {
    toolCallId?: string;
    toolName?: string;
    args?: unknown;
  };
};

type StepLike = { toolCalls?: ToolCallChunkLike[] };
type RawAgentResult = {
  steps?: StepLike[];
  toolCalls?: ToolCallChunkLike[];
};

const toEvalToolCall = (chunk: ToolCallChunkLike): EvalToolCall | null => {
  const toolName = chunk.payload?.toolName;
  if (!toolName) return null;
  return {
    toolCallId: chunk.payload?.toolCallId ?? "",
    toolName,
    args: chunk.payload?.args,
  };
};

/** Tool calls in execution order, across every step of the run. */
export const extractToolCalls = (result: RawAgentResult): EvalToolCall[] => {
  const raw =
    result.steps && result.steps.length > 0
      ? result.steps.flatMap((step) => step.toolCalls ?? [])
      : (result.toolCalls ?? []);

  return raw
    .map(toEvalToolCall)
    .filter((call): call is EvalToolCall => call !== null);
};

// --- helpers over an already-extracted EvalToolCall[] (CaseResult.toolCalls) ---

export const findToolCall = (calls: EvalToolCall[], toolName: string) =>
  calls.find((call) => call.toolName === toolName);

export const wasToolCalled = (calls: EvalToolCall[], toolName: string) =>
  calls.some((call) => call.toolName === toolName);

/** True when `before` appears earlier in the call sequence than `after`. Absent tools return false. */
export const wasCalledBefore = (
  calls: EvalToolCall[],
  before: string,
  after: string,
): boolean => {
  const names = calls.map((call) => call.toolName);
  const beforeIndex = names.indexOf(before);
  const afterIndex = names.indexOf(after);
  return beforeIndex !== -1 && afterIndex !== -1 && beforeIndex < afterIndex;
};

export const toolCallArgs = (
  calls: EvalToolCall[],
  toolName: string,
): Record<string, unknown> | undefined =>
  findToolCall(calls, toolName)?.args as Record<string, unknown> | undefined;
