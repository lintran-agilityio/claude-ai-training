# AGENTS.md

## CRITICAL: Load `mastra` skill first

Load the `mastra` skill BEFORE any Mastra work. Never rely on cached knowledge — APIs change between versions.

## Rules

- Register all agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Use the `dev` and `build` scripts from `package.json` instead of running `mastra dev` / `mastra build` directly

## Stack ownership (CopilotKit v2 + AG-UI + Mastra)

| Layer | Path | Owns |
| --- | --- | --- |
| CopilotKit v2 UI | `apps/web` | Chat UI, HITL tools, Stop click / idle, presentation state |
| AG-UI bridge | `apps/agent/src/ag-ui` | Adapt Mastra ↔ CopilotRuntime; inject `abortSignal` on Stop; transcript/stream compatibility (`abort-controllers`, `transcript-filters`, `tripwire`, `stream-patch`) |
| Mastra | `apps/agent/src/mastra` | Agent, tools, processors, memory; honor `abortSignal` |

### Feature flow order (booking-like)

1. **Mastra** — tool chain + playbook (`HITL confirm → mutation`); keep schemas stable; update descriptions when UI owns success/failure on the same card
2. **CopilotKit HITL** — confirm/cancel UI + `respond()`
3. **CopilotKit mutation render** — headless notice bridges status into presentation phase store (no second success card)
4. **AG-UI** — only for stream/abort/transcript bridge issues

Stop must propagate `AbortSignal` into `agent.stream()` and tool `execute` / Nest `fetch({ signal })`. Do not treat Stop as “close the browser socket only.”

### UI: presentation vs transcript data

The UI must **not** be the long-term home for transcript/memory data fixes. Client workarounds such as `AgentMessagesSanitizer` (normalize/dedupe) or `update_room_list` guards after `find_room` are **temporary compatibility layers**. Phase them out once AG-UI/Mastra memory replay is correct, or once AG-UI transcript filters / `stream-patch` (or upstream) fix the issue at the source.

The UI **does** own presentation state: animations, optimistic rendering, streaming bubbles, dismissing/dimming an incomplete message on Stop, and deriving blocked styling at render from transcript markers (without rewriting `agent.messages`).

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
- [Skills Discovery](https://mastra.ai/.well-known/skills/index.json)
