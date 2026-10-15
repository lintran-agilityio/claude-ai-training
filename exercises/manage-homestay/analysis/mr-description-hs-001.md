## Fix: allow a booking to start on another guest's check-out day (BUG-HS-001)

### What
- Changes the date-overlap condition in `BookingRepository.hasOverlappingBooking` from `checkOutDate >= :checkInDate` to `checkOutDate > :checkInDate` (1 line, `booking.repository.ts:109`).
- Adds `booking.repository.spec.ts`, an integration test for the overlap rule (9 cases).
- Updates the BUG-HS-001 report in `exercises/day-02-exercises.md` (Part 3) with the test evidence (docs only).

### Why
A room with a booking 10-12 rejected a new booking 12-14 with `409 Room "..." is not available for the selected dates`, and the AI assistant told the guest the room was unavailable.

Our rule (assumption A1) is that a stay is `[check_in, check_out)`: the check-out day is free for the next guest. Two stays overlap only when `old.in < new.out AND old.out > new.in`. The `>=` made a stay that ends on the new check-in day count as an overlap.

Affected: create booking, edit booking dates, check availability, and every AI tool that calls them. Room search is not affected (it uses a different filter that already had `>`).

### How I tested
The rule is in a SQL query, so the test runs against a real PostgreSQL. It creates a temporary schema and drops it afterwards, so dev data is untouched.

```
cd apps/api
docker compose up -d
pnpm exec jest booking.repository
```

Existing booking is 10-12. Cases:

| New stay | Expected |
|---|---|
| 12-14, 8-10, 13-15 | free |
| 11-13, 9-11, 10-12, 9-13 | blocked |
| 10-12 when the existing booking is cancelled | free |
| 10-12 with `excludeBookingId` = the existing booking (edit flow) | free |

Commits are ordered so you can see both states:
- `66d8f73` (test only): 1 failed, 8 passed. Failing case: 12-14, expected `false`, received `true`.
- `57e91a2` (fix): 9 passed.

### Screenshots
- [ ] Test output before the fix (checkout `66d8f73`)
- [ ] Test output after the fix (this branch)

### Notes for the reviewer
- The test mocks `@repo/utils` because it is ESM-only and jest runs CommonJS. The repository only uses it in `findAll`, not in the query under test.
- Not tested: the HTTP endpoint and the AI assistant. Only the repository query was reproduced.
- `apps/api/test` still has only the default e2e spec. An endpoint-level test is a possible follow-up, kept out of this MR on purpose.
- Ticket: `exercises/manage-homestay/tickets/bug-hs-001.md`. Bug report: `exercises/day-02-exercises.md`, Part 3.
