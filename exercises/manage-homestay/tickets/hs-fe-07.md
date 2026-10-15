# HS-FE-07: My bookings page with cancel

**Labels:** `homestay` `hs-fe-07` `phase::manage-bookings` `layer::frontend` `P0` · **Estimate:** M · **Priority:** P0
**Depends on:** HS-BE-07, HS-BE-09 · **Source:** [tickets.md](../tickets.md)

## Goal
List of my bookings with status; Cancel button opens a confirm dialog that shows the fee from the preview endpoint.

## Acceptance criteria
- [ ] Given a booking, when I click Cancel, then a dialog shows the fee and asks to confirm.
- [ ] Given I confirm, then status updates to cancelled without reload.
- [ ] Given I dismiss the dialog, then nothing changes.
- [ ] Given a past or cancelled booking, then no Cancel button.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
