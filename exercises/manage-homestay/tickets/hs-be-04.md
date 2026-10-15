# HS-BE-04: Availability and pricing logic

**Labels:** `homestay` `hs-be-04` `phase::mvp-core` `layer::backend` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-BE-03 · **Source:** [tickets.md](../tickets.md)

## Goal
`check_availability(room_id, check_in, check_out, exclude_booking_id=None)` using rule A1, only counting `confirmed` bookings. `calculate_price(room, check_in, check_out)`. Date validation per A2.

## Acceptance criteria
- [ ] Given an existing booking 10-12, when I check 12-14, then available (touching dates OK).
- [ ] Given an existing booking 10-12, when I check 11-13, 9-11, 10-12, or 9-13, then unavailable.
- [ ] Given a cancelled booking on those dates, then available.
- [ ] Given check_in in the past, check_out <= check_in, or > 30 nights, then `InvalidDates`.
- [ ] Given `exclude_booking_id`, then that booking is ignored (needed for edit).
- [ ] Price = nights x price_per_night, verified for 1 and N nights.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
