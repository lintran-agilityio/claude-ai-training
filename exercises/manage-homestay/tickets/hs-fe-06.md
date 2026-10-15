# HS-FE-06: Booking form and confirmation

**Labels:** `homestay` `hs-fe-06` `phase::mvp-core` `layer::frontend` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-BE-06, HS-FE-04 · **Source:** [tickets.md](../tickets.md)

## Goal
Form with dates, guests, price summary; submit; success page with booking details.

## Acceptance criteria
- [ ] Given valid data, then booking is created and the summary shows.
- [ ] Given 409 overlap, then message "room no longer available" and form stays editable.
- [ ] Given a double click on submit, then only one booking is created.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
