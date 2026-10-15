# HS-AI-02: Read-only tools (search_rooms, get_room_details, check_availability)

**Labels:** `homestay` `hs-ai-02` `phase::ai-assistant` `layer::agent` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-AI-01, HS-BE-05 · **Source:** [tickets.md](../tickets.md)

## Goal
Tools call the service layer, Pydantic input schemas, clear docstrings, structured errors.

## Acceptance criteria
- [ ] Given valid args, then the tool result equals the REST result for the same query.
- [ ] Given invalid args (bad date), then a structured error, not an exception.
- [ ] Given a service failure, then the tool returns a failure message the agent must relay.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
