# HS-BE-08: Edit booking endpoint

**Labels:** `homestay` `hs-be-08` `phase::manage-bookings` `layer::backend` `P0` · **Estimate:** L · **Priority:** P0
**Depends on:** HS-BE-06 · **Source:** [tickets.md](../tickets.md)

## Goal
`PATCH /bookings/{id}` to change dates and/or guests. Re-validates, re-checks availability excluding itself, recalculates price. Only confirmed, future bookings can be edited. Response includes old and new price.

## Acceptance criteria
- [ ] Given my booking, when I extend into free dates, then updated with new total.
- [ ] Given new dates overlapping another booking, then 409 and the original is unchanged.
- [ ] Given new dates overlapping only my own current dates, then allowed.
- [ ] Given guests > capacity, then 422.
- [ ] Given someone else's booking, then 403/404 consistent with HS-BE-07.
- [ ] Given a cancelled or past booking, then 422.
- [ ] Given an empty patch, then 422.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
