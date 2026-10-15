/**
 * Provider switch for the homestay assistant's chat model.
 *
 * Four providers are wired:
 * - `openai`     → the app default: stable, no per-minute token cap
 *                  (auth via `OPENAI_API_KEY`).
 * - `cerebras`   → for exercising the tokens-per-minute rate-limit path in dev
 *                  (auth via `CEREBRAS_API_KEY`; the account must have billing
 *                  enabled or every call returns 402 Payment Required).
 * - `openrouter` → routes through openrouter.ai: one key fronts many upstream
 *                  models (auth via `OPENROUTER_API_KEY`). The slug keeps the
 *                  upstream vendor prefix, e.g. `openrouter/openai/gpt-4o-mini`.
 *                  THE ZERO-COST OPTION: a `:free` slug bills nothing, and is
 *                  what this provider defaults to (`OPENROUTER_FREE_MODEL`).
 *                  Capped per REQUEST, not per token, so pace with
 *                  `EVAL_MIN_REQUEST_INTERVAL_MS`, not `EVAL_TPM_BUDGET`.
 *                  Measured 2026-09-10: ~20 req/min AND **50 free-model
 *                  requests per day** (`limit_source:
 *                  openrouter_free_tier_daily`, resets 00:00 UTC). $10 of
 *                  lifetime credit raises the daily cap to 1000 and is never
 *                  spent on `:free` slugs. A single agent turn costs 3-6
 *                  requests, so 50/day is a handful of eval cases — plan on
 *                  the raised cap before running a whole LLM suite.
 * - `mistral`    → routes to api.mistral.ai (auth via `MISTRAL_API_KEY`).
 *                  @mastra/core bundles the Mistral provider, so no extra
 *                  `@ai-sdk/*` package is needed. NOTE (verified 2026-09-10):
 *                  the key in `apps/evals/.env` authenticates (GET /v1/models
 *                  → 200) but its free-tier quota is ZERO —
 *                  `x-ratelimit-limit-req-minute: 0` on every chat call, so
 *                  every request 429s and no amount of pacing helps. Activate
 *                  the Mistral free tier (or add billing) before selecting
 *                  this provider; `openrouter` + a `:free` slug is the working
 *                  no-cost path today.
 *
 * Resolution order (first match wins):
 *   1. `AI_MODEL`    – explicit `provider/model` router id; bypasses the switch.
 *   2. `AI_PROVIDER` – `openai` | `cerebras` | `openrouter` | `mistral`; selects
 *                      that provider's slug below.
 *   3. built-in default – `openai`.
 *
 * Tweak a provider's slug without code changes via `OPENAI_MODEL` /
 * `CEREBRAS_MODEL` / `OPENROUTER_MODEL` / `MISTRAL_MODEL`.
 *
 * Keep every value a router string, not a provider instance: the AI SDK v5
 * providers build a `LanguageModelV4`, which @mastra/core@1 (spec v3) rejects,
 * and only the router path wires provider request/history compat + retries.
 */

export const AI_PROVIDERS = {
  OPENAI: "openai",
  CEREBRAS: "cerebras",
  OPENROUTER: "openrouter",
  MISTRAL: "mistral",
} as const;

export type AiProvider = (typeof AI_PROVIDERS)[keyof typeof AI_PROVIDERS];

/**
 * OpenRouter's zero-cost route, used as the default for BOTH the chat model
 * and the injection detector whenever `openrouter` is the active provider.
 *
 * `openrouter` is the switch you reach for to stop paying (the `apps/evals`
 * dashboard runs the whole suite on it), so its default must not be a billed
 * model — it used to be `openrouter/openai/gpt-4o-mini`, which quietly charged
 * for every eval turn AND every detector call. Any `<vendor>/<model>:free`
 * slug works; this one was picked by benchmarking the real agent (2026-09-10):
 * it is the only free tool-caller tested that reproduced gpt-4o-mini's tool
 * sequence on all four booking flows, including the forced `tool_choice` the
 * booking step machine depends on. Closest alternate:
 * `cohere/north-mini-code:free` — 3-4x faster (~15-23s/turn) but 3/4 flows,
 * dropping one forced transition and leaking card fields into chat.
 * Rejected: `nvidia/nemotron-3-super-120b-a12b:free` (ignores forced
 * tool_choice), `nex-agi/nex-n2.5-pro:free` (burns steps on updateWorkingMemory
 * and narrates its plan in chat), `google/gemma-4-*:free` (upstream 429s).
 *
 * Free routes are rate limited per REQUEST, not per token — see
 * `apps/evals/src/support/model-rate-limit.setup.ts` and
 * `EVAL_MIN_REQUEST_INTERVAL_MS`.
 */
