import { defineConfig } from "evalite/config";
import { createInMemoryStorage } from "evalite/in-memory-storage";

/**
 * Evalite's default storage backend (`better-sqlite3`) needs a native binding
 * that is not prebuilt for every dev/CI machine in this monorepo — evaluating
 * requires no persistent cross-run history (each `eval` run is judged on its
 * own pass/fail + score), so in-memory storage sidesteps that native
 * dependency entirely. Local score history across runs (the Evalite UI's
 * "vs previous run" diff) is the only feature this gives up.
 */
export default defineConfig({
  // `evalite serve` powers the deployed dashboard. Render injects `PORT` at
  // runtime (10000 by default); retain 3006 for the local `eval:serve` flow.
  server: {
    port: Number.parseInt(process.env.PORT ?? "3006", 10) || 3006,
  },
  storage: () => createInMemoryStorage(),
  // Fixtures stub `globalThis.fetch` for the duration of one case
  // (src/support/fake-api.ts) — evalite's default concurrency (5) would
  // let two cases' install/restore race on that single global and leak the
  // real network into a case still mid-flight. Serializing eval cases is the
  // simple, correct fix; the alternative (AsyncLocalStorage-scoped fetch)
  // isn't worth the complexity for a suite this size.
  maxConcurrency: 1,
  // Agent turns are real LLM calls through the full tool-loop (search →
  // availability → confirm, etc.). On the free OpenRouter route the suite now
  // runs on, a single turn measured 45-77s (free slugs are queued upstream),
  // and EVAL_MIN_REQUEST_INTERVAL_MS adds ~3.1s per call on top of that — so
  // the old 120s ceiling would fail healthy cases. 300s keeps real headroom
  // without letting a genuinely hung call run forever.
  testTimeout: 300_000,
  // Serial execution alone still bursts past OpenAI's 200k TPM org cap on a
  // fresh `evalite serve` deploy (Render). This setup file wraps
  // `globalThis.fetch` in every worker/mode with a trailing-60s token budget
  // (`EVAL_TPM_BUDGET`, default 150k) plus Retry-After–honoring 429 retries.
  // See the file header for the full rationale.
  setupFiles: ["./src/support/model-rate-limit.setup.ts"],
});
