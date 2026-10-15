import { evalite } from "evalite";

import { IS_OPENAI_MODEL } from "@agent/mastra/constants";

import { runAgentTurn } from "../../support/agent-harness";
import { scoreResult } from "../../support/checks";
import { installFakeApi } from "../../support/fake-api";

/**
 * Regression — the homestay system prompt's static sections must sit ahead
 * of the request-specific DATE CONTEXT / GUEST blocks so OpenAI's
 * prompt-cache prefix match can be shared ACROSS different guests, not just
 * across turns in the same thread. See `withDateContext` / `withGuestContext`
 * (utils) and the `defaultOptions.providerOptions.openai.promptCacheKey` on
 * `homestay-assistant.ts`.
 *
 * OpenAI-only: `promptCacheKey` and cache eligibility are an OpenAI-direct
 * feature (see `IS_OPENAI_MODEL`) — the dashboard's default OpenRouter-free
 * route doesn't cache the same way, so this case is skipped everywhere else
 * rather than failing on a provider it isn't testing.
 *
 * Three sequential turns:
 *   1. Alice, thread A — first message of a fresh thread (cold: nothing to
 *      hit yet for a never-seen prefix).
 *   2. Bob, thread B — first message of a DIFFERENT fresh thread. Different
 *      guest, different thread, but the same static system-prompt prefix as
 *      turn 1. This is the case that regresses if guest/date content ever
 *      moves back to the front of the prompt.
 *   3. Alice, thread A again — same thread as turn 1, the ordinary
 *      multi-turn case that was already cache-eligible before this change.
 *
 * Caching is best-effort on OpenAI's side (no error, no guaranteed hit) — a
 * single 0 is noise; a stuck 0 across runs is the regression this guards.
 */
const CASES = [
  { label: "Alice — thread A, turn 1 (cold)", userId: "eval-guest-alice", thread: "A" },
  { label: "Bob — thread B, turn 1 (new guest, shared prefix)", userId: "eval-guest-bob", thread: "B" },
  { label: "Alice — thread A, turn 2 (same thread)", userId: "eval-guest-alice", thread: "A" },
] as const;

const GREETING = "Hi, what rooms do you have available?";

type CacheTurnResult = {
  label: string;
  inputTokens: number | undefined;
  cachedInputTokens: number | undefined;
};

const defineEval = IS_OPENAI_MODEL ? evalite : evalite.skip;

defineEval<undefined, { turns: CacheTurnResult[]; error: string | null }, true>(
  "Regression — new-guest prompt-cache prefix is shared, not per-guest",
  {
    data: () => [{ input: undefined, expected: true }],
    task: async () => {
      const fakeApi = installFakeApi();
      const threadIds: Record<string, string> = {};
      const turns: CacheTurnResult[] = [];
      let error: string | null = null;

      try {
        for (const { label, userId, thread } of CASES) {
          threadIds[thread] ??= `eval-prompt-cache-${thread}-${Date.now()}`;
          const { result } = await runAgentTurn(GREETING, {
            userId,
            threadId: threadIds[thread],
            identity: { userId, fullName: userId, locale: "en-US" },
          });

          if (result.tripwire) {
            error = `tripwire on "${label}": ${JSON.stringify(result.tripwire)}`;
            break;
          }

          const usage = result.steps?.[0]?.usage;
          turns.push({
            label,
            inputTokens: usage?.inputTokens,
            cachedInputTokens: usage?.cachedInputTokens,
          });
        }
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      } finally {
        fakeApi.restore();
      }

      return { turns, error };
    },
    scorers: [
      {
        name: "All turns completed without a tripwire/error",
        scorer: ({ output }) =>
          scoreResult(
            output.error === null && output.turns.length === CASES.length,
            output.error ?? `completed ${output.turns.length}/${CASES.length} turns`,
          ),
      },
      {
        name: "New guest's first turn hits the shared static-prompt cache",
        description:
          "Bob's turn 1 shares no thread history with Alice's — any cache hit here can only come from the static system-prompt prefix (tools+system), proving DATE/GUEST content sits after it, not before.",
        scorer: ({ output }) => {
          const bobTurn1 = output.turns[1];
          const cached = bobTurn1?.cachedInputTokens ?? 0;
          return scoreResult(
            cached >= 1024,
            `Bob turn 1 cachedInputTokens=${cached} (input=${bobTurn1?.inputTokens ?? "n/a"}) — expected >= 1024`,
          );
        },
      },
    ],
    columns: ({ output }) => [
      {
        label: "Cache usage per turn",
        value: output.turns
          .map((t) => `${t.label}: input=${t.inputTokens ?? "n/a"} cached=${t.cachedInputTokens ?? 0}`)
          .join("\n"),
      },
      { label: "Error", value: output.error ?? "(none)" },
    ],
  },
);
