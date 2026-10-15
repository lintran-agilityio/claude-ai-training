# HS-BE-07: Cancel booking endpoint

**Labels:** `homestay` `hs-be-07` `phase::manage-bookings` `layer::backend` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-BE-06, open question 1 · **Source:** [tickets.md](../tickets.md)

## Goal
`DELETE /bookings/{id}` (soft cancel) applying policy A4. Also `GET /bookings/{id}/cancellation-preview` returning the fee without changing data (used by confirm dialogs and AI).

## Acceptance criteria
- [ ] Given my booking >= 48h before check-in, then status cancelled, fee 0.
- [ ] Given my booking < 48h before check-in, then cancelled with fee = 1 night.
- [ ] Given a booking of another user, then 403 (or 404, see note) and no change.
- [ ] Given an already cancelled booking, then 409.
- [ ] Given check-in already started or passed, then 422 `CancellationNotAllowed`.
- [ ] Given a cancelled booking, then its dates become available again.
- [ ] Note: return 404 for other users' bookings to avoid leaking existence; decide and keep consistent.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
