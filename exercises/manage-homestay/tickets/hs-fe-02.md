# HS-FE-02: Protected routes and layout

**Labels:** `homestay` `hs-fe-02` `phase::mvp-core` `layer::frontend` `P0` · **Estimate:** S · **Priority:** P0
**Depends on:** HS-FE-01 · **Source:** [tickets.md](../tickets.md)

## Goal
Route guard for rooms, bookings and chat; redirect to login with return URL; shared header showing the user.

## Acceptance criteria
- [ ] Given I am logged out, when I open a protected URL, then I am redirected to login and returned after login.
- [ ] Given a 401 from any API call, then I am sent to login.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
