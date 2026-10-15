import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { AI_MODEL } from "@agent/mastra/constants";

/**
 * Rubric-based LLM judge for response-quality evals. Deliberately narrow:
 * the judge only ever answers "does every numbered rubric line hold?" — it
 * never free-scores "does this look good", which is exactly the kind of
 * flaky, unexplainable eval the brief asks to avoid. Reuses the same
 * `AI_MODEL` router the production agent resolves (see
 * `src/mastra/constants/model.ts`), so no separate provider/key is needed.
 */
const judgeVerdictSchema = z.object({
  pass: z
    .boolean()
    .describe("True only if the reply satisfies every rubric line."),
  failedRules: z
    .array(z.number().int())
    .describe(
      "1-based indices of rubric lines that did NOT hold. Empty when pass is true.",
    ),
  reason: z
    .string()
    .describe("One or two sentences citing the evidence for the verdict."),
});

export type JudgeVerdict = z.infer<typeof judgeVerdictSchema>;

const judgeAgent = new Agent({
  id: "eval-response-quality-judge",
  name: "Response Quality Judge",
  description:
    "Strict rubric grader for homestay assistant replies. Eval-only — never registered on a runtime Mastra instance.",
  instructions: [
    "You are a strict QA grader for a homestay booking chat assistant's reply.",
    "You will receive the guest's message, the assistant's reply, and a numbered rubric.",
    "Check the reply against EVERY rubric line literally and independently — do not be lenient, and do not reward a reply for being generally pleasant if it fails a specific line.",
    "Only set pass=true when ALL lines hold. List every line that failed.",
  ].join(" "),
  model: AI_MODEL,
});

export type RubricCheck = {
  userMessage: string;
  assistantReply: string;
  /** Each entry is one independently-checkable, literal criterion — not vibes. */
  rubric: string[];
};

export const gradeAgainstRubric = async ({
  userMessage,
  assistantReply,
  rubric,
}: RubricCheck): Promise<JudgeVerdict> => {
  const prompt = [
    `Guest message:\n"""${userMessage}"""`,
    `Assistant reply:\n"""${assistantReply}"""`,
    "Rubric — every line must hold for pass=true:",
    ...rubric.map((line, index) => `${index + 1}. ${line}`),
  ].join("\n\n");

  const result = await judgeAgent.generate(prompt, {
    structuredOutput: { schema: judgeVerdictSchema },
  });

  return (
    result.object ?? {
      pass: false,
      failedRules: [],
      reason: "Judge failed to return a structured verdict.",
    }
  );
};
