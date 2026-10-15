# HS-BE-03: Service layer skeleton (shared by REST and AI)

**Labels:** `homestay` `hs-be-03` `phase::mvp-core` `layer::backend` `P0` · **Estimate:** S · **Priority:** P0
**Depends on:** HS-DB-01 · **Source:** [tickets.md](../tickets.md)

## Goal
Create `services/` (`room_service`, `booking_service`) with typed inputs/outputs and domain errors (`RoomNotFound`, `RoomUnavailable`, `InvalidDates`, `CapacityExceeded`, `NotOwner`, `CancellationNotAllowed`). REST routes and AI tools only call these services. Map domain errors to HTTP codes in one place.

## Acceptance criteria
- [ ] Given the code, then no business rule lives in route handlers.
- [ ] Given each domain error, then it maps to a stable HTTP status and error code.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
