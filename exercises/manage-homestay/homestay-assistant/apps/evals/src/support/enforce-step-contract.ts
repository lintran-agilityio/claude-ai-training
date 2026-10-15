import { evalite } from "evalite";

import type { MastraDBMessage } from "@mastra/core/agent";
import type { ProcessInputStepArgs } from "@mastra/core/processors";
import { RequestContext } from "@mastra/core/request-context";
import { TOOL_KEYS } from "@repo/constants";

import { enforceBookingStep } from "@agent/mastra/utils/step-machine";

import { scoreResult } from "./checks";
import type { StepOutcome } from "./step-contract";

/**
 * End-to-end harness for the booking step machine's `prepareStep` entry point.
 *
 * `step-contract.ts` drives `resolveEnforcedTransition` — the pure decision — so
 * it proves the routing TABLE. It cannot prove the machine ever reads a real
 * tool result, and that gap hid a total outage: `enforceBookingStep` routed off
 * `args.steps.at(-1)?.toolResults.at(-1)`, but on @mastra/core 1.43 every step
 * object handed to `prepareStep` arrives with `content: []` (and `toolResults`
 * is just a getter over `content`), so the trailing step was `null` on EVERY
 * step and no backend junction ever fired. The deterministic suite stayed 100%
 * green the whole time.
 *
 * These cases therefore feed `enforceBookingStep` the args shape the real
 * runtime hands it — a populated turn transcript next to `steps[]` entries whose
 * `toolResults` are empty — and assert the emitted Mastra envelope
 * (`toolChoice` / `activeTools`), not the internal decision.
 */

/** One settled tool result, as the turn transcript carries it. */
export type TranscriptToolResult = {
  toolName: string;
  input?: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type EnforceStepCase = {
  name: string;
  /** The turn's settled tool results, oldest → newest. */
  transcript: TranscriptToolResult[];
  expected: StepOutcome;
  /**
   * Build the turn the way the live runtime hands it over after a guest
   * answered a HITL card, instead of as hand-written clean JSON — see
   * {@link liveTurnMessages}.
   */
  liveMessageShape?: boolean;
};

/**
 * A `steps[]` entry exactly as @mastra/core 1.43 hands it to `prepareStep`:
 * `content` empty, so the `toolResults` getter yields `[]`. Included so these
 * cases fail the moment anything starts routing off `args.steps` again.
 */
const emptyMastraStep = () => ({
  content: [] as unknown[],
  get toolResults() {
    return this.content.filter(
      (part) => (part as { type?: string })?.type === "tool-result",
    );
  },
});

/** `role:"user"` turn opener — `getCurrentTurn` slices from the last one. */
const userMessage = (text: string): MastraDBMessage =>
  ({
    id: "eval-user-msg",
    role: "user",
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: "text", text }] },
  }) as unknown as MastraDBMessage;

/** Assistant message carrying one settled `tool-invocation` part. */
const toolResultMessage = (
  result: TranscriptToolResult,
  index: number,
): MastraDBMessage =>
  ({
    id: `eval-tool-msg-${index}`,
    role: "assistant",
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            state: "result",
            toolCallId: `eval-call-${index}`,
            toolName: result.toolName,
            args: result.input ?? {},
            result: result.output,
          },
        },
      ],
    },
  }) as unknown as MastraDBMessage;

/** Frontend HITL tools — their result reaches Mastra as an AG-UI `tool` message. */
const HITL_TOOL_NAMES: ReadonlySet<string> = new Set([
  TOOL_KEYS.ACTION.CONFIRM_BOOKING,
  TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
  TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
  TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM,
  TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
]);

/**
 * The turn exactly as @mastra/core 1.43 hands it to `prepareStep` once the guest
 * has answered a HITL card through CopilotKit (captured from the real
 * getCopilotkitAgents → MastraAgent bridge):
 *   - the continuation is merged into the ONE stored assistant message, so every
 *     settled part of the turn sits in a single `content.parts` array;
 *   - each `tool-invocation` part carries `step: undefined`, the key the AG-UI
 *     `tool` message is converted with;
 *   - a HITL result is the raw `tool` message content — a JSON string;
 *   - the user message carries `toolInvocations: undefined`.
 *
 * Fixture JSON never holds an `undefined` value, which is how a strict JSON
 * narrowing that rejected the whole message on that key passed every clean-shape
 * case: the step machine went blind after the first guest click — the modify
 * picker/edit form never led to `confirm_modify_booking`, and the unguided model
 * reopened the picker or even called `cancel_booking` on another booking.
 */
const liveTurnMessages = (transcript: TranscriptToolResult[]): MastraDBMessage[] => [
  {
    id: "eval-user-msg",
    role: "user",
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: "text", text: "I want to modify my booking" }],
      toolInvocations: undefined,
    },
  } as unknown as MastraDBMessage,
  {
    id: "eval-live-assistant-msg",
    role: "assistant",
    createdAt: new Date(),
    content: {
      format: 2,
      parts: transcript.map((result, index) => ({
        type: "tool-invocation",
        toolInvocation: {
          state: "result",
          step: undefined,
          toolCallId: `eval-call-${index}`,
          toolName: result.toolName,
          args: result.input ?? {},
          result: HITL_TOOL_NAMES.has(result.toolName)
            ? JSON.stringify(result.output)
            : result.output,
        },
      })),
    },
  } as unknown as MastraDBMessage,
];

/** Every tool the machine can force, so `hasTool` never short-circuits a case. */
const ALL_TOOLS: Record<string, unknown> = Object.fromEntries(
  [
    ...Object.values(TOOL_KEYS.BOOKING),
    ...Object.values(TOOL_KEYS.ACTION),
    ...Object.values(TOOL_KEYS.GET),
  ].map((toolName) => [toolName, {}]),
);

export const runEnforceStep = ({
  transcript,
  liveMessageShape,
}: EnforceStepCase): StepOutcome => {
  const args = {
    stepNumber: transcript.length,
    steps: transcript.map(() => emptyMastraStep()),
    messages: liveMessageShape
      ? liveTurnMessages(transcript)
      : [
          userMessage("I want to modify my booking"),
          ...transcript.map(toolResultMessage),
        ],
    tools: ALL_TOOLS,
    requestContext: new RequestContext(),
  } as unknown as ProcessInputStepArgs;

  const envelope = enforceBookingStep(args);
  if (!envelope) return "pass";

  const { toolChoice } = envelope as {
    toolChoice?: "none" | { type: string; toolName: string };
  };
  if (toolChoice === "none") return "stop";
  if (toolChoice && typeof toolChoice === "object") {
    return `force:${toolChoice.toolName}`;
  }
  return "pass";
};

/** Registers one evalite block over a list of `enforceBookingStep` cases. */
export const enforceStepEval = (name: string, cases: EnforceStepCase[]) =>
  evalite<EnforceStepCase, StepOutcome, StepOutcome>(name, {
    data: () =>
      cases.map((testCase) => ({ input: testCase, expected: testCase.expected })),
    task: (input) => runEnforceStep(input),
    scorers: [
      {
        name: "prepareStep emits the documented envelope",
        scorer: ({ input, output, expected }) =>
          scoreResult(
            output === expected,
            `${input.name} — expected "${expected}", got "${output}"`,
          ),
      },
    ],
    columns: ({ input, output }) => [
      { label: "Turn", value: input.name },
      { label: "Envelope", value: output },
      {
        label: "Transcript",
        value: input.transcript.map((step) => step.toolName).join(" → "),
      },
    ],
  });
