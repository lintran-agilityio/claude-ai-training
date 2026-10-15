# Answer key: BUG-HS-001 (do not read before attempting)

**Root cause:** `apps/api/src/modules/booking/repositories/booking.repository.ts`, `hasOverlappingBooking`. The condition `booking.checkOutDate > :checkInDate` was changed to `>=`, so a booking that ends on the new check-in day counts as an overlap. This breaks rule A1 (stay = `[check_in, check_out)`).

**Correct condition:** `new.in < old.out AND new.out > old.in`, i.e. `booking.checkInDate < :checkOutDate AND booking.checkOutDate > :checkInDate`.

**Blast radius:** `create`, `update` (dates change), `checkAvailability`, and therefore the AI availability/booking tools. The other filters in the same file (`onDate`, `dateFrom/dateTo`) still use `>` so room search and booking lists stay correct, which makes the bug look inconsistent.

**Missing tests:** touching dates (10-12 then 12-14, and 8-10 then 10-12) must be available; 11-13, 9-11, 10-12, 9-13 must be unavailable. See HS-BE-04 acceptance criteria. `apps/api/test` only has the default e2e spec.

**Fix:** revert `>=` to `>` and add the boundary tests.
