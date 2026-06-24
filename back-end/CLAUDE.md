# Claude Code — back-end guide

This file gives coding agents the context they need to be productive in this
repository. Read it before making non-trivial changes.

## What this is

A NestJS 11 + Prisma + Swagger back-end scaffold. The data layer is Prisma over
**SQLite or PostgreSQL**, chosen by `DATABASE_PROVIDER`:

- **SQLite** (default) — zero-setup local dev. No daemon, no Docker. The DB file
  lives at `prisma/dev.db`.
- **PostgreSQL** — the prioritized production path (required for multi-pod /
  scale-to-zero; see the root `CLAUDE.md` and `docs/deployment.md`).

`scripts/db-prepare` swaps the Prisma `provider` and copies the matching
migration set into `prisma/migrations/` (the active dir is git-ignored
generated state; the committed sets are `prisma/migrations-sqlite/` and
`prisma/migrations-postgres/`). Keep schema and queries **provider-agnostic** —
no provider-specific raw SQL unless gated on `DATABASE_PROVIDER`. The shape of
the project is intentional — keep it.

## Security checklist (read before every change)

The root `CLAUDE.md` carries the full normative list. Back-end specifics:

- **Every controller method handling external input uses a DTO** with
  `class-validator` decorators. The global `ValidationPipe` is
  `whitelist+forbidNonWhitelisted+transform` — never relax it.
- **No `$queryRawUnsafe`.** Raw queries use `Prisma.sql` template tags so
  bindings are parameterized. Default to typed query builders.
- **No business code reads `process.env`** — go through `ConfigService`.
  This keeps secrets in one place and audit-able.
- **Auth scoping:** when a route is user-scoped, the service filters by
  the current `userId` (from `@CurrentUser`) — not by the id in the URL
  alone. "I trust the client's id" is a bug.
- **Sensitive fields never leave the service:** `password`, `tokenHash`,
  any future secret column. Return `UserEntity` (or an explicit DTO),
  never the raw Prisma row.
- **JWT verification path:** secret comes from `ConfigService`; the
  `dev-only-change-me` fallback exists only so first-run dev works. Any
  production deploy without overriding `JWT_ACCESS_SECRET` is a vuln.
- **Bcrypt cost ≥ 10.** Use the `PASSWORD_SALT_ROUNDS` constant — don't
  inline a literal.
- **Refresh tokens are single-use:** when consumed, set `revokedAt` and
  issue a new pair in the same transaction.
- **Errors:** throw `HttpException` subclasses; do not echo user input
  back in the message. The global filter does not strip — you must.
- **SQLite path traversal:** `DATABASE_URL=file:...` is taken verbatim by
  Prisma — never let user input flow into it.

## Performance & footprint rules

Read the root `CLAUDE.md` for the full list. Back-end specifics:

- **Single PrismaClient.** Only `PrismaService` instantiates the client.
  Never `new PrismaClient()` in a feature module — it leaks connections
  and corrupts SQLite under contention.
- **SQLite means single-writer.** Long transactions block everything else.
  Keep transactions short. Use `prisma.$transaction(async tx => ...)` only
  when you genuinely need atomicity.
- **No N+1.** Reach for `include`/`select` first. If you find yourself
  looping `findUnique`, refactor to one query with `where: { id: { in } }`.
- **No background jobs.** No cron, no queue, no polling loop in this
  service. If you need scheduled work, document it in a TODO — the
  template stays one-process.
- **Watcher overhead.** `nest start --watch` already costs ~150 MB.
  Don't add `nodemon`, `tsx watch`, or a second watcher on top.

## Cloud-readiness (Karpenter / scale-to-zero)

Production runs on Kubernetes with Karpenter — pods get SIGTERM'd, the
deployment can scale to zero, and multiple pods can run at once. The full story
is in the root `CLAUDE.md` ("Cloud behavior") and `docs/deployment.md`. Back-end
specifics:

