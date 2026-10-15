# HS-FE-08: Edit booking UI

**Labels:** `homestay` `hs-fe-08` `phase::manage-bookings` `layer::frontend` `P1` · **Estimate:** M · **Priority:** P1
**Depends on:** HS-BE-08, HS-FE-07 · **Source:** [tickets.md](../tickets.md)

## Goal
Edit form prefilled; shows old vs new price before saving.

## Acceptance criteria
- [ ] Given I change dates, then the new price is previewed before I save.
- [ ] Given a 409 or 422, then the error shows and the original booking stays displayed.
- [ ] ### AI agent (LangGraph + CopilotKit)

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
