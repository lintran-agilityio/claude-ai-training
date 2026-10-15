import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Evalite runs on Vitest under the hood but exposes no plugin/alias hook of
 * its own (`Evalite.Config` has no `plugins`/`resolve` field) — Vitest's
 * `createVitest` still auto-discovers a `vitest.config.ts` in this package's
 * root, though, so this file exists to give the eval runner the same module
 * aliases `tsconfig.json` gives `tsc`, and to pin its execution model. It is
 * only consumed by `evalite run|serve` — nothing in `apps/agent` uses it.
 *
 * Both aliases point into `apps/agent`'s source:
 *   - `@agent/*` is what the eval harness imports (`@agent/mastra/runtime`, …).
 *   - `@/*` is what the agent's own source imports internally (`@/mastra/*`),
 *     so the runner needs it too once it starts transpiling those files.
 */
const agentSrc = path.resolve(import.meta.dirname, "../agent/src");

export default defineConfig({
  resolve: {
    alias: {
      "@agent": agentSrc,
      "@": agentSrc,
    },
  },
  test: {
    /**
     * `evalite.config.ts`'s `maxConcurrency: 1` only serializes cases *within*
     * one `.eval.ts` file — Vitest still runs the ~10 behavioral eval files in
     * parallel worker processes by default. Each behavioral case is a real
     * multi-call agent turn (prompt-injection detector + tool loop, ~30k
     * tokens each on gpt-4o-mini), so several files at once jointly blow the
     * OpenAI 200k TPM budget and Mastra's built-in "rate limit approaching"
     * backoff can't pace a run it only sees one worker's slice of. Running the
     * files one at a time lets that backoff actually keep the whole suite
     * under the per-minute cap. Evalite forces `testTimeout`, `maxConcurrency`
     * and `setupFiles` but leaves `fileParallelism` to us.
     */
    fileParallelism: false,
  },
});
