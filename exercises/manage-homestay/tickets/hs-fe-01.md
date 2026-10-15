# HS-FE-01: Auth pages and session context

**Labels:** `homestay` `hs-fe-01` `phase::mvp-core` `layer::frontend` `P0` · **Estimate:** L · **Priority:** P0
**Depends on:** HS-BE-01 · **Source:** [tickets.md](../tickets.md)

## Goal
Register and login pages, logout button, `AuthProvider` with current user, loading state.

## Acceptance criteria
- [ ] Given valid input, then I register/login and land on the rooms page.
- [ ] Given server errors (wrong password, duplicate email), then a clear inline message shows.
- [ ] Given client validation fails, then the submit is blocked with field messages.
- [ ] Given logout, then user context is cleared and I return to login.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
