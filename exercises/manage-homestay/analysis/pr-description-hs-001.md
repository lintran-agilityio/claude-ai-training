## What
Changed the overlap check in `BookingRepository.hasOverlappingBooking` from `checkOutDate >= :checkInDate` to `checkOutDate > :checkInDate`, so a stay can start on another guest's check-out day. Added a repository integration spec.

## Why
Closes #7. A guest was rejected (409, room unavailable) when the previous stay ended on the day they arrive.

## How tested
```
cd apps/api
docker compose up -d
pnpm exec jest booking.repository
```
[screenshot of test output]

## Notes for reviewer
- Files: `booking.repository.ts` (1 line), `booking.repository.spec.ts` (new), `exercises/day-02-exercises.md` (bug report update).
- Not changed: room search filter, HTTP endpoint, e2e tests.
