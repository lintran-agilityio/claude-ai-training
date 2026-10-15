# HS-QA-01: Backend unit and API tests

**Labels:** `homestay` `hs-qa-01` `phase::hardening` `layer::tests` `P0` · **Estimate:** L · **Priority:** P0
**Depends on:** HS-BE-04..09 · **Source:** [tickets.md](../tickets.md)

## Goal
Automate backend unit and API tests for auth, availability, create, edit, cancel and search.

## Acceptance criteria
- [ ] all cases in TC-BE in [tickets.md](../tickets.md) automated; coverage on availability, edit and cancel logic is complete for the listed boundaries; tests run in CI.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
