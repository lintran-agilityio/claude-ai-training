import { evalite } from "evalite";

import { runAgentTurn } from "../../support/agent-harness";
import { scoreResult } from "../../support/checks";
import { installFakeApi } from "../../support/fake-api";

/**
 * Regression — multi-turn context must not trip the token limiter.
 *
 * Historical bug: a tool-invocation already folded into the assistant message
 * by Mastra's internal MessageMerger, but not yet reflected in
 * `steps[].toolResults`, made the step machine re-force the same tool call
 * every step — ballooning the conversation until `TokenLimiterProcessor`
 * (`AGENT_INPUT_TOKEN_LIMIT`, `packages/constants/agent-token-limits.ts`)
 * tripped on ordinary turns. The permanent guards are `DedupeToolCallsProcessor`
 * and `excludeResolvedToolCalls` (`ag-ui/transcript-filters.ts`).
 *
 * This sends several realistic turns on ONE thread — including a repeated
 * `get_bookings` request, the exact shape that used to runaway — and asserts
 * every turn completes cleanly with a bounded step count. It intentionally does
 * NOT assert an exact token count (`TokenLimiterProcessor` throws a tripwire on
 * trip, so "every turn resolves without throwing, step counts stay bounded" is
 * the deterministic, timeless form of this guard). This is agent-level, not
 * per-tool.
 */
// Trimmed 5 turns → 3: a search, then the repeated `get_bookings` request
// (the exact shape that used to runaway the forced-tool loop). Three turns
// is enough context growth to trip the old bug while costing fewer tokens.
const MULTI_TURN_MESSAGES = [
  "Show me available rooms for 2 guests",
  "Show my bookings",
  "Show my bookings again",
] as const;

const MAX_REASONABLE_STEPS = 8;

evalite<undefined, { turns: number; maxSteps: number; error: string | null }, true>(
  "Regression — multi-turn context does not trip the token limiter",
  {
    data: () => [{ input: undefined, expected: true }],
    task: async () => {
      const fakeApi = installFakeApi();
      const threadId = `eval-regression-context-${Date.now()}`;
      let maxSteps = 0;
      let error: string | null = null;
      let turns = 0;

      try {
        for (const message of MULTI_TURN_MESSAGES) {
          const { result } = await runAgentTurn(message, { threadId });
          turns += 1;
          maxSteps = Math.max(maxSteps, result.steps?.length ?? 0);
          if (result.tripwire) {
            error = `tripwire on turn ${turns} ("${message}"): ${JSON.stringify(result.tripwire)}`;
            break;
          }
        }
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      } finally {
        fakeApi.restore();
      }

      return { turns, maxSteps, error };
    },
    scorers: [
      {
        name: "All turns completed without a tripwire/error",
        scorer: ({ output }) =>
          scoreResult(
            output.error === null && output.turns === MULTI_TURN_MESSAGES.length,
            output.error ?? `completed ${output.turns}/${MULTI_TURN_MESSAGES.length} turns`,
          ),
      },
      {
        name: "Step count per turn stayed bounded",
        description: `No single turn should need more than ${MAX_REASONABLE_STEPS} steps — a runaway forced-tool loop is exactly what this regresses against.`,
        scorer: ({ output }) =>
          scoreResult(
            output.maxSteps <= MAX_REASONABLE_STEPS,
            `max steps seen in one turn: ${output.maxSteps}`,
          ),
      },
    ],
    columns: ({ output }) => [
      {
        label: "Summary",
        value: `${output.turns}/${MULTI_TURN_MESSAGES.length} turns, max ${output.maxSteps} steps/turn`,
      },
      { label: "Error", value: output.error ?? "(none)" },
    ],
  },
);
