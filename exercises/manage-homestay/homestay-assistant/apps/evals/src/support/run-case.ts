import type { Booking } from "@agent/mastra/schemas/booking";

import type { AgentTurnOptions } from "./agent-harness";
import { runAgentTurn } from "./agent-harness";
import { installFakeApi } from "./fake-api";
import { extractToolCalls, type EvalToolCall } from "./tool-calls";

export type CaseResult = {
  text: string;
  toolNames: string[];
  toolCalls: EvalToolCall[];
  threadId: string;
  /**
   * Set when an input/output processor aborted the turn — a security block
   * (`GuestPromptInjectionProcessor`, `strategy: "block"`) or the user-message
   * token limit. `undefined` on a normal turn. Shape: Mastra's
   * `StepTripwireData` (`{ reason, processorId?, ... }`).
   */
  tripwire: unknown;
  /**
   * Snapshot of the fixture API's booking table AFTER the turn. Use it to
   * assert a terminal mutation actually landed (or, for the "never mutates"
   * evals, that it did not) — compare against `support/fixtures.ts`'s
   * `FIXTURE_BOOKINGS`. Only meaningful together with
   * `AgentTurnOptions.hitlResolution` (otherwise the turn stops at the HITL
   * gate and nothing mutates).
   */
  apiBookings: Booking[];
};

/**
 * Shared task body for every agent-turn eval: install the fixture API
 * (see `fake-api.ts` for why the mock boundary is `fetch`, not the agent or
 * its tools), run one real turn through the real agent, and always restore
 * `fetch` afterward — even a case that throws must not leak the stub into
 * the next one, since evalite runs cases with concurrency.
 */
export const runCase = async (
  message: string,
  options?: AgentTurnOptions,
): Promise<CaseResult> => {
  const fakeApi = installFakeApi();
  try {
    const { result, threadId } = await runAgentTurn(message, options);
    const toolCalls = extractToolCalls(result);
    return {
      text: result.text ?? "",
      toolNames: toolCalls.map((call) => call.toolName),
      toolCalls,
      threadId,
      tripwire: (result as { tripwire?: unknown }).tripwire,
      apiBookings: fakeApi.state.bookings.map((booking) => ({ ...booking })),
    };
  } finally {
    fakeApi.restore();
  }
};
