# HS-FE-05: Search and filter UI

**Labels:** `homestay` `hs-fe-05` `phase::mvp-core` `layer::frontend` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-BE-05, HS-FE-03 · **Source:** [tickets.md](../tickets.md)

## Goal
Filter bar (dates, guests, price range, amenities), results update the list, filters in URL query, reset button.

## Acceptance criteria
- [ ] Given filters, then results match the API response.
- [ ] Given check-out before check-in or min > max, then inline validation blocks the search.
- [ ] Given no results, then an empty state with "clear filters".
- [ ] Given I reload, then filters stay (from URL).

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
