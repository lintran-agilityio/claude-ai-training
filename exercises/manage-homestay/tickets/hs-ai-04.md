# HS-AI-04: Write tools (create_booking, update_booking, cancel_booking)

**Labels:** `homestay` `hs-ai-04` `phase::ai-assistant` `layer::agent` `P0` · **Estimate:** L · **Priority:** P0
**Depends on:** HS-AI-01, HS-BE-06..08 · **Source:** [tickets.md](../tickets.md)

## Goal
Tools call the same services as REST. They never execute without a confirmed `pending_action`.

## Acceptance criteria
- [ ] Given no confirmation in state, then the tool refuses to write.
- [ ] Given a booking owned by another user, then the tool fails with NotOwner and no change.
- [ ] Given business rule errors (overlap, capacity), then the tool returns them clearly.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
