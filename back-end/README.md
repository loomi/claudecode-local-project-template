# Back-end (Local Template)

NestJS 11 + Prisma + **SQLite** + Swagger starter — zero external services
required.

## Stack

- **Runtime:** Node.js 20+
- **Framework:** [NestJS 11](https://docs.nestjs.com)
- **ORM:** [Prisma 6](https://www.prisma.io/docs) targeting **SQLite** (file at `prisma/dev.db`)
- **API docs:** [Swagger / OpenAPI](https://swagger.io) via `@nestjs/swagger`
- **Validation:** `class-validator` + `class-transformer` through a global `ValidationPipe`
- **Config:** `@nestjs/config` reading from `.env`

## Project structure

```
back-end/
├── prisma/
│   └── schema.prisma          # Prisma data model + datasource
├── src/
│   ├── main.ts                # Bootstrap: pipes, filters, Swagger
│   ├── app.module.ts          # Root module (Config, Prisma, feature modules)
│   ├── common/
│   │   ├── filters/           # Global exception filter (standard error shape)
│   │   ├── interceptors/      # Response transformer (standard success shape)
│   │   └── dto/               # Cross-cutting DTOs
│   ├── config/
│   │   └── configuration.ts   # Typed environment configuration
│   ├── prisma/
│   │   ├── prisma.module.ts   # @Global() module exporting PrismaService
│   │   └── prisma.service.ts  # PrismaClient with lifecycle hooks
│   └── modules/
│       └── health/            # Example feature module (health check)
├── test/                      # End-to-end tests
├── .env                       # Local environment (gitignored)
├── .env.example               # Template — copy to `.env`
└── CLAUDE.md                  # Guidance for Claude Code agents
```

Each feature lives in its own folder under `src/modules/<feature>/` with the
canonical `*.module.ts`, `*.controller.ts`, `*.service.ts`, plus DTOs/entities
as needed.

## Prerequisites

- Node.js **20.x** or newer
- npm **10+**

> Database: **SQLite** (file at `prisma/dev.db`). Nothing to install — the
> file is created by `prisma migrate` on first run. To use the GUI, run
> `npm run prisma:studio`.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file from the template
cp .env.example .env
# then edit DATABASE_URL if needed

# 3. Generate the Prisma client (idempotent; safe to re-run)
npm run prisma:generate

# 4. Apply migrations to create the database schema
npm run prisma:migrate
```

## Running the app

```bash
# Development with auto-reload
npm run start:dev

# One-shot start (no watcher)
npm run start

# Production: build first, then run the compiled output
npm run build
npm run start:prod
```

When the server is up:

- API base: `http://localhost:3001/api`
- Swagger UI: `http://localhost:3001/docs`
- Health check: `GET http://localhost:3001/api/health`

## Tests

```bash
npm run test        # unit tests
npm run test:e2e    # end-to-end (boots the Nest app, hits HTTP)
npm run test:cov    # coverage report
```

## Database workflow (Prisma)

| Command                     | What it does                                            |
| --------------------------- | ------------------------------------------------------- |
| `npm run prisma:generate`   | Regenerate the typed Prisma client from `schema.prisma` |
| `npm run prisma:migrate`    | Create + apply a new dev migration                      |
| `npm run prisma:deploy`     | Apply pending migrations in production                  |
| `npm run prisma:studio`     | Open Prisma Studio (GUI) on the dev DB                  |
| `npm run db:reset`          | Drop the dev DB and re-apply all migrations             |

Edit `prisma/schema.prisma` to add or change models, then run
`npm run prisma:migrate` and provide a name when prompted.

## Standard response shapes

Every successful response is wrapped by `TransformInterceptor`:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-05-05T12:34:56.789Z"
}
```

Every error is normalized by `AllExceptionsFilter`:

```json
{
  "statusCode": 404,
  "error": "RecordNotFound",
  "message": "The requested record was not found",
  "path": "/api/users/123",
  "timestamp": "2026-05-05T12:34:56.789Z"
}
```

Validation errors, Prisma `P2002`/`P2025`/`P2003` errors, and uncaught
exceptions are all mapped to this shape — controllers can throw `HttpException`
subclasses freely.

## Environment variables

| Variable        | Default                                                         | Description                            |
| --------------- | --------------------------------------------------------------- | -------------------------------------- |
| `NODE_ENV`      | `development`                                                   | Runtime mode                           |
| `PORT`          | `3001`                                                          | HTTP listen port                       |
| `SWAGGER_PATH`  | `docs`                                                          | Mount path for Swagger UI              |
| `DATABASE_URL`  | `file:./dev.db`                                                 | SQLite database file (relative to `prisma/`) |

## Adding a new feature module

1. `nest g module modules/<name>` (or create the folder manually).
2. Add `controller.ts`, `service.ts`, `dto/`, `entities/` under
   `src/modules/<name>/`.
3. Inject `PrismaService` from `src/prisma/prisma.service` — it is exported
   globally, so no need to re-import `PrismaModule`.
4. Annotate controllers with Swagger decorators (`@ApiTags`, `@ApiOperation`,
   etc.) so the docs stay accurate.
5. Register the module in `src/app.module.ts`.