const OPENROUTER_FREE_MODEL = "openrouter/nvidia/nemotron-3.5-lightning:free";

const PROVIDER_DEFAULT_MODEL: Record<AiProvider, string> = {
  [AI_PROVIDERS.OPENAI]: process.env.OPENAI_MODEL || "openai/gpt-4o-mini",
  [AI_PROVIDERS.CEREBRAS]: process.env.CEREBRAS_MODEL || "cerebras/gpt-oss-120b",
  [AI_PROVIDERS.OPENROUTER]:
    process.env.OPENROUTER_MODEL || OPENROUTER_FREE_MODEL,
  [AI_PROVIDERS.MISTRAL]:
    process.env.MISTRAL_MODEL || "mistral/mistral-small-latest",
};

const KNOWN_PROVIDERS = new Set<string>(Object.values(AI_PROVIDERS));

const resolveProvider = (value: string | undefined): AiProvider => {
  const normalized = value?.trim().toLowerCase() ?? "";
  return KNOWN_PROVIDERS.has(normalized)
    ? (normalized as AiProvider)
    : AI_PROVIDERS.OPENAI;
};

/** Active provider (`AI_PROVIDER` env, default `openai`). */
export const AI_PROVIDER: AiProvider = resolveProvider(process.env.AI_PROVIDER);

/** Router id passed to `new Agent({ model })`. */
export const AI_MODEL: string =
  process.env.AI_MODEL?.trim() || PROVIDER_DEFAULT_MODEL[AI_PROVIDER];

/** True when the resolved chat model is Cerebras — drives provider-specific compat. */
export const IS_CEREBRAS_MODEL = AI_MODEL.startsWith(`${AI_PROVIDERS.CEREBRAS}/`);

/**
 * True when the resolved chat model is OpenAI direct (not `openrouter/openai/…`,
 * which authenticates against OpenRouter, not OpenAI, and isn't eligible for
 * OpenAI's own prompt-caching `promptCacheKey`). Drives whether the agent
 * sends that provider option — see `homestay-assistant.ts`.
 */
export const IS_OPENAI_MODEL = AI_MODEL.startsWith(`${AI_PROVIDERS.OPENAI}/`);

/**
 * Model for the prompt-injection detector — always a small hosted classifier,
 * never the primary chat model. A weak/local model is an unreliable injection
 * judge and the detector runs `strategy: "block"`, so every misfire is a
 * user-facing block.
 *
 * Resolution (first match wins):
 *   1. `AI_SECURITY_MODEL` env – explicit override.
 *   2. OpenRouter route – when it's the active provider, or the only hosted
 *      key present (e.g. `AI_PROVIDER` points at a local model with no
 *      `OPENAI_API_KEY`; the check must not fall back to that local model).
 *   3. Mistral route – when Mistral is the active provider (or its key is the
 *      only hosted one) and there's no OpenAI key. Keeps the detector on a
 *      reachable hosted model instead of an OpenAI route that would 401 and
 *      make the detector throw on every screened message.
 *   4. OpenAI route – `openai/gpt-4o-mini` (needs `OPENAI_API_KEY`; without any
 *      hosted key the detector fails open and allows the message through).
 */
const resolveSecurityModel = (): string => {
  const explicit = process.env.AI_SECURITY_MODEL?.trim();
  if (explicit) {
    return explicit;
  }

  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const hasMistralKey = Boolean(process.env.MISTRAL_API_KEY?.trim());

  if (
    AI_PROVIDER === AI_PROVIDERS.OPENROUTER ||
    (!hasOpenAiKey && hasOpenRouterKey)
  ) {
    // Free route on purpose: the detector fires on EVERY screened guest
    // message, so a billed default here costs more than the chat model over a
    // full eval run. Production deployments that want a stronger judge should
    // set AI_SECURITY_MODEL explicitly (see the note above).
    return OPENROUTER_FREE_MODEL;
  }

  if (
    !hasOpenAiKey &&
    (AI_PROVIDER === AI_PROVIDERS.MISTRAL || hasMistralKey)
  ) {
    return "mistral/mistral-small-latest";
  }

  return "openai/gpt-4o-mini";
};

export const AI_SECURITY_MODEL: string = resolveSecurityModel();
