# HS-FE-09: CopilotKit chat UI

**Labels:** `homestay` `hs-fe-09` `phase::ai-assistant` `layer::frontend` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-AI-01, HS-FE-02 · **Source:** [tickets.md](../tickets.md)

## Goal
CopilotKit provider, chat sidebar on logged-in pages, streaming, error and loading states, `useCopilotReadable` for the current page context (e.g. selected room).

## Acceptance criteria
- [ ] Given I am logged in, then the chat opens and streams answers.
- [ ] Given an error, then a message and a retry option show.
- [ ] Given I am on a room page and ask "is this available next week", then the assistant knows which room.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
