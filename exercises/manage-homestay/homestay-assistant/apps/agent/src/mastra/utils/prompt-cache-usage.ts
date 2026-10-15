/**
 * Dev-only visibility into OpenAI prompt caching. Set `LOG_PROMPT_CACHE=1`
 * (in whichever `.env` the running process reads — `apps/web/.env` for the
 * in-process agent, `apps/agent/.env` for standalone `mastra dev`; see
 * homestay-agent-model-resolution) to log each step's cache hit rate.
 *
 * Wired as `defaultOptions.onStepFinish` on the agent — see
 * `agents/homestay-assistant.ts`. No-ops (and costs nothing) when the env var
 * is unset, so it's safe to leave attached in production.
 */
export const logPromptCacheUsage = ({
  usage,
}: {
  usage?: {
    inputTokens?: number;
    cachedInputTokens?: number;
  };
}): void => {
  if (process.env.LOG_PROMPT_CACHE !== "1" || !usage) {
    return;
  }

  const { inputTokens, cachedInputTokens } = usage;
  if (inputTokens == null) {
    return;
  }

  const cached = cachedInputTokens ?? 0;
  const pct = inputTokens > 0 ? ((cached / inputTokens) * 100).toFixed(1) : "0.0";
  console.info(
    `[prompt-cache] input=${inputTokens} cached=${cached} (${pct}%)`,
  );
};
