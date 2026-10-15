# HS-QA-04: AI behavior evaluation set

**Labels:** `homestay` `hs-qa-04` `phase::hardening` `layer::tests` `P1` · **Estimate:** M · **Priority:** P1
**Depends on:** HS-AI-05, HS-AI-06 · **Source:** [tickets.md](../tickets.md)

## Goal
Run a prompt-based evaluation of the assistant and record pass/fail.

## Acceptance criteria
- [ ] prompt set TC-AI-01..12 (see [tickets.md](../tickets.md)) run (manual or scripted) with a pass/fail record; failures are logged as bugs.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
