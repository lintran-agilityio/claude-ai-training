# Agent (`apps/agent`)

Mastra agents for Homestay Assistant. Tools call the Nest API for rooms and bookings; CopilotKit consumes the exported agents from the web app.

## Layer ownership

| Layer | Owns | Does not own |
| --- | --- | --- |
| Web | Chat UI, HITL UI, RenderTool, Context, Thread UX, Zustand UI state | Booking orchestration, business state |
| CopilotKit Runtime / BFF | `/api/copilotkit`, auth forwarding, Intelligence | Business logic |
| AG-UI bridge (`src/ag-ui`) | Stream adaptation, stop latch, tripwire compatibility | Prompts, tools |
| Mastra | Agents, memory, tools | React / UI |
| Nest | Domain logic, persistence | Orchestration |

Mastra should stay usable if CopilotKit is later replaced by AG-UI directly.

## Stack

- Mastra (`@mastra/core`, memory, observability, LibSQL / DuckDB storage)
- AG-UI Mastra adapter (`@ag-ui/mastra`)
- OpenAI models (e.g. `openai/gpt-4o-mini`)
- Shared packages: `@repo/constants`, `@repo/types`, `@repo/utils`

Requires Node.js `>=22.13.0`.

## Agents

Registered in `src/mastra/index.ts` (Studio) and `src/mastra/runtime.ts` (CopilotKit runtime):

| Agent | Key | Role |
| --- | --- | --- |
| Homestay Manager | `homestay-assistant` | Public chat agent: rooms + booking flows |

One agent today — no specialist agents under `agents/` yet.

## Tools

| Domain | Tools |
| --- | --- |
| Rooms | `get_rooms`, `find_room`, `get_room_by_id` |
| Bookings | `check_room_availability`, `create_booking`, `update_booking`, `get_bookings`, `find_bookings`, `find_booking_by_id`, `cancel_booking` |

Frontend HITL tools (`confirm_booking`, `edit_modify_booking`, `confirm_modify_booking`, `show_cancel_dialog_confirm`, `update_room_list`) are registered in the web app.

Tool implementations call `API_URL` via services in `src/mastra/services/`.

## Storage

| File | Used by |
| --- | --- |
| `mastra-runtime.db` | CopilotKit / AG-UI runtime (`runtime.ts`) |
| `mastra-studio.db` | Mastra Studio (`index.ts`) — starts clean |
| `mastra.duckdb` | Studio observability only |

Directory resolves from `process.cwd()/src/mastra/public` (or `MASTRA_DATA_DIR`). Next BFF uses `apps/web/...`; Studio uses `apps/agent/...`.

## Exports

`package.json` exports used by `web`:

| Export | Path | Use |
| --- | --- | --- |
| `agent` | `./src/mastra/index.ts` | Studio Mastra instance |
| `agent/copilotkit` | `./src/copilotkit.ts` | `getCopilotkitAgents` for the web runtime |
| `agent/middleware` | `./src/mastra/middleware/index.ts` | Request ALS / Clerk pipeline |

## Environment

```sh
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | Required for model calls |
| `API_URL` | Nest API base URL (default `http://localhost:5001`) |
| `MASTRA_DATA_DIR` | Optional override for LibSQL / DuckDB directory |
| `MASTRA_PLATFORM_ACCESS_TOKEN` | Optional — Mastra Platform observability |
| `MASTRA_PROJECT_ID` | Optional — Mastra Platform project |
| `OPENAI_TRACING` | Optional — tracing flag |

Ensure the **api** app is running before exercising tools that hit rooms/bookings.

## Run

From the monorepo root:

```sh
pnpm install
pnpm agent
```

Or from this directory:

```sh
pnpm dev
```

Mastra Studio: [http://localhost:4111](http://localhost:4111)

## Project layout

```
src/
  ag-ui/                 # abort controllers, transcript filters, tripwire, stream-patch, stop latch
  copilotkit.ts          # AG-UI agent export for web (+ ThreadMemoryPort inject)
  mastra/
    agents/              # homestay-assistant
    booking/             # HITL prefill / stop-after-handoff helpers
    tools/               # rooms + booking tools
    schemas/
    services/
    constants/
      prompts/           # intent playbook (golden wording)
      working-memory.ts  # soft draft hints (not step machine)
    index.ts             # Studio Mastra (mastra-studio.db)
    runtime.ts           # CopilotKit Mastra (mastra-runtime.db)
```

## Naming map (Phase 4)

| Concept | Canonical name | Deprecated alias |
| --- | --- | --- |
| LLM instruction sections | intent playbook / `PLAYBOOK_*` | `WORKFLOW_*` section keys (wording unchanged) |
| Web suggestion state | UI focus stack (`uiFocusEntries`, `pushUiFocus`) | `workflowEntries`, `pushWorkflow` |
| Report HITL focus | `useReportHomestayAgentUiFocus` | `useReportHomestayAgentWorkflow` |

Prompt **strings** stay golden — Phase 4 only splits/comments/aliases.

## Regression checklist

After Milestone A / Phase 4 (structure + naming only — no prompt/tool-order changes), verify:

1. Browse all / find room → cards
2. Book stay → confirm → create
3. Modify → edit → confirm → update
4. Cancel → dialog → cancel
5. Stop mid-run (first click)
6. New thread / switch thread
7. Reload page → history still there (`mastra-runtime.db`)
8. Suggestion pills still appear during confirm / modify / cancel HITL

## Docs

- [Mastra docs](https://mastra.ai/docs/)
- [Mastra Studio](https://mastra.ai/docs/studio/overview)
- Local agent rules: [`AGENTS.md`](./AGENTS.md)
