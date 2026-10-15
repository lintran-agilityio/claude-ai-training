# HS-QA-02: Agent tool tests

**Labels:** `homestay` `hs-qa-02` `phase::hardening` `layer::tests` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-AI-02..04 · **Source:** [tickets.md](../tickets.md)

## Goal
Test every agent tool with the LLM mocked.

## Acceptance criteria
- [ ] each tool has tests for success, validation error, service failure and ownership; the LLM is mocked.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
