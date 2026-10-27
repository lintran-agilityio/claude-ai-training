# Review guide

Stack: pnpm + turbo monorepo under `exercises/manage-homestay/homestay-assistant/`
(NestJS + TypeORM API in `apps/api`, Mastra agent in `apps/agent`, Next.js `apps/web`).

## What Important means here

Reserve Important for findings that break behavior, corrupt or leak data, or break
rollback: incorrect logic, race conditions, missing authorization, migrations that
are not backward-compatible (e.g. dropping or renaming a column the previous release
still reads). Style, naming and refactoring suggestions are Nit at most.

## Cap the nits

Report at most five Nits per review. Drop the rest.

## Do not report

- Anything eslint, prettier or `check-types` already enforces (`pnpm lint`, `pnpm format`, `pnpm check-types`).
- Generated or build output: `**/dist/**`, `**/build/**`, `apps/web/.next/**`,
  `apps/agent/.mastra/output/**`, `.turbo/**`.
- Lockfiles and vendored code: `pnpm-lock.yaml`, `patches/*.patch`, `node_modules/**`,
  `apps/agent/.claude/skills/mastra/**`.
- Test-only code (`*.spec.ts`, `test/`, `apps/evals/`) that intentionally breaks production rules.

## Always check (booking feature, `apps/api/src/modules/booking`)

- A room cannot have two overlapping bookings. The overlap check and the insert must
  run in the same transaction; a check followed by a separate insert is Important.
- All times are stored and compared in UTC. Flag local-time parsing or comparison.
- Booking endpoints verify the caller may manage that booking (not just that the user
  is authenticated via `ClerkAuthGuard`).
- New API routes come with an integration test.

## Evidence

Behavior claims need a `file:line` citation. Do not infer behavior from names.
