# API (`apps/api`)

NestJS REST API for homestay rooms and bookings. Uses TypeORM + PostgreSQL and exposes Swagger docs.

## Stack

- NestJS 11
- TypeORM + `pg`
- class-validator / class-transformer
- Swagger (`@nestjs/swagger`)
- Shared packages: `@repo/constants`, `@repo/types`, `@repo/utils`

## Modules

| Module | Routes | Responsibility |
| --- | --- | --- |
| Rooms | `GET /rooms`, `GET /rooms/:id` | List/filter rooms, room detail |
| Bookings | `POST/GET/PATCH/DELETE /bookings…` | Create, list, update, cancel; availability checks |

Swagger UI: [http://localhost:5001/api](http://localhost:5001/api) (when the server is running).

## Prerequisites

- Node.js `>=18`
- PostgreSQL
- pnpm (from monorepo root)

## Environment

Copy the example env and adjust as needed:

```sh
cp .env.example .env
```

| Variable | Description | Default / example |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | `postgresql://postgres:postgres@localhost:5432/homestay_assistant?schema=public` |
| `CLERK_SECRET_KEY` | Clerk secret key used to verify web session tokens | required for authenticated routes |
| `PORT` | HTTP port | `5001` |

## Setup

From the monorepo root:

```sh
pnpm install
```

Then from this app (or with `--filter api`):

```sh
pnpm db:migrate
pnpm db:seed
```

## Run

```sh
# watch mode (recommended for local dev)
pnpm dev
# equivalent:
pnpm start:dev

# one-shot start
pnpm start

# production (after build)
pnpm build
pnpm start:prod
```

From the monorepo root:

```sh
pnpm api
```

API base URL: [http://localhost:5001](http://localhost:5001)

## Database scripts

| Script | Description |
| --- | --- |
| `pnpm db:migrate` | Run TypeORM migrations |
| `pnpm db:migrate:revert` | Revert last migration |
| `pnpm db:migrate:generate <name>` | Generate a migration from entity changes |
| `pnpm db:seed` | Seed sample data |

Migrations live in `src/database/migrations/`. Data source: `src/database/data-source.ts`.

## Tests

```sh
pnpm test
pnpm test:e2e
pnpm test:cov
```

## Project layout

```
src/
  modules/
    rooms/       # rooms controller, service, repository, DTOs
    booking/     # bookings controller, service, repository, DTOs
  database/      # TypeORM module, entities, migrations, seed
  common/        # shared base entity helpers
  swagger.ts     # OpenAPI setup
  main.ts
```
