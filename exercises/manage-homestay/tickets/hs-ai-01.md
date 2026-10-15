# HS-AI-01: Agent service setup and endpoint

**Labels:** `homestay` `hs-ai-01` `phase::ai-assistant` `layer::agent` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-BE-01 · **Source:** [tickets.md](../tickets.md)

## Goal
LangGraph agent served in FastAPI and exposed to CopilotKit (remote endpoint / AG-UI). Typed state (`messages`, `user_id`, `pending_action`). `user_id` is taken from the authenticated cookie only. Checkpointer for conversation state.

## Acceptance criteria
- [ ] Given a logged-in user, when the chat sends a message, then the agent responds.
- [ ] Given no valid session, then the agent endpoint returns 401.
- [ ] Given a prompt that includes a different user_id, then it is ignored.
- [ ] API keys are read from env only.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
