/**
 * Result shape for Evalite's `{ name, description?, scorer }` scorer form —
 * `scorer` returns just `{ score, metadata }`; Evalite attaches the static
 * `name`/`description` from the surrounding `ScorerOpts`. `metadata.reason`
 * is what makes a failed case explainable in the Evalite UI/CI output
 * without re-running it — always pass the concrete actual-vs-expected value,
 * not just "failed".
 */
export const scoreResult = (pass: boolean, reason: string) => ({
  score: pass ? 1 : 0,
  metadata: { reason },
});

/**
 * OpenAI's strict-mode function calling (used for every tool schema here —
 * see `find-room.schema.ts` etc.) requires every property to be present in
 * every call; an "omitted" optional field comes back as a literal `null`,
 * not a missing key or `undefined`. Comparing captured tool-call args
 * against an `undefined` sentinel for "must not be set" is a false
 * negative, not a real mismatch — this treats null/undefined/absent as
 * equivalent "not provided" on both sides.
 */
export const argMatches = (actual: unknown, expected: unknown): boolean =>
  expected === undefined ? actual === null || actual === undefined : actual === expected;

/** Field-by-field diff for a captured tool-call args object against an expected partial shape, using `argMatches`. */
export const diffArgs = (
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): Array<[string, unknown, unknown]> =>
  Object.entries(expected)
    .filter(([key, value]) => !argMatches(actual[key], value))
    .map(([key, value]) => [key, value, actual[key]]);
