# AGENTS.md (web)

## Stack ownership (CopilotKit v2 UI)

This app owns chat UI, HITL / generative tools, Stop click / idle, and **presentation state**.

Transcript and memory correctness belong upstream:

| Layer | Path | Owns |
| --- | --- | --- |
| CopilotKit v2 UI | `apps/web` | Presentation, Stop UX, HITL render |
| AG-UI bridge | `apps/agent/src/ag-ui` | Stream adapt, abort inject, transcript filters (`abort-controllers`, `transcript-filters`, `tripwire`, `stream-patch`) |
| Mastra | `apps/agent/src/mastra` | Agent, tools, processors, memory |

### Feature flow order (booking-like)

Implement each flow **per layer**, in order:

1. **Mastra** — HITL tool → mutation tool, prompts, pins (schemas stable)
2. **CopilotKit HITL** — `useHumanInTheLoop` card + `respond({ confirmed })`
3. **CopilotKit mutation UI** — headless `useRenderTool` notice → phase store; same HITL card shows `review → submitting → success | failed | cancelled | expired`
4. **AG-UI** — only if stream/abort/transcript is broken

Do not call mutation tools from the UI. Retry = user chat message. Pass tool `parameters` into headless notices for correlation-key matching. On history/refresh, derive HITL success/failed from mutation results in `agent.messages` when the Zustand phase store is empty (presentation only).

### Presentation vs temporary data workarounds

**Keep in the UI (presentation):**

- Animations, optimistic rendering, streaming bubbles
- Dismissing / dimming an incomplete assistant message when the user clicks Stop
- Deriving blocked styling from transcript shape / metadata at render (`isUserMessageBlockedInTranscript`)
- Choosing which generative cards to show in a turn (e.g. latest `find_room`)
- Same-card HITL phase machines (create/cancel/modify booking)

**Treat as temporary compatibility (phase out when source is fixed):**

- `AgentMessagesSanitizer` message normalize / same-id dedupe for reconnect gaps
- `update_room_list` no-op after `find_room` when the model still double-emits
- Re-trim loops that fight Intelligence reconnect replaying a stopped turn

Do not add new long-term transcript fixes in the UI. Prefer AG-UI (`stream-patch` / transcript filters) or Mastra memory/processors.
