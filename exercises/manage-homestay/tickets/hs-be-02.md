# HS-BE-02: Rooms API (list and detail)

**Labels:** `homestay` `hs-be-02` `phase::mvp-core` `layer::backend` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-DB-02 · **Source:** [tickets.md](../tickets.md)

## Goal
`GET /rooms` (paginated), `GET /rooms/{id}`. Response includes photos, price, capacity, amenities. Optional `check_in`/`check_out` returns an `available` flag per room.

## Acceptance criteria
- [ ] Given seeded rooms, when I call `GET /rooms`, then I get a paginated list of active rooms.
- [ ] Given a valid id, when I call detail, then I get full info; given an unknown id, then 404.
- [ ] Given dates, then each room has a correct `available` value (uses HS-BE-04).
- [ ] Inactive rooms are never returned.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
