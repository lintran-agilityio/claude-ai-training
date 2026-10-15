# HS-BE-06: Create booking endpoint

**Labels:** `homestay` `hs-be-06` `phase::mvp-core` `layer::backend` `P0` · **Estimate:** L · **Priority:** P0
**Depends on:** HS-BE-01, HS-BE-04 · **Source:** [tickets.md](../tickets.md)

## Goal
`POST /bookings` for the logged-in user. Validates room, dates, guests <= capacity, availability, then saves with price snapshot. The availability check and insert run in one transaction with a lock/constraint so concurrent requests cannot double-book.

## Acceptance criteria
- [ ] Given valid input, then 201 with booking id, total price, status confirmed.
- [ ] Given overlapping dates, then 409 `RoomUnavailable`.
- [ ] Given guests > capacity, then 422 `CapacityExceeded`.
- [ ] Given past dates or invalid range, then 422.
- [ ] Given unknown or inactive room, then 404.
- [ ] Given no login, then 401. `user_id` always comes from the session, never from the body.
- [ ] Given two simultaneous requests for the same room and dates, then exactly one succeeds.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
