# HS-DB-01: Database schema and migrations

**Labels:** `homestay` `hs-db-01` `phase::foundation` `layer::db` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-OPS-01 · **Source:** [tickets.md](../tickets.md)

## Goal
Tables `users` (id, email unique, password_hash, name, created_at), `rooms` (id, name, description, price_per_night, capacity, photos, is_active), `amenities` + `room_amenities`, `bookings` (id, user_id, room_id, check_in, check_out, guests, total_price, status, cancellation_fee, created_at, updated_at). Alembic migrations.

## Acceptance criteria
- [ ] Given an empty DB, when I run migrations, then all tables are created and can roll back.
- [ ] Given `bookings`, when check_out <= check_in, then the DB rejects it (check constraint).
- [ ] Given `users`, when a duplicate email is inserted, then the DB rejects it.
- [ ] Index exists on `bookings(room_id, check_in, check_out)`.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
