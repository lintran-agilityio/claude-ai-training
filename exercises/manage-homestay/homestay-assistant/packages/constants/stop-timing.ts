/**
 * Stop timing contract — review latch + client silence together.
 *
 * Two clocks, one contract. Tuning either alone recreates Stop bugs:
 *
 * | Clock | Constant | Default | Purpose |
 * | --- | --- | --- | --- |
 * | Server stop latch | {@link STOP_LATCH_TTL_MS} | 10s | Abort FE-tool / chain follow-ups after Stop. New user turns still bypass via message-id check. Keep short enough not to eat a real next turn. |
 * | Client silent-409 | {@link STOP_RECENT_TTL_MS} | 20s | Silence Intelligence 409 while the platform thread lock may still be held. Must stay >= {@link INTELLIGENCE_THREAD_LOCK_TTL_MS}. |
 *
 * Latch ≤ client silence is the usual shape: the server stops the chain quickly;
 * the client keeps muffling platform lock noise for the full lock TTL.
 *
 * Do not re-split these into independent locals in `apps/agent` / `apps/web`.
 */

/** Intelligence platform thread-lock TTL (observed). */
export const INTELLIGENCE_THREAD_LOCK_TTL_MS = 20_000;

/**
 * Server stop latch TTL (`apps/agent` ag-ui).
 * Long enough to swallow the follow-up chain; short enough not to eat a real next turn.
 */
export const STOP_LATCH_TTL_MS = 10_000;

/**
 * Client recent-stop / silent-409 window (`apps/web` agent-run).
 * Must be >= {@link INTELLIGENCE_THREAD_LOCK_TTL_MS}.
 */
export const STOP_RECENT_TTL_MS = INTELLIGENCE_THREAD_LOCK_TTL_MS;
