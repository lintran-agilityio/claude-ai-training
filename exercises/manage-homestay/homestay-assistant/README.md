# Homestay Assistant

AI-assisted homestay booking monorepo. Guests chat with a CopilotKit-powered assistant to browse rooms, check availability, and manage bookings.

## Stack

| Layer | Tech |
| --- | --- |
| Web | Next.js 16.2, React 19.2, CopilotKit 1.62, Clerk 7.5, TanStack Query 5.101, Zustand 5.0, Tailwind 4.3 |
| Agent | Mastra 1.43 (OpenAI via router), AG-UI 0.0.57 |
| API | NestJS 11, TypeORM 0.3, PostgreSQL (`pg` 8), Swagger (`@nestjs/swagger` 11.4) |
| Monorepo | pnpm 11.9 workspaces + Turborepo 2.9 |

> Versions track the current `package.json` ranges — see each `package.json` for exact pins.

## Apps

| App | Path | Port | Role |
| --- | --- | --- | --- |
| `web` | [`apps/web`](./apps/web) | `3000` | Chat UI, generative UI, BFF routes to the API |
| `api` | [`apps/api`](./apps/api) | `5001` | Rooms & bookings REST API |
| `agent` | [`apps/agent`](./apps/agent) | `4111` | Mastra agents, tools, and Studio |

## Packages

| Package | Purpose |
| --- | --- |
| `@repo/constants` | Shared agent keys, tool keys, routes |
| `@repo/types` | Shared TypeScript types |
| `@repo/utils` | Shared helpers (e.g. dates, agent resource IDs) |
| `@repo/components` | Shared React components |
| `@repo/eslint-config` | ESLint presets |
| `@repo/typescript-config` | Shared `tsconfig` bases |

## Prerequisites

- Node.js `>=18` (agent requires `>=22.13.0`)
- [pnpm](https://pnpm.io/) `11.9.0` (see `packageManager` in root `package.json`)
- PostgreSQL (for `api`)
- OpenAI API key (for `agent` / CopilotKit)
- Clerk application keys (for `web` auth)

## Setup

```sh
pnpm install
```

Configure env files per app (see each app README):

- [`apps/api/.env.example`](./apps/api/.env.example) → `apps/api/.env`
- [`apps/agent/.env.example`](./apps/agent/.env.example) → `apps/agent/.env`
- `apps/web/.env` — Clerk + OpenAI keys (see [`apps/web/README.md`](./apps/web/README.md))

Then prepare the API database:

```sh
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

## Develop

Run everything:

```sh
pnpm dev
```

Or start apps individually from the repo root:

```sh
pnpm web    # Next.js → http://localhost:3000
pnpm api    # NestJS  → http://localhost:5001
pnpm agent  # Mastra  → http://localhost:4111
```

Typical local order: start **api**, then **agent**, then **web**.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm build` | Build all apps/packages |
| `pnpm dev` | Start all `dev` tasks |
| `pnpm lint` | Lint across the workspace |
| `pnpm check-types` | Typecheck across the workspace |
| `pnpm format` | Format with Prettier |

Filter a single package:

```sh
pnpm exec turbo build --filter=web
pnpm exec turbo dev --filter=agent
```

## Architecture (high level)

```
Browser (web)
  → CopilotKit runtime (/api/copilotkit)
  → Mastra agents (agent package / Studio)
  → Homestay REST API (NestJS + Postgres)
```

Web also proxies room/booking HTTP calls to the API via Next.js route handlers under `apps/web/app/api/`.

## Docs

- [Web](./apps/web/README.md)
- [API](./apps/api/README.md)
- [Agent](./apps/agent/README.md)
