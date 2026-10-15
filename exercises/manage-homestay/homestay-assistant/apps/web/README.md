# Web (`apps/web`)

Next.js frontend for Homestay Assistant. Guests sign in with Clerk, chat with the CopilotKit assistant, and interact with generative UI for rooms and bookings.

## Stack

- Next.js 16 (App Router)
- CopilotKit (`@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime`)
- Clerk (`@clerk/nextjs`)
- TanStack Query, Zustand
- Tailwind CSS 4, Radix / shadcn-style UI
- Shared packages: `@repo/components`, `@repo/constants`, `@repo/types`, `@repo/utils`
- Workspace dependency: `agent` (Mastra runtime wired into CopilotKit)

## Features

| Area | Location | Role |
| --- | --- | --- |
| Chatbot | `features/chatbot` | The whole assistant: chat shell + suggestions, agent context/state, `<ChatbotProvider>` |
| ↳ Declarative UI | `features/chatbot/declarative-ui` | All generative UI: `tools/` renderers (`useRenderTool` / `useHumanInTheLoop` / `useFrontendTool`), `a2ui/` catalog, `config/` chat-visibility rules |
| ↳ CopilotKit wiring | `features/chatbot/copilot` | Non-UI runtime glue: agent-context readables, transcript sanitizer, `CopilotProvider` mount |
| ↳ Threads | `features/chatbot/threads` | Thread list, create/switch/rename/delete |
| Rooms | `features/room` | Room list/detail UI + stores (renders generative cards in chat) |
| Bookings | `features/booking` | Booking flows + HITL modals + stores |
| BFF routes | `app/api/*` | Proxy to Nest API + CopilotKit runtime + threads |

App routes include `/` (home/chat), `/login`, `/home`, and `/bookings`.

## Prerequisites

- Node.js `>=18`
- Running **api** (default `http://localhost:5001`) for room/booking data
- OpenAI API key (CopilotKit / agent)
- Clerk app (publishable + secret keys)

## Environment

Create `apps/web/.env` (there is no checked-in `.env.example` yet):

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
OPENAI_API_KEY=sk-...
API_URL=http://localhost:5001
# CopilotKit Intelligence (cloud-hosted multi-thread persistence)
INTELLIGENCE_API_URL=https://api.intelligence.copilotkit.ai
INTELLIGENCE_GATEWAY_WS_URL=wss://realtime.intelligence.copilotkit.ai
INTELLIGENCE_API_KEY=cpk_...
```

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_CLERK_*` / `CLERK_SECRET_KEY` | Clerk auth |
| `OPENAI_API_KEY` | Model access for the assistant runtime |
| `API_URL` | Nest API base URL (defaults to `http://localhost:5001`) |
| `INTELLIGENCE_API_URL` | CopilotKit Intelligence REST base URL |
| `INTELLIGENCE_GATEWAY_WS_URL` | CopilotKit Intelligence realtime WebSocket URL |
| `INTELLIGENCE_API_KEY` | CopilotKit Intelligence API key |

## Run

From the monorepo root:

```sh
pnpm install
pnpm web
```

Or from this directory:

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

```sh
pnpm build
pnpm start
pnpm lint
pnpm check-types
```

## API routes (BFF)

| Route | Purpose |
| --- | --- |
| `/api/copilotkit/[[...slug]]` | CopilotKit Intelligence runtime → Mastra agents + `/threads*` |
| `/api/rooms` | Proxy room listing/detail to Nest API |
| `/api/bookings` | Proxy bookings |
| `/api/bookings/availability` | Availability checks |
| `/api/bookings/[id]` | Booking by id |

## Project layout

```
app/                 # Next.js App Router pages + API routes
components/          # App-level UI (layouts, calendar, confirm-modal, ui/)
features/
  chatbot/           # Assistant
    components/       #   chat shell, message renderers, suggestions
    declarative-ui/   #   generative UI: tools/ renderers, a2ui/ catalog, config/
    copilot/          #   CopilotKit runtime glue: readables, sanitizer, CopilotProvider
    threads/          #   conversation thread list / CRUD
    hooks/ stores/ constants/ types/ utils/
  room/              # Room domain UI + stores
  booking/           # Booking flows + HITL modals + stores
providers/           # app-provider (QueryClient) + error boundary
utils/               # Helpers (e.g. API URL)
```
