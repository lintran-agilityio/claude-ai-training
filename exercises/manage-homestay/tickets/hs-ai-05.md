# HS-AI-05: Graph with human-in-the-loop confirmation

**Labels:** `homestay` `hs-ai-05` `phase::ai-assistant` `layer::agent` `P0` · **Estimate:** L · **Priority:** P0
**Depends on:** HS-AI-04 · **Source:** [tickets.md](../tickets.md)

## Goal
Graph: understand intent -> choose tool -> (for write) build summary -> `interrupt` -> execute or abort -> respond. Missing info triggers a follow-up question.

## Acceptance criteria
- [ ] Given "book room 3 next weekend", then the agent asks for exact dates/guests if missing.
- [ ] Given complete info, then the graph pauses with a summary (room, dates, guests, price) and waits.
- [ ] Given approval, then the action runs once; given rejection, then nothing is written.
- [ ] Given the user changes the request during confirmation, then the summary is rebuilt.
- [ ] Given a page refresh while paused, then the pending confirmation is restored from the checkpointer.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
