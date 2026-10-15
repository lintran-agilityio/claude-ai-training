# Prompt caching — static-prefix invariant

## The rule

The homestay-assistant system prompt is built in two layers, and the order
between them is golden:

1. **Static, request-independent sections** — `buildHomestayAssistantPrompt`
   (`building-instruction.ts`): ROLE, CORE_PRINCIPLES, ROUTING_RULES, every
   `WORKFLOW_*` playbook section, etc. Byte-identical for every guest, every
   thread, every day (modulo the `flowHint`-gated workflow sections, which
   only ever *drop* sections, never reorder or reword the ones that remain).
2. **Per-request, per-guest tail** — appended *after* layer 1, never before:
   - `withDateContext` (`current-date.ts`) — today/tomorrow/weekend dates.
   - `withGuestContext` (`guest-context.ts`) — guest name / browser locale,
     when the client forwarded one.

`homestay-assistant.ts`'s `instructions` callback composes them in that exact
order: `withGuestContext(withDateContext(buildHomestayAssistantPrompt(...)))`.

## Why it matters

OpenAI's (and Anthropic's) prompt caching keys off a **byte-identical
prefix** of the request. If any per-guest or per-day content sat *ahead of*
or *inside* the static sections, every guest and every day would produce a
different prefix — the cache would effectively never hit across guests, only
within retries of the exact same request. Keeping DATE CONTEXT and GUEST at
the very end means the entire static playbook is one shared, cacheable
prefix, and only the last, short block differs per request.

`AGENT_KEYS.HOMESTAY_ASSISTANT` is also pinned as a fixed
`providerOptions.openai.promptCacheKey` (OpenAI-direct only — see
`IS_OPENAI_MODEL` in `model.ts`) so OpenAI routes same-prefix requests to the
same cache lookup more reliably.

## Rule for future changes

Any **new** per-request or per-guest dynamic content (a new context block, a
new personalization field, anything derived from the incoming request rather
than fixed at build time) must be appended to the tail, alongside
`withDateContext`/`withGuestContext` — never inserted into
`buildHomestayAssistantPrompt`'s section list, and never placed ahead of the
existing tail blocks. Conversely, anything genuinely static (new
`WORKFLOW_*`/routing guidance) belongs in `intent-playbook.ts` and is safe to
add to the static layer.

## How it's verified

- `apps/evals/src/homestay-assistant/conversation/prompt-cache.eval.ts` —
  regression eval: a brand-new guest's first-ever turn on a fresh thread must
  still hit the shared static-prefix cache (`cachedInputTokens >= 1024`).
  This is the case that fails if per-guest/per-day content ever moves back
  ahead of the static prefix. OpenAI-only (`IS_OPENAI_MODEL`); skipped on
  other providers, which don't cache the same way.
- `LOG_PROMPT_CACHE=1` (set in whichever `.env` the running process reads)
  logs each step's cache hit rate via `logPromptCacheUsage`
  (`prompt-cache-usage.ts`) for manual, request-by-request verification.