- **Graceful shutdown stays on.** `main.ts` calls `app.enableShutdownHooks()`.
  Don't remove it. Don't add anything that ignores SIGTERM or keeps the event
  loop alive (stray `setInterval`, un-`unref`'d timers, open sockets) — it
  blocks clean termination inside the grace window.
- **Health probes are contract, not decoration:**
  - `GET /api/health/live` — liveness, **no DB call**. Cheap "process is up."
  - `GET /api/health/ready` — readiness, pings the DB (`Prisma.sql\`SELECT 1\``)
    and returns **503** when the DB is down so traffic stops being routed.
  - `GET /api/health` — uptime summary, kept for convenience.
  Keep liveness DB-free and readiness honest.
- **Stateless or it's a bug.** No in-memory source of truth (counters, caches,
  sessions) — two pods must agree. State lives in the DB. Shared ephemeral state
  (rate-limit counters, locks) means an external store, which must be
  config-gated, off by default, and explicitly opted into.
- **Config guards.** In `production`, the app refuses to boot with the default
  `JWT_ACCESS_SECRET`, and CORS is driven by `CORS_ORIGINS` (comma-separated).
  Keep both guards.
- **SQLite caveat.** SQLite is a local file — fine for dev and single-instance
  (+ PVC) deploys, but it does not survive scale-to-zero on ephemeral storage
  and can't be shared across pods. Multi-pod prod needs a networked DB swapped
  in at deploy time. Flag this when a feature's correctness depends on it.
- **Prefer idempotent writes.** Clients retry through cold starts; design
  non-idempotent writes to detect duplicates (unique constraint / idempotency
  key) rather than double-apply.

## Folder map (authoritative)

```
src/
├── main.ts                         # bootstrap (pipes, filters, Swagger)
├── app.module.ts                   # composes Config, Prisma, feature modules
├── common/
│   ├── filters/                    # global exception filter
│   ├── interceptors/               # response transformer
│   └── dto/                        # cross-cutting DTOs (pagination, etc.)
├── config/
│   └── configuration.ts            # typed env config — extend instead of reading process.env directly
├── prisma/
│   ├── prisma.module.ts            # @Global() — already imported in AppModule
│   └── prisma.service.ts           # extends PrismaClient + lifecycle hooks
└── modules/
    └── <feature>/                  # one folder per feature
        ├── <feature>.module.ts
        ├── <feature>.controller.ts
        ├── <feature>.service.ts
        ├── dto/                    # request/response DTOs (class-validator)
        └── entities/               # domain entities (rare; usually Prisma types suffice)

prisma/
└── schema.prisma                   # data model + datasource
```

## Conventions

- **Modules:** every feature lives at `src/modules/<feature>/`. Use kebab-case
  folder names; the `*.module.ts`, `*.controller.ts`, `*.service.ts` triplet is
  expected. Register the module in `src/app.module.ts`.
- **DTOs:** put all request bodies / query params in `dto/*.dto.ts` with
  `class-validator` decorators. The global `ValidationPipe` (`whitelist: true`,
  `forbidNonWhitelisted: true`, `transform: true`) is already enabled — DTOs do
  not need `@Type()` for primitives.
- **Swagger:** annotate controllers with `@ApiTags`, `@ApiOperation`,
  `@ApiOkResponse`, etc. Keep docs in sync with the implementation; the spec is
  generated at runtime from decorators.
- **Errors:** throw NestJS `HttpException` subclasses (`NotFoundException`,
  `BadRequestException`, …). The global filter standardizes the response. Do
  **not** return `{ error: ... }` objects manually.
- **Prisma access:** inject `PrismaService` from `src/prisma/prisma.service`.
  `PrismaModule` is `@Global()`, so feature modules do not need to import it.
- **Config:** add new env vars to `src/config/configuration.ts` (with a typed
  field on `AppConfig`) and to `.env.example`. Read them via `ConfigService`,
  never via `process.env` in feature code.
- **Routing:** the app sets a global `api` prefix in `main.ts`. Controllers
  declare paths *without* the prefix (`@Controller('users')` →
  `/api/users`).
