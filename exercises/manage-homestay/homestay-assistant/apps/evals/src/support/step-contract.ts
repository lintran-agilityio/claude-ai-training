import { evalite } from "evalite";

import type { MastraDBMessage } from "@mastra/core/agent";
import type { ProcessInputStepArgs } from "@mastra/core/processors";
import { RequestContext } from "@mastra/core/request-context";

import { resolveEnforcedTransition } from "@agent/mastra/utils/step-machine";

import { scoreResult } from "./checks";

/**
 * Shared harness for the no-LLM step-machine routing evals under
 * `evals/homestay-assistant/deterministic/`.
 *
 * `resolveEnforcedTransition` (`src/mastra/utils/step-machine.ts`) is the
 * single decision `enforceBookingStep` calls after every tool step to pick the
 * NEXT forced tool call (or to stop the turn). `enforceBookingStep` only adds
 * Mastra plumbing on top: tool-existence validation, request-context candidate
 * pinning, and the `forceTool()` / `stopToolExecution()` envelope. Driving
 * `resolveEnforcedTransition` directly — with the exact tool-result shape each
 * tool's own output schema documents — proves the CREATE / MODIFY / CANCEL /
 * FIND-ROOM routing contract without an LLM call, without a network hop, in
 * milliseconds. The `behavioral/` suite proves a real model also honors these
 * gates end-to-end; this proves the gates themselves can never regress
 * regardless of model behavior.
 */

/**
 * Normalized form of whatever `resolveEnforcedTransition` decided:
 *   "force:<toolName>"  the step machine forces that tool as the next call
 *   "stop"              the turn ends here (no tool, `toolChoice: "none"`)
 *   "pass"              no forced transition — the model chooses freely
 */
export type StepOutcome = `force:${string}` | "stop" | "pass";

export type StepCase = {
  name: string;
  /** The just-completed tool step the step machine reacts to. */
  last: {
    toolName: string;
    input?: Record<string, unknown>;
    output: Record<string, unknown>;
  };
  /**
   * Guest's latest chat message, when the junction needs it — the BOOK
   * `find_room(book_resolve)` transition only trusts an echoed check-in /
   * guest count that is corroborated by a cue in this text (see
   * `resolveCorroboratedBookFacts` / `book-form-prefill.ts`).
   */
  latestUserText?: string;
  expected: StepOutcome;
};

/** Minimal `role:"user"` message in the shape `book-form-prefill.ts` reads. */
const userMessage = (text: string): MastraDBMessage =>
  ({
    id: "eval-user-msg",
    role: "user",
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: "text", text }] },
  }) as unknown as MastraDBMessage;

export const runStep = ({ last, latestUserText }: StepCase): StepOutcome => {
  const args = {
    messages: latestUserText ? [userMessage(latestUserText)] : [],
    // Real object: the find_room transition stashes a form stay-hint on it.
    requestContext: new RequestContext(),
  } as unknown as ProcessInputStepArgs;

  const transition = resolveEnforcedTransition(args, last);
  if (!transition) return "pass";
  return transition.type === "stop" ? "stop" : `force:${transition.toolName}`;
};

/** Registers one evalite block over a list of step-machine junction cases. */
export const stepContractEval = (name: string, cases: StepCase[]) =>
  evalite<StepCase, StepOutcome, StepOutcome>(name, {
    data: () =>
      cases.map((testCase) => ({ input: testCase, expected: testCase.expected })),
    task: (input) => runStep(input),
    scorers: [
      {
        name: "Forces the documented next step",
        scorer: ({ input, output, expected }) =>
          scoreResult(
            output === expected,
            `${input.name} — expected "${expected}", got "${output}"`,
          ),
      },
    ],
    columns: ({ input, output }) => [
      { label: "Junction", value: input.name },
      { label: "Decision", value: output },
    ],
  });
