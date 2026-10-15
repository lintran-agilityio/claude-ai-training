# HS-FE-10: Generative UI (room cards, confirmation dialog)

**Labels:** `homestay` `hs-fe-10` `phase::ai-assistant` `layer::frontend` `P0` · **Estimate:** L · **Priority:** P0
**Depends on:** HS-FE-09, HS-AI-05 · **Source:** [tickets.md](../tickets.md)

## Goal
Render room results as cards in chat; render the confirmation summary as a UI with Confirm / Cancel buttons wired to the interrupt.

## Acceptance criteria
- [ ] Given search results, then room cards show in chat and link to detail.
- [ ] Given a pending write action, then a summary with Confirm/Cancel shows; buttons are disabled after one click.
- [ ] Given a booking changed by AI, then the bookings page shows the update after refresh.
- [ ] ### QA

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
