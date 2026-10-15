# HS-DB-02: Seed data

**Labels:** `homestay` `hs-db-02` `phase::foundation` `layer::db` `P0` · **Estimate:** S · **Priority:** P0
**Depends on:** HS-DB-01 · **Source:** [tickets.md](../tickets.md)

## Goal
Script that seeds 8-10 rooms (varied price 20-150, capacity 1-6, amenities), 1-2 test users, and a few bookings (including one in the past and one cancelled).

## Acceptance criteria
- [ ] Given an empty DB, when I run the seed, then rooms, amenities and test data exist.
- [ ] Given the seed is run twice, then no duplicates are created (idempotent).
- [ ] Test user passwords in seed come from env or are clearly dev-only.
- [ ] ### Backend API and services

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
