# HS-AI-07: AI search from natural language

**Labels:** `homestay` `hs-ai-07` `phase::ai-assistant` `layer::agent` `P1` · **Estimate:** S · **Priority:** P1
**Depends on:** HS-AI-02 · **Source:** [tickets.md](../tickets.md)

## Goal
Map phrases ("2 people, under 60, with kitchen, 20-23 Nov") to `search_rooms` args. Resolve relative dates ("next weekend") using the server date and echo the resolved dates to the user.

## Acceptance criteria
- [ ] Given a natural-language query, then the tool arguments equal the equivalent UI filters.
- [ ] Given relative dates, then the agent states the exact dates it used.
- [ ] Given missing guests/dates when required, then it asks.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
