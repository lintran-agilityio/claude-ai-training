# HS-BE-01: Auth service and endpoints

**Labels:** `homestay` `hs-be-01` `phase::mvp-core` `layer::backend` `P0` · **Estimate:** L · **Priority:** P0
**Depends on:** HS-DB-01 · **Source:** [tickets.md](../tickets.md)

## Goal
`POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Hash passwords, issue JWT in httpOnly cookie, `get_current_user` dependency.

## Acceptance criteria
- [ ] Given a new email, when I register, then 201 and password is stored hashed.
- [ ] Given an existing email, when I register, then 409 with a clear message.
- [ ] Given valid credentials, when I log in, then cookie is set and `/auth/me` returns my profile (no hash).
- [ ] Given wrong password or unknown email, then 401 with the same generic message.
- [ ] Given weak input (invalid email, password < 8), then 422.
- [ ] Given no or expired token, when I call a protected endpoint, then 401.
- [ ] Given logout, then cookie is cleared and `/auth/me` returns 401.

## Definition of Done
- [ ] Code reviewed and merged via MR.
- [ ] Tests written and passing in CI.
- [ ] Acceptance criteria above met and demonstrated.
- [ ] No secrets in code; `.env.example` updated if needed.
- [ ] README / API docs updated.