- **Imports:** never use parent-relative paths (`../`, `../../`). Use the
  TypeScript path aliases declared in `tsconfig.json`:
  - `@/*` → `src/*` (e.g. `import { AppModule } from '@/app.module'`)
  - `@common/*` → `src/common/*`
  - `@config/*` → `src/config/*`
  - `@prisma-svc/*` → `src/prisma/*` (the alias avoids a clash with
    the `@prisma/client` package)
  - `@modules/*` → `src/modules/*`

  Same-folder (`./foo`) and child (`./dto/bar.dto`) relative imports are
  fine — they're more readable than the alias from inside the same
  folder. The same aliases are wired into Jest (`moduleNameMapper` in
  `package.json` and `test/jest-e2e.json`), so tests must use them too.

## Standard response shapes

Successful responses are wrapped by `TransformInterceptor`:
`{ success: true, data, timestamp }`.

Errors are normalized by `AllExceptionsFilter`:
`{ statusCode, error, message, path, timestamp }`. The filter also maps known
Prisma errors (`P2002` → 409, `P2025` → 404, `P2003` → 400). When adding new
Prisma error mappings, extend `resolvePrismaKnown` in
`src/common/filters/all-exceptions.filter.ts`.

## Workflows

| Task                           | Command                                                |
| ------------------------------ | ------------------------------------------------------ |
| Install deps                   | `npm install`                                          |
| Dev server (watch)             | `npm run start:dev`                                    |
| Build                          | `npm run build`                                        |
| Lint                           | `npm run lint`                                         |
| Unit tests                     | `npm test`                                             |
| E2E tests                      | `npm run test:e2e`                                     |
| Regenerate Prisma client       | `npm run prisma:generate`                              |
| Create + apply dev migration   | `npm run prisma:migrate` (asks for migration name)     |
| Apply migrations in prod       | `npm run prisma:deploy`                                |
| Open Prisma Studio             | `npm run prisma:studio`                                |

After editing `prisma/schema.prisma`, always run `npm run prisma:generate` so
the typed client is in sync before touching feature code.

## Adding a feature (recipe)

1. Create `src/modules/<feature>/` with `*.module.ts`, `*.controller.ts`,
   `*.service.ts`. Use the `health` module as a template.
2. Add DTOs under `dto/` with `class-validator` decorators and Swagger
   `@ApiProperty` annotations.
3. If the feature touches the DB, add/extend a model in
   `prisma/schema.prisma`, run `npm run prisma:migrate`, then inject
   `PrismaService` in the service.
4. Register the new module in `src/app.module.ts`.
5. Cover the service with unit tests (`*.spec.ts` next to the file). Add an
   e2e test under `test/` for the happy path of any new HTTP route.
6. Run `npm run build` and `npm test` before declaring done.

## Things to avoid

- Don't introduce a second ORM/query builder. Prisma is the only data layer.
- Don't add a third Prisma provider. Only `sqlite` and `postgresql` are
  supported, via `DATABASE_PROVIDER`. Don't hand-edit the `provider` line in
  `schema.prisma` — `scripts/db-prepare` owns it. When you change the schema,
  regenerate **both** migration sets so they stay in lockstep (run
  `prisma migrate dev` on the sqlite set, and generate the postgres SQL with
  `prisma migrate diff` against an empty-to-schema target).
- Don't add custom error envelopes per-controller — use the global filter.
- Don't read `process.env` directly outside `src/config/`.
- Don't put business logic in controllers; controllers stay thin (validation
  via DTOs, delegation to services).
- Don't downgrade the global `ValidationPipe` settings — `whitelist` and
  `forbidNonWhitelisted` are deliberate.
- Don't use parent-relative imports (`../`, `../../`). Use the path
  aliases (`@/`, `@common/`, `@config/`, `@prisma-svc/`, `@modules/`).
- Don't add Redis/RabbitMQ/BullMQ/Bee/Kafka clients. The template is
  single-process by design.

## Where things live (quick lookup)

- Bootstrap & global wiring: `src/main.ts`
- Module composition: `src/app.module.ts`
- Error normalization: `src/common/filters/all-exceptions.filter.ts`
- Response wrapping: `src/common/interceptors/transform.interceptor.ts`
- Typed config: `src/config/configuration.ts`
- Prisma client: `src/prisma/prisma.service.ts`
- Data model: `prisma/schema.prisma`
- Example feature module: `src/modules/health/`
- Users CRUD: `src/modules/users/`
- Auth (JWT login / me / refresh / logout): `src/modules/auth/`
