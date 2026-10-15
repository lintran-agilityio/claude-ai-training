# HS-BE-05: Search rooms endpoint

**Labels:** `homestay` `hs-be-05` `phase::mvp-core` `layer::backend` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-BE-02, HS-BE-04 · **Source:** [tickets.md](../tickets.md)

## Goal
`GET /rooms/search` with `check_in`, `check_out`, `guests`, `min_price`, `max_price`, `amenities[]`, sort. Filters combine with AND.

## Acceptance criteria
- [ ] Given guests=4, then only rooms with capacity >= 4 return.
- [ ] Given a price range, then only rooms inside it return; min > max returns 422.
- [ ] Given amenities [wifi, kitchen], then rooms must have all of them.
- [ ] Given dates, then booked rooms are excluded.
- [ ] Given no match, then 200 with an empty list.
- [ ] Given only check_in without check_out, then 422.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
