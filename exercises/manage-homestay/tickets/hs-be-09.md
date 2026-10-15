# HS-BE-09: List my bookings and booking detail

**Labels:** `homestay` `hs-be-09` `phase::manage-bookings` `layer::backend` `P0` · **Estimate:** S · **Priority:** P0
**Depends on:** HS-BE-06 · **Source:** [tickets.md](../tickets.md)

## Goal
`GET /bookings` (mine only, filter by status, newest first), `GET /bookings/{id}`.

## Acceptance criteria
- [ ] Given I have bookings, then I only see mine.
- [ ] Given a status filter, then only that status returns.
- [ ] Given someone else's id, then 403/404 consistent with HS-BE-07.
- [ ] ### Frontend

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
