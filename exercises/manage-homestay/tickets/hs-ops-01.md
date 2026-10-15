# HS-OPS-01: Project scaffold and environment

**Labels:** `homestay` `hs-ops-01` `phase::foundation` `layer::devops` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** none · **Source:** [tickets.md](../tickets.md)

## Goal
Create monorepo `frontend/` (Next.js) and `backend/` (FastAPI). Add `.env.example`, `.gitignore` (excludes `.env`), lint/format config, README with run steps, and a CI job that runs tests.

## Acceptance criteria
- [ ] Given a fresh clone, when I follow the README, then frontend and backend both start locally.
- [ ] Given the repo, when I search it, then no real secret is committed; `.env.example` lists all variables.
- [ ] Given a push, when CI runs, then lint and tests run and report status.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
