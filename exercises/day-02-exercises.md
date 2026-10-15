# Day 2 – Ticket analysis, reproduce and understand

## Part 1 – Ticket analysis

**Write the three-sentence analysis** (Each run in new Chat)

- V1 (typed as a quick question, with the typo):

```
  Please help to analysis this ticket: [ticker name]
```

- V2 adds a role, "use ONLY the ticket text", a fixed 3-sentence format and questions for the reporter:

```
  I'm Developer is implement practice integrate Copiotkit v2 and LangChain + Langgraph, I want to analyzing ticker before starting coding.
  Use ONLY the ticker text below, do not assume anything not writen in this prompt
  Analysic exactly 3 number sentences:
  1. What the ticker asks for
  2. What is ambiguous or missing.
  3. The first step I should take.
  Then list up to 5 clarifying questions for the reporter, ordered by which one blocks work the most. Mark any assumption you make.
  Ticket: [Ticket name]
```

## Part 2 – Comparison V1 vs V2

Raw outputs: [day-02-analysis-results.md](day-02-analysis-results.md).

| Ticket | V1 (quick question) | V2 (structured prompt) | Better | Why |
|---|---|---|---|---|
| `HS-AI-01` Agent setup | Full report: AC rewrites, 12 tests. Flags CORS/cookie hand-off, thread isolation, `MemorySaver` limits. Assumes Next.js proxy + Anthropic (marked) | 3 sentences + 5 questions. Top question: what HS-BE-01 provides. Nothing invented | V1 | Finds real risks and proposes answers. V2 is correct but only asks questions |
| `HS-AI-02` Read-only tools | Gap table (unknown room, error envelope, result cap, inactive rooms), 21 tests. Notes BE-05 lacks single-room availability | Follows format. Asks about BE-05, tool I/O, error shape. "Assumptions: none" | V1 | Gives concrete defaults (error envelope, cap 10); V2 only lists unknowns |
| `HS-AI-03` list_my_bookings | Data-leak focus: inject `user_id` from state, schema must hide it, empty result. Spots stray `### Frontend` in BE-09 | Follows format. Asks how identity reaches the tool, result fields, error format. First step is a failing isolation test | Tie | V1 is more complete; V2's first step is more actionable |
| `HS-AI-04` Write tools | Defines `pending_action` shape, args drift after approval, replay, 404 vs 403; suggests splitting by tool | Follows format. Asks what a confirmed `pending_action` is, who sets it, arg matching | V1 | Finds hidden risks (execute stored args, execute once). V2 finds the main gap but offers no solution |
| `HS-AI-05` HITL graph | 11 gaps, 24 tests. Flags `MemorySaver` vs refresh/restart, node re-run after `interrupt`, stale Confirm, wrong-user resume | Follows format. Asks about approve/reject mechanism, scope, price source, "runs once" | V1 | Catches technical traps; V2 questions are correct but generic |

**Pattern across all tickets**

| | V1 | V2 |
|---|---|---|
| Length | Very long (8 sections, 12-24 tests) | Short (3 sentences + 5 questions) |
| Strength | Real gaps and risks, uses other tickets as context, test cases | Exact format, no invented facts, prioritised questions |
| Weakness | Not requested, mixes in assumptions, hard to scan | Mostly "what does HS-xx provide?", no suggested answers |
| Best for | Planning and test design | Quick triage before asking the reporter |

## Part 3 – Reproduce the bug

Ticket: [BUG-HS-001](manage-homestay/tickets/bug-hs-001.md) (seeded on branch `feat/seed-bug`).

### Bug report

**Title:** Cannot book a room starting on the day another guest checks out

**Severity / priority:** Major / P1. Blocks valid bookings and lowers occupancy. No data loss.

**Environment:** `apps/api` (NestJS + TypeORM + PostgreSQL), branch `feat/seed-bug`, commit `3e40fdd`.

**Steps to reproduce**
1. Start Postgres (`docker compose up -d` in `apps/api`), run `pnpm db:migrate` and `pnpm db:seed`.
2. As guest A, create a booking for room R: check-in `D+10`, check-out `D+12`.
3. As guest B, `GET /bookings/availability?roomId=R&checkInDate=D+12&checkOutDate=D+14` (or `POST /bookings` with the same dates).

**Expected:** `datesAvailable: true` / booking created (stay is `[check_in, check_out)`, rule A1).
**Actual:** `datesAvailable: false` / `409 Room "R" is not available for the selected dates`. AI assistant reports the room as unavailable.

**Boundary table** (existing booking 10-12)

| New stay | Should be | Expected after fix | Before fix (test run) |
|---|---|---|---|
| 12-14 (starts on old check-out) | available | available | **blocked** |
| 8-10 (ends on old check-in) | available | available | available |
| 13-15 (one-day gap) | available | available | available |
| 11-13, 9-11, 10-12, 9-13 | unavailable | unavailable | unavailable |

Only the "new check-in == old check-out" case is wrong, which matches the reporter's note that a gap day works.

**Root cause:** `hasOverlappingBooking` in [booking.repository.ts:109](manage-homestay/homestay-assistant/apps/api/src/modules/booking/repositories/booking.repository.ts#L109) uses `booking.checkOutDate >= :checkInDate`. The correct overlap test is `old.in < new.out AND old.out > new.in`, so it must be `>`. With `>=`, a booking that ends on the new check-in day counts as an overlap. Other filters in the same file (`onDate`, `dateFrom/dateTo`) still use `>`, which is why room search looks fine.

**Impact:** `create`, `update` (when dates change), `checkAvailability`, and every AI tool that calls them.

**Proposed fix:** change `>=` to `>` on that line.

**Tests that should exist:** the boundary table above (HS-BE-04 acceptance criteria), plus edit a booking with `excludeBookingId` and a cancelled booking not blocking. `apps/api/test` currently has only the default e2e spec.

**Evidence:** reproduced with an integration test against PostgreSQL 16 (Docker), [booking.repository.spec.ts](manage-homestay/homestay-assistant/apps/api/src/modules/booking/repositories/booking.repository.spec.ts).
- Before the fix (commit `66d8f73`): `1 failed, 8 passed`. The only failure is "free when new stay starts on the existing check-out day (12-14)": expected `false`, received `true`.
- After the fix (commit `57e91a2`, `>=` changed to `>`): `9 passed`.
- Reproduced at repository level, not through the HTTP endpoint or the AI assistant.

**Commands:** `docker compose up -d` then `pnpm exec jest booking.repository` in `apps/api`.
