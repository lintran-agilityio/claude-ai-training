# HS-AI-08: Agent observability and error handling

**Labels:** `homestay` `hs-ai-08` `phase::ai-assistant` `layer::agent` `P2` · **Estimate:** S · **Priority:** P2
**Depends on:** HS-AI-05 · **Source:** [tickets.md](../tickets.md)

## Goal
Log tool calls (no secrets, no passwords), timeouts and retry for the LLM, friendly message on LLM failure.

## Acceptance criteria
- [ ] Given the LLM is unreachable, then the user sees a friendly error and can retry.
- [ ] Logs show tool name, args and result status, with no secrets.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
