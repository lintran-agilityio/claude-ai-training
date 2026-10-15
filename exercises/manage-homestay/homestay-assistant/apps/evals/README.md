# Homestay Assistant — Evals

Evalite-based behavioral evaluations for the Mastra agent in `apps/agent`. This suite tests **AI behavior** — intent routing, tool selection, tool arguments, booking-workflow ordering, response quality, and regressions for previously-fixed bugs. It does **not** test the CopilotKit UI, AG-UI transport, or NestJS API — those have their own test suites (or none yet, in the API's case).

## Where it lives

This is its own workspace package (`apps/evals`, name `evals`), a peer of `apps/agent` / `apps/web` / `apps/api`. It imports the agent's real runtime, tools, prompts, and booking step-machine straight from `apps/agent`'s source through the `@agent/*` path alias (`apps/evals/tsconfig.json` + `apps/evals/vitest.config.ts`) — the same technique `apps/web` uses to reach `../agent/src/mastra/*`. Evalite (`evalite@0.19.0`), `autoevals`, and the eval runner tooling are devDependencies of this package only; `apps/agent` no longer carries them.

## Directory layout — per agent, per tool

```
apps/evals/
├── evalite.config.ts             evalite runner config (maxConcurrency, timeouts, setup files)
├── vitest.config.ts              @agent/@ aliases + fileParallelism:false for the eval runner
├── scripts/                      render-evalite-serve.mjs (Render bind fix), vercel-build.mjs (static export)
└── src/
    ├── support/                       shared harness — fixtures, fake API, agent harness, scorers, step-contract runner
    └── homestay-assistant/            the one agent (a 2nd agent would get a sibling directory)
        ├── deterministic/             no LLM, no network, milliseconds — the free every-PR gate
        │   ├── find-room.eval.ts               find_room result → transition (discovery never forces; book_resolve fork)
        │   ├── create-booking.eval.ts          confirm_booking gate; create_booking terminal → stop
        │   ├── update-booking.eval.ts          picker / edit-form / confirm_modify gates; update_booking → stop
        │   ├── cancel-booking.eval.ts          show_cancel_dialog_confirm gate; cancel_booking → stop
        │   └── find-booking-by-id.eval.ts      find_booking_by_id(modify) junction → edit form vs confirm_modify_booking vs stop (incl. its own availability probe)
        ├── tools/                     real LLM calls through the real agent — structured (non-judge) scoring, per tool
        │   ├── get-rooms.eval.ts               plain catalog browse only                                       (1 case)
        │   ├── find-room.eval.ts               selection (discovery intent) + arguments (date/guests)          (4 cases)
        │   ├── get-room-by-id.eval.ts          [book-form] → get_room_by_id only                               (1 case)
        │   ├── create-booking.eval.ts          never mutates before the confirm gate; taken date stops        (2 cases)
        │   ├── update-booking.eval.ts          never mutates before confirm; no-op modify never opens dialog  (2 cases)
        │   ├── cancel-booking.eval.ts          resolve by name, stop at the cancel dialog                      (1 case)
        │   ├── get-bookings.eval.ts            "show my bookings" routing; onDate discipline                   (3 cases)
        │   ├── find-bookings.eval.ts           internal resolver, never find_room; not_found is a hard stop    (1 case)
        │   └── find-booking-by-id.eval.ts      MODIFY "extend N nights" stated-change extraction               (1 case)
        └── conversation/              agent-level, not per-tool
            ├── response-quality.eval.ts        rubric-graded anti-hallucination (judge call per case)          (2 cases)
            ├── multi-turn-context.eval.ts      token-limiter / step-count regression across one thread (3 turns)
            ├── security-input.eval.ts          genuine injection blocked; first-party [book-form]/[booking-modify] NEVER blocked  (3 cases)
            ├── booking-hitl-flow.eval.ts       confirmed HITL click → terminal mutation (create / cancel) lands; dismissal → no-op  (3 cases)
            └── multi-turn-booking.eval.ts      stay continuity carries across turns                            (1 case)
```

> **Case counts are deliberately lean** (~24 real-LLM cases across `tools/` + `conversation/`, plus the free `deterministic/` suite). Each `tools/`/`conversation/` case is one real agent turn (~30k tokens; `response-quality` adds a judge call). Redundant phrasing variants and permanently-failing "known gap" cases were removed — add a case back only when it guards a distinct behavior nothing else covers.

> The `tools/` directory is the suite the older prose below still calls `behavioral/` — same role (real LLM turn, structured scoring), and `pnpm eval:tools` is its runner. The rename is not yet reflected everywhere in this file.

**Why the split.** `deterministic/` proves the booking step-machine's ordering contract (`src/mastra/utils/step-machine.ts`) with zero API cost, zero network, in milliseconds — run it on every PR. `behavioral/` runs the _same_ gates through a real model turn, so a model that stops honoring them fails even though the deterministic gate still passes. `conversation/` is the only place an LLM judge is used, and the only multi-turn scenario.

**Why per tool.** Each registered tool has (at most) one `deterministic/` file and one `behavioral/` file, both named for the tool. To see everything that checks `find_room`, open two files, not five. `get_rooms` / `get_room_by_id` / `get_bookings` / `find_bookings` don't force step-machine transitions, so they have a `behavioral/` file only.

## What gets evaluated — per tool

| Tool                 | `deterministic/`                                                                                                                                          | `behavioral/`                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get_rooms`          | —                                                                                                                                                         | plain browse only; never `find_room` / `get_bookings` for it                                                                                                 |
| `find_room`          | every result shape → transition; `book_resolve`·1-match → form vs `confirm_booking` (own availability probe) vs stop                                      | discovery intent routes here first; "available" wording never → `get_bookings`; date normalized, guests never invented, `level`/`limit`                      |
| `get_room_by_id`     | _(forced target only — see `find-room.eval.ts`)_                                                                                                          | `[book-form]` → `get_room_by_id` only, no availability (the by-name detail chain is a documented unfixed gap — see Known limitations)                        |
| `create_booking`     | `confirm_booking` confirmed→create / dismissed→stop; terminal→stop                                                                                        | never fires before `find_room`→`confirm_booking` (there is no `check_room_availability` tool); full stay skips the form                                      |
| `update_booking`     | picker / edit-form / `confirm_modify_booking` gates; terminal→stop                                                                                        | never fires before the confirm gate; no-op modify never opens the dialog                                                                                     |
| `cancel_booking`     | `find_bookings`→pass; `show_cancel_dialog_confirm` confirmed→cancel / dismissed→stop; terminal→stop                                                       | resolve by name → `find_bookings` → `show_cancel_dialog_confirm`, no `cancel_booking` this turn                                                              |
| `get_bookings`       | —                                                                                                                                                         | "show/list my bookings" routes here, never `find_room`; `onDate` only from a cue in the current message                                                      |
| `find_bookings`      | _(covered as `cancel-booking.eval.ts`'s `find_bookings`→pass case)_                                                                                       | internal resolver, never `find_room` first; `not_found` → no HITL/mutation                                                                                   |
| `find_booking_by_id` | `find_booking_by_id(modify)`·1-match → edit form vs `confirm_modify_booking` vs stop (it probes availability itself for a stated change); `cancel` → pass | "extend N nights" computes the date, leaves other fields unset; `[booking-cancel]` → `find_booking_by_id` → `show_cancel_dialog_confirm`, no `find_bookings` |

The 5 HITL client tools (`confirm_booking`, `confirm_modify_booking`, `edit_modify_booking`, `show_cancel_dialog_confirm`, `show_modify_dialog_select`) aren't registered on the agent — they're stubbed in `support/client-tools.ts`. Their confirmed/dismissed → next-tool transitions are asserted inside the terminal-tool files they gate (`create-booking` / `update-booking` / `cancel-booking`).

## How to run

```bash
# from apps/evals  (or `pnpm --filter=evals <script>` from anywhere)
pnpm eval:deterministic   # homestay-assistant/deterministic/ only — no LLM, no network, runs in ms
pnpm eval:tools           # homestay-assistant/tools/ — real LLM calls, structured scoring, costs tokens
pnpm eval:conversation    # homestay-assistant/conversation/ — real LLM calls; response-quality adds a judge call per case
pnpm eval                 # everything
pnpm eval:serve           # runs the suite once, keeps the Evalite UI at localhost:3006
pnpm check-types          # tsc --noEmit over src/ (+ the two configs)

# one file at a time — pass a single path substring (the CLI takes exactly one positional):
pnpm eval security-input
pnpm eval booking-hitl-flow
```

The `eval:*` scripts invoke `node --env-file-if-exists=.env node_modules/evalite/dist/bin.js run|serve` directly — the `evalite` CLI has no env-loading of its own, and this package isn't started through `mastra dev` (which loads `.env` itself). `--env-file-if-exists` (not `--env-file`) means a missing `apps/evals/.env` doesn't crash the command — CI is expected to inject `OPENAI_API_KEY` etc. as real environment variables instead of a file.

The `deterministic` / `behavioral` / `conversation` argument to `evalite run` is a **filename substring filter** (Vitest's file filtering) — `evalite run <substring>` only runs `*.eval.ts` files whose path contains that substring. `pnpm eval:deterministic` relies on `deterministic` matching every file under `homestay-assistant/deterministic/` and nothing outside it. Keep each of the three bucket names a unique path segment and don't put one inside another bucket's path.

## Required environment variables

Same as running the agent normally (put them in `apps/evals/.env`, see `apps/evals/.env.example`):

- `OPENAI_API_KEY` — required for every `tools/` and `conversation/` eval (the agent's own model calls, plus the LLM judge in `conversation/response-quality.eval.ts`, which reuses the same `AI_MODEL` resolution as production — see `apps/agent/src/mastra/constants/model.ts`).
- `API_URL` — read by the harness's fixture layer (`support/fake-api.ts` calls the same `getApiUrl()` production uses) but **no live `apps/api` process needs to be running** — see "How fixtures work" below. It only needs to parse to a valid URL.
- `AI_PROVIDER` / `AI_MODEL` / `CEREBRAS_API_KEY` — optional, same switch as production (`openai` default). Evals were written and validated against the OpenAI path.

No secrets are hardcoded anywhere in this suite.

## How fixtures / test data work

The agent is invoked **directly and in-process** — no CopilotKit, no AG-UI, no HTTP server for the agent itself:

```ts
import { mastra } from "@agent/mastra/runtime"; // the SAME instance apps/web's CopilotKit route uses
const agent = mastra.getAgent(AGENT_KEYS.HOMESTAY_ASSISTANT);
await agent.generate(message, { memory: { thread, resource }, requestContext });
```

`runtime.ts` (not the Studio instance in `mastra/index.ts`) is what `apps/agent/src/copilotkit.ts`'s `getCopilotkitAgents` actually wires up for production traffic, so evaluating it — real prompt, real tools, real input/output processors, real booking step-machine — is what makes these evals faithful without going through AG-UI at all. `@agent/*` resolves to `apps/agent/src/*` (alias in `apps/evals/tsconfig.json` for `tsc` and `apps/evals/vitest.config.ts` for the runner).

Room/booking **data** is a fixed, deterministic dataset (`support/fixtures.ts`) — 3 rooms, 2 bookings, dates chosen to always be in the future relative to whenever the suite runs. Every request the agent's tools would normally send to the NestJS API (`apps/api`) is instead served by a fixture-backed `fetch` stub (`support/fake-api.ts`) that only intercepts requests whose **origin** matches `getApiUrl()` — everything else (the actual OpenAI/Cerebras call, the judge's call) passes straight through to the real network.

**Why mock at `fetch`, not the tools or the agent**: the mock boundary is `apps/agent/src/mastra/services/common.ts`'s `get/post/update/del` — the single chokepoint every room/booking tool goes through to reach apps/api. Stubbing at that boundary means the real tool code, real Zod response parsing, and the real `booking/*` step-machine + availability logic all still execute; only the network hop to a real apps/api process (and whatever's in its database) is replaced.

Auth is faked the same way production's request-pipeline middleware would populate it (`support/agent-harness.ts`): a synthetic Clerk-shaped `MastraAuthContext` is set both on the `RequestContext` passed to `generate()` and via `runWithAgentRequest` (AsyncLocalStorage) — `services/common.ts::resolveAuthForApi` checks the former, falls back to the latter, and evals bypass the HTTP auth middleware entirely (no real Clerk token needed).

### The HITL confirm tools need an explicit stand-in (`support/client-tools.ts`)

`confirm_booking`, `confirm_modify_booking`, `edit_modify_booking`, `show_cancel_dialog_confirm`, and `show_modify_dialog_select` are **not** in `homestayAssistant.tools` at all — they only exist because CopilotKit's `MastraAgent.getLocalAgents()` injects them as client tools from the frontend's `useHumanInTheLoop`/`useRenderTool` registrations. Calling the agent directly (as this suite deliberately does, to stay off AG-UI/CopilotKit) means those tools don't exist unless supplied — and without them, the booking step-machine's forced transition to e.g. `confirm_booking` has nothing to call, so the model falls through to whatever tool IS registered (which turned out to be `create_booking`/`update_booking`/`cancel_booking` itself during initial validation). That was a harness gap, not a production bug: `support/client-tools.ts` defines the same 5 tools with their real shared schemas (`@repo/schemas`) and no `execute` (deliberately — a client tool with no server-side `execute` is exactly what a real frontend-rendered tool looks like: the call is emitted and the turn ends there, awaiting an out-of-band result), passed via `generate()`'s `clientTools` option. `support/agent-harness.ts::runAgentTurn` wires this in for every eval automatically.

#### Resolving the HITL card in-turn (`runCase(msg, { hitlResolution })`)

The no-`execute` stubs are exactly right for "the terminal mutation never fires before a real click" — the turn stops at the card and there is nothing more to assert. To test the **other** half — the confirmed click actually reaching `create_booking` / `update_booking` / `cancel_booking` — `support/client-tools.ts::buildResolvingHitlTools("confirm" | "decline")` builds the same 5 tools **with** an `execute` that returns the real `…Result` payload the frontend hook returns on a click. It is passed via `generate({ toolsets })`, **not** `clientTools`, because Mastra strips `execute` from client tools (`listClientTools` does `const { execute, ...rest } = tool`) but keeps it for toolset tools. The step machine's `CONFIRMATION_FOLLOW_UPS` + `parseConfirmedStay` pinning then carry the confirmed stay to the terminal mutation exactly as in production — all inside one `agent.generate()` call. Opt in per turn with `runCase(msg, { hitlResolution: "confirm" })`; `conversation/booking-hitl-flow.eval.ts` is the only user today.

`CaseResult` carries two fields for these agent-level evals: `tripwire` (set when an input processor aborted the turn — a security block or the user-message token limit) and `apiBookings` (the fixture booking table after the turn, for asserting a mutation landed or didn't).

## Concurrency & rate-limit notes (important if you add eval files)

Three knobs, all aimed at staying under OpenAI's org-wide 200k TPM cap:

- `evalite.config.ts` sets `maxConcurrency: 1` — serializes cases _within_ one `.eval.ts` file. The fixture `fetch` stub is installed on `globalThis.fetch` per case (`support/run-case.ts`) and restored afterward — evalite's default concurrency (5) would let two cases' install/restore race on that one global and leak the real network into a case still mid-flight. Don't raise `maxConcurrency` without also making the fetch stub properly scoped (e.g. per-case `AsyncLocalStorage`).
- `vitest.config.ts` sets `test.fileParallelism: false` — serializes the _files_ themselves. Vitest otherwise runs `.eval.ts` files in parallel workers, and several real agent turns at once jointly exceed the OpenAI 200k TPM budget (each behavioral case ≈ a prompt-injection-detector call + a multi-step tool loop, ~30k tokens on gpt-4o-mini). Running one file at a time lets the pacing gate below see the whole run in one process's ledger. Evalite force-sets `testTimeout` / `maxConcurrency` / `setupFiles` but leaves `fileParallelism` to this file.
- `evalite.config.ts` `setupFiles: ["./src/support/model-rate-limit.setup.ts"]` — even fully serial, ~24 back-to-back turns still burst past 200k TPM on a fresh `evalite serve` deploy (Render was dying with `429 ... Limit 200000, Used 200000`). This setup file wraps `globalThis.fetch` in every worker and every mode (`eval`, `eval:watch`, `eval:serve`) to (1) pace model-provider requests through a trailing-60s token budget — `EVAL_TPM_BUDGET`, default `150_000`, shared across the run's sequential forks via a JSON ledger under `MASTRA_DATA_DIR` — and (2) retry a `429` honoring `Retry-After` up to `EVAL_RATE_LIMIT_RETRIES` (default 6) times, so a transient overage never surfaces as a failure. Set `EVAL_TPM_BUDGET=0` to disable pacing (429 retry stays on).

Net effect: `pnpm eval` runs every case strictly one after another _and_ throttles the token rate. It's slower (expect ~10–20 min for `tools/`) but doesn't hit `429 rate_limit_exceeded`.

## Which tests are deterministic vs LLM-judged

- **Fully deterministic, no LLM call at all**: everything under `homestay-assistant/deterministic/` — the no-op/availability pure functions from `apps/agent/src/mastra/utils/modify-booking.ts`, plus the `resolveEnforcedTransition` step-machine entry point from `apps/agent/src/mastra/utils/step-machine.ts` driven with each tool's own documented result shape (`support/step-contract.ts` is the shared runner). No `agent.generate()`, no fixture API, no network.
- **Deterministic assertions over a real LLM-driven agent run**: everything under `homestay-assistant/behavioral/` and the `multi-turn-context` regression — the _agent's_ output is non-deterministic (a real model call), but the _scoring_ is a structured assertion (tool name, argument value, call order), not a semantic judgment. A flaky model response can still fail these; that's the model's routing/argument reliability being tested, not test flakiness.
- **LLM-judged**: `homestay-assistant/conversation/response-quality.eval.ts` only. Every rubric line is a single literal, independently-checkable claim (see `support/judge.ts`) — never an open "does this look good?" — to keep it as low-flake as an LLM judge can reasonably be.

## Adding a new evaluation

1. Pick the file named for the tool the case is really about — its `deterministic/` file for a no-LLM step-machine/pure-function check, its `behavioral/` file for a real agent turn. Agent-level scenarios that aren't about one tool (reply wording, multi-turn) go in `conversation/`.
2. Reuse `support/run-case.ts::runCase(message, options?)` for a single agent turn — it installs the fixture API, runs the turn, and always restores `fetch` in a `finally`.
3. Read tool calls off `CaseResult.toolNames` (string[], in order) or `CaseResult.toolCalls` (with args, via `support/tool-calls.ts::toolCallArgs`).
4. Prefer a structured assertion (`support/checks.ts::scoreResult(pass, reason)`) over an LLM judge. Only reach for `support/judge.ts::gradeAgainstRubric` when the thing you're checking is genuinely about natural-language phrasing.
5. If your scenario needs a booking/room that doesn't exist yet, add it to `support/fixtures.ts` rather than inlining ad-hoc data — keeps `fake-api.ts` the single source of truth for what "the database" contains.
6. No-LLM step-machine routing cases go through `support/step-contract.ts::stepContractEval`; direct pure-function cases call `evalite` themselves. Keep them under `deterministic/` so `pnpm eval:deterministic` picks them up via the folder-path substring filter.

## Known limitations / open findings

- **COMPARE (`generate_a2ui`) is out of scope.** It's a CopilotKit-side generative-UI tool injected by the AG-UI bridge, not a tool registered on the Mastra agent (`homestay-assistant.ts`'s `tools:` map has no `generate_a2ui` entry) — it isn't reachable from a direct `agent.generate()` call. Testing it would require going through AG-UI/CopilotKit, which is explicitly out of scope for this suite.
- **`resolve_booking_stay` / `resolve_booking_target` are not evaluated.** Per their own doc comments in `packages/constants/tool-keys.ts`, they're "not yet wired into any tool or the step machine" — nothing to evaluate yet.
- **Two known production gaps are documented here but no longer have executing cases** — a permanently-failing eval gives no regression signal (it cannot get worse) while costing real tokens every run, so the cases were removed during the token trim. The gaps still need a prompt fix, out of scope for this suite:
  - **Room detail by name never completes its documented tool chain.** `WORKFLOW_DETAIL` documents that a bare "tell me about `<room name>`" / "what amenities does `<room name>` have" request resolves `find_room` → (exactly one match) → `get_room_by_id`. Observed live runs call `find_room` and stop; in the amenities case the reply also lists amenities directly in chat, which both `WORKFLOW_FIND` and `WORKFLOW_DETAIL` explicitly forbid ("UI owns the data"). (Formerly 2 `knownFailing` cases in `tools/get-room-by-id.eval.ts` + 1 in `conversation/response-quality.eval.ts`.)
  - **Every observed reply appends a second boilerplate closer** ("Let me know if you need help!" / "Feel free to ask!"), violating `GENERIC_UI_RENDERING`'s "emit exactly ONE very short plain sentence" rule. Appears to be a general habit gap, not confined to one workflow. (The "single short sentence" rubric lines that caught this were removed with the cases they lived on.)

- **One tool-argument case showed model non-determinism across otherwise-identical runs**: "Extend my Riverside Twin Room booking by 2 nights" (`behavioral/find-booking-by-id.eval.ts`) correctly omitted `requestedGuests` in one run and attached an unprompted `requestedGuests: 2` (matching the fixture's _current_ value) in another. This didn't change the final outcome in either run (2 already equals the booking's guest count) but is worth watching — it's model sampling variance, not a reproducible bug.
- **MODIFY availability has no tool step.** `find_booking_by_id(purpose:"modify")` probes `/bookings/availability` itself for a stated change (merging the stated value, excluding the booking) and attaches `availability` / `stayUnchanged`; the no-stated-change path checks client-side in the `edit_modify_booking` form. The step machine then forces `confirm_modify_booking` or stops — proven without an LLM in `deterministic/find-booking-by-id.eval.ts`. There is no `check_room_availability` tool.
- **Fixture "today"** is computed at eval-run time (`@repo/utils/date`'s `formatTodayYmd`/`addDaysYmd`/`getBusinessDates` — the same helpers `src/mastra/utils/current-date.ts` uses), not hardcoded — so date-argument assertions stay correct regardless of which day the suite runs. Fixture _booking_ dates (`support/fixtures.ts`) are hardcoded to October/November 2026 so they stay comfortably in the future; revisit if this suite is still in use after those dates pass.
- **`conversation/response-quality.eval.ts` costs an extra LLM call per case** (the judge itself calls the model) — keep case counts modest there specifically.
- The historical **MessageMerger/TokenLimiter context-duplication bug** has no live processor named `MessageMerger` to test directly (it's a Mastra-internal class); `conversation/multi-turn-context.eval.ts` instead asserts the observable symptom (every turn in a realistic multi-turn conversation, including a repeated `get_bookings` request, completes without a tripwire and without a runaway step count).
- **Don't launch two `evalite run` processes at once.** Within one process, `test.fileParallelism: false` (`vitest.config.ts`) + `maxConcurrency: 1` (`evalite.config.ts`) already make every case strictly sequential, so `pnpm eval` / `pnpm eval:behavioral` stay under the OpenAI per-minute token budget on their own. But two separate `evalite run` invocations against the same key still race each other into a 200k TPM limit — run them back to back, not in parallel. To run a single file, pass one path substring as the filter: `pnpm eval behavioral/find-room` (the CLI takes exactly one positional, so `pnpm eval:behavioral find-room` — two positionals — is rejected).

## Render dashboard

`render.yaml`'s `homestay-evalite` **Web Service** deploys the dashboard. The
suite runs **once at build time** and the result is exported to a static
bundle; the running service is just a file server, not a live Evalite process.

```
build:   pnpm --filter=evals build:dashboard   →  apps/evals/evalite-export/
start:   pnpm --filter=evals serve:dashboard    →  serves that folder on 0.0.0.0:$PORT
```

`build-dashboard.mjs` (1) runs the suite into an in-memory store, (2)
`exportStaticUI`s it to `evalite-export/report/` under basePath `/report`, and
(3) renders `evalite-export/index.html` — the "Evalite Reports" landing page
(one card per eval, overall score, run timestamp) via `render-landing-page.mjs`.
`serve-static.mjs` serves the tree and falls unknown `/report/*` paths back to
the report SPA shell (it uses a browser router).

Everything stays fixture-backed: no live `apps/api`, no production DB.

### Deploy from `render.yaml` (Blueprint)

Push the branch, then in Render: **New > Blueprint**, point it at this repo.
It picks up the `homestay-evalite` service. Set the one secret it asks for:

| Key              | Value                                                             |
| ---------------- | ---------------------------------------------------------------- |
| `MISTRAL_API_KEY` | from console.mistral.ai — the free "Experiment" tier is enough (needs phone verification + an activated plan, or every call 429s with `x-ratelimit-limit-req-minute: 0`) |

All other env is in `render.yaml`: `AI_PROVIDER=mistral`,
`EVAL_DASHBOARD_PATH=tools`, `AI_SECURITY_MODEL=mistral/mistral-small-latest`,
`EVAL_TPM_BUDGET=150000`, `EVAL_MIN_REQUEST_INTERVAL_MS=1100`,
`API_URL=https://evalite-fixture.invalid`, `MASTRA_DATA_DIR=/tmp/mastra-evalite`,
`PORT=10000`.

### Manual service (no Blueprint)

**New > Web Service**, connect the repo, repo root as root directory:

| Field             | Value                                                          |
| ----------------- | ------------------------------------------------------------- |
| Runtime           | Node                                                           |
| Build command     | `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter=evals build:dashboard` |
| Start command     | `pnpm --filter=evals serve:dashboard`                          |
| Health check path | `/`                                                            |

then add every env var listed above (`MISTRAL_API_KEY` as a secret).

### Notes

- **Build time.** The `tools` suite on Mistral's free tier (1 req/s + retries)
  can run 15–25 min. If Render's build time limit bites, set
  `EVAL_DASHBOARD_PATH=deterministic` (free, seconds) — the landing page and
  report still build, just without the real-LLM rows.
- **Fresh each deploy.** Storage is in-memory; a redeploy re-runs the suite and
  discards prior history. There is no server-side "re-run" button.
- **Access.** The report exposes prompts, outputs, scores, and tool traces. Put
  an IP allow list / access proxy in front before sharing the URL.
- `eval:serve` / `eval:serve:render` still work for a **local** live UI
  (`render-evalite-serve.mjs` is the Fastify 0.0.0.0 bind fix for that path);
  they are no longer what Render runs.

## Vercel deployment

Vercel deploys the dashboard as a static artifact. The build runs the
deterministic suite with one in-memory storage instance, then exports that run
to `apps/evals/evalite-export/`. This avoids a long-running Evalite server and
the native `better-sqlite3` dependency.

From the repository root, create a Vercel project with the repository root as
the project root, then deploy:

```bash
vercel
```

The root `vercel.json` already configures the pnpm install command, the
`evals` package's `vercel:build` script, and the static output directory. Add
these environment variables in Vercel if you later change the build to include
`tools/` or `conversation/` evals:

- `OPENAI_API_KEY`
- `API_URL` = `https://evalite-fixture.invalid`
- `AI_PROVIDER` = `openai`

The default Vercel build runs only `deterministic/`, so it does not require an
API key. The deployed URL is a snapshot from the latest build; use Render's
`evalite serve` service for a live dashboard with server-side reruns.

## CI considerations

There is no CI pipeline in this repository yet (no `.github/workflows`, no other CI config) — this suite doesn't introduce one. If/when CI is added:

- Run `pnpm --filter=evals eval:deterministic` on every PR — it's free (no API key, no network, milliseconds) and catches regressions in the booking step-machine's ordering contract directly.
- Run `pnpm --filter=evals eval:tools` / `pnpm --filter=evals eval:conversation` separately from the fast PR gate — they cost real API tokens, take minutes (the OpenAI free/low tier throttles per-minute tokens; expect `Rate limit approaching, waiting…` pauses), and their non-deterministic-input-deterministic-scoring cases can occasionally fail on model variance even when nothing regressed. A nightly/manual/label-triggered job is more appropriate than a required PR check.
- Either way, always run `pnpm --filter=evals check-types` (typechecks `apps/evals/src/**/*`, following `@agent/*` into `apps/agent/src`) first — it's free and catches the most common eval-authoring mistakes before spending API budget.
