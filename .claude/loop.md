# Loop: test, build and code cleanup

Default prompt for `/loop` with no arguments. Work in `exercises/manage-homestay/homestay-assistant`.

## Each run

1. Check what changed: `git status --short` and `git diff --stat`. If nothing changed since the last run, reply "no change" and stop.
2. Run the checks (the project uses pnpm), cheapest first:
   - `pnpm run check-types`
   - lint changed files only: `pnpm exec eslint <changed files>` from `apps/api`, WITHOUT `--fix`
   - `pnpm --filter api test` (jest)
   - `pnpm run build`
3. Clean up only the files that changed: unused imports and variables, dead code, leftover `console.log` / debug code. Format only changed files with `pnpm exec prettier --write <file>`.

Never run `pnpm run lint` or `pnpm --filter api run lint`: the api script uses `--fix` on every file and rewrites unrelated files (quotes, line endings), and `@repo/components` has no eslint config so the root lint always fails.

Known baseline (not caused by the working tree, report only): `src/app.controller.spec.ts` fails to parse in jest, and `src/main.ts` has a `no-floating-promises` warning.

## What Claude may fix automatically

- Allowed: lint and format fixes, unused imports/variables, dead code, leftover debug code, type errors with an obvious fix.
- Not allowed: changing business logic, pricing, booking rules, test expectations, dependencies, config or database migrations.
- A failing test or a real bug is never fixed in the loop. Report it and leave the code as it is; the user and Claude fix it together afterwards.
- Never commit, push, merge or delete files.

## Report

Keep it under 12 lines, in this shape:

- **Checks:** type-check / lint / test / build, each pass or fail.
- **Fixed:** each automatic fix as `file: what changed`.
- **Needs attention:** bugs and failing tests with file, line and the likely cause, left for the user.

If every check passes and there was nothing to clean up, reply "all green, nothing to fix".

## Pace

Every 5 minutes while the user is actively editing, every 20-30 minutes when the working tree has not changed.
