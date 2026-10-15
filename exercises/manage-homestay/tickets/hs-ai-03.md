# HS-AI-03: list_my_bookings tool

**Labels:** `homestay` `hs-ai-03` `phase::ai-assistant` `layer::agent` `P0` · **Estimate:** S · **Priority:** P0
**Depends on:** HS-AI-01, HS-BE-09 · **Source:** [tickets.md](../tickets.md)

## Goal
Let the agent list the logged-in user's bookings through the shared service layer.

## Acceptance criteria
- [ ] Given a user, then only that user's bookings are returned.
- [ ] The tool has no `user_id` parameter exposed to the model.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
