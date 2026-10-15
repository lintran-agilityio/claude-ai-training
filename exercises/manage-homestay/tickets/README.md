# Manage Homestay Tickets

One file per ticket, same layout as [training-plan tickets](../../../training-plan/tickets/README.md). Analysis, assumptions, user stories and test cases are in [../tickets.md](../tickets.md).

## Phase 0: Foundation

| Ticket | Title | Layer | Size | Priority | Depends on |
| --- | --- | --- | --- | --- | --- |
| [HS-DB-01](hs-db-01.md) | Database schema and migrations | DB | M | P0 | HS-OPS-01 |
| [HS-DB-02](hs-db-02.md) | Seed data | DB | S | P0 | HS-DB-01 |
| [HS-OPS-01](hs-ops-01.md) | Project scaffold and environment | DevOps | M | P0 | none |

## Phase 1: MVP core

| Ticket | Title | Layer | Size | Priority | Depends on |
| --- | --- | --- | --- | --- | --- |
| [HS-BE-01](hs-be-01.md) | Auth service and endpoints | Backend | L | P0 | HS-DB-01 |
| [HS-BE-02](hs-be-02.md) | Rooms API (list and detail) | Backend | M | P0 | HS-DB-02 |
| [HS-BE-03](hs-be-03.md) | Service layer skeleton (shared by REST and AI) | Backend | S | P0 | HS-DB-01 |
| [HS-BE-04](hs-be-04.md) | Availability and pricing logic | Backend | M | P0 | HS-BE-03 |
| [HS-BE-05](hs-be-05.md) | Search rooms endpoint | Backend | M | P0 | HS-BE-02, HS-BE-04 |
| [HS-BE-06](hs-be-06.md) | Create booking endpoint | Backend | L | P0 | HS-BE-01, HS-BE-04 |
| [HS-FE-01](hs-fe-01.md) | Auth pages and session context | Frontend | L | P0 | HS-BE-01 |
| [HS-FE-02](hs-fe-02.md) | Protected routes and layout | Frontend | S | P0 | HS-FE-01 |
| [HS-FE-03](hs-fe-03.md) | Room list page | Frontend | M | P0 | HS-BE-02, HS-FE-02 |
| [HS-FE-04](hs-fe-04.md) | Room detail page | Frontend | M | P0 | HS-FE-03 |
| [HS-FE-05](hs-fe-05.md) | Search and filter UI | Frontend | M | P0 | HS-BE-05, HS-FE-03 |
| [HS-FE-06](hs-fe-06.md) | Booking form and confirmation | Frontend | M | P0 | HS-BE-06, HS-FE-04 |

## Phase 2: Manage bookings

| Ticket | Title | Layer | Size | Priority | Depends on |
| --- | --- | --- | --- | --- | --- |
| [HS-BE-07](hs-be-07.md) | Cancel booking endpoint | Backend | M | P0 | HS-BE-06, open question 1 |
| [HS-BE-08](hs-be-08.md) | Edit booking endpoint | Backend | L | P0 | HS-BE-06 |
| [HS-BE-09](hs-be-09.md) | List my bookings and booking detail | Backend | S | P0 | HS-BE-06 |
| [HS-FE-07](hs-fe-07.md) | My bookings page with cancel | Frontend | M | P0 | HS-BE-07, HS-BE-09 |
| [HS-FE-08](hs-fe-08.md) | Edit booking UI | Frontend | M | P1 | HS-BE-08, HS-FE-07 |

## Phase 3: AI assistant

| Ticket | Title | Layer | Size | Priority | Depends on |
| --- | --- | --- | --- | --- | --- |
| [HS-AI-01](hs-ai-01.md) | Agent service setup and endpoint | Agent | M | P0 | HS-BE-01 |
| [HS-AI-02](hs-ai-02.md) | Read-only tools (search_rooms, get_room_details, check_availability) | Agent | M | P0 | HS-AI-01, HS-BE-05 |
| [HS-AI-03](hs-ai-03.md) | list_my_bookings tool | Agent | S | P0 | HS-AI-01, HS-BE-09 |
| [HS-AI-04](hs-ai-04.md) | Write tools (create_booking, update_booking, cancel_booking) | Agent | L | P0 | HS-AI-01, HS-BE-06..08 |
| [HS-AI-05](hs-ai-05.md) | Graph with human-in-the-loop confirmation | Agent | L | P0 | HS-AI-04 |
| [HS-AI-06](hs-ai-06.md) | System prompt and guardrails | Agent | M | P0 | HS-AI-02, open questions |
| [HS-AI-07](hs-ai-07.md) | AI search from natural language | Agent | S | P1 | HS-AI-02 |
| [HS-AI-08](hs-ai-08.md) | Agent observability and error handling | Agent | S | P2 | HS-AI-05 |
| [HS-FE-09](hs-fe-09.md) | CopilotKit chat UI | Frontend | M | P0 | HS-AI-01, HS-FE-02 |
| [HS-FE-10](hs-fe-10.md) | Generative UI (room cards, confirmation dialog) | Frontend | L | P0 | HS-FE-09, HS-AI-05 |

## Phase 4: Hardening

| Ticket | Title | Layer | Size | Priority | Depends on |
| --- | --- | --- | --- | --- | --- |
| [HS-QA-01](hs-qa-01.md) | Backend unit and API tests | Tests | L | P0 | HS-BE-04..09 |
| [HS-QA-02](hs-qa-02.md) | Agent tool tests | Tests | M | P0 | HS-AI-02..04 |
| [HS-QA-03](hs-qa-03.md) | E2E tests (Playwright) | Tests | L | P1 | HS-FE-01..08 |
| [HS-QA-04](hs-qa-04.md) | AI behavior evaluation set | Tests | M | P1 | HS-AI-05, HS-AI-06 |

## Conventions

- **Labels:** `homestay`, ticket id, `phase::*`, `layer::*`, `P0|P1|P2`.
- **Sizes:** S up to 0.5 day, M about 1 day, L 1-2 days.
- **Blocker:** HS-BE-04 (availability) blocks booking, edit, search and all AI tools. Open questions in tickets.md block HS-BE-07, HS-AI-06, HS-FE-03.
