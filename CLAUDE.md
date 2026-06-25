# Claude Code — monorepo guide

This is a fullstack template intended for **fully-local, low-footprint
development**. There is no Postgres, no Docker, no cloud service required.
Read this file before making non-trivial changes — it applies to *both*
subprojects (`back-end/` and `front-end/`).

Subproject-specific rules live in `back-end/CLAUDE.md` and `front-end/CLAUDE.md`.
When you operate inside a subfolder, read its guide too.

## Architecture at a glance

```
.
├── Makefile                 # cross-platform entry point
├── scripts/                 # setup / dev / verify (sh + ps1)
├── back-end/                # NestJS 11 + Prisma + SQLite
└── front-end/               # Next.js 15 + TS strict + Tailwind v4
```

## Hard performance & footprint rules (NON-NEGOTIABLE)

Users of this template often run on modest laptops. Every decision must
respect the following budgets. **If your proposed change violates one of
these, reconsider the approach — don't ship it and apologize later.**

1. **SQL only, two providers.** The data layer is Prisma with **SQLite or
   PostgreSQL**, selected by `DATABASE_PROVIDER`. SQLite is the **zero-setup
   local default** (a file, no daemon — keeps `make setup && make dev` fast and
   dependency-free). **PostgreSQL is the prioritized production path** (it's the
   only option that survives multi-pod / scale-to-zero — see the Karpenter
   section and `docs/deployment.md`). Do **not** add any other datastore:
   no Mongo, Redis, RabbitMQ, Kafka, S3, or anything else requiring the user to
   install / sign up / run an extra daemon. New work must stay
   provider-agnostic — write Prisma queries that run on both SQLite and Postgres
   (no provider-specific raw SQL unless gated by `DATABASE_PROVIDER`).
2. **No Docker requirement.** Docker may be *optional* but the default path
   is `make setup && make dev` — nothing else.
3. **No heavy runtime deps.** Before adding a dependency to either
   `package.json`, check: (a) does it pull more than ~5 MB of transitive
   weight? (b) does it require a native build step on Windows? If yes, find
   a lighter alternative or write 30 lines yourself.
4. **Cold start budget.** `make setup` on a clean machine with Node present
   must finish in **< 90 s** on a 50 Mbps link. `make dev` must reach a
   served page in **< 10 s** of wall time.
5. **RAM ceiling.** Idle dev memory (back + front + Next dev server) must
   stay under **1.5 GB RSS** on Node 20. If a change pushes past this,
   profile and trim before merging.
6. **CPU ceiling.** No background polling loops, no heavy cron jobs in
   dev. The only watchers running are `nest start --watch` and Next dev.
7. **Bundle weight.** Front-end production bundle (initial JS) must stay
   **< 250 KB gzipped**. Run `npm run build` and read the route table
   before merging anything that adds a UI library.
8. **DB queries.** SQLite is single-writer. Avoid N+1 patterns — prefer
   `include`/`select` over loops of `findUnique`. Don't open a second
   `PrismaClient`; reuse the injected `PrismaService`.
9. **Logging.** No verbose logging in hot paths. Default `LOG_LEVEL` stays
   `info`; debug logs must be gated.
10. **Build artifacts.** Never commit `dist/`, `.next/`, `node_modules/`,
    or `*.db`. They're in `.gitignore` — keep them there.

## Security rules (NON-NEGOTIABLE)

The agent MUST reject or rewrite any change that violates one of these. If
in doubt, leave a `// SECURITY:` comment, do not ship the unsafe path.
Treat this as a checklist to walk before declaring a task done.

### Input & output

1. **Validate every external input.** Back-end: `class-validator` DTOs on
   every controller param (the global `ValidationPipe` is `whitelist: true,
   forbidNonWhitelisted: true, transform: true` — keep it). Front-end:
   never trust query/path/body, never trust `localStorage` for authz state.
2. **No raw SQL / `$queryRawUnsafe` / string-interpolated `$queryRaw`.**
   Prisma's typed query builders parameterize for you. If a raw query is
   truly required, use `Prisma.sql` template tags so values are bound, not
   interpolated.
3. **No `eval`, `Function(...)`, `vm.runInNewContext`** with user input.
   Same for dynamic `require()` of a user-supplied path.
4. **No `dangerouslySetInnerHTML`** with non-sanitized content. If you
   must render HTML from a trusted source, sanitize (DOMPurify) at the
   boundary and document why.
5. **Output encoding stays default.** Don't bypass React's escaping. Don't
   send `Content-Type: text/html` with model-generated strings.

### AuthN / AuthZ

6. **JWT secret:** never ship a hardcoded production secret. The literal
   `dev-only-change-me` must be replaced by a 32+ char random string in
   any non-dev environment — the config layer logs a warning when it sees
   the default. Add a startup-time check before adding production auth.
7. **Every protected route declares `@UseGuards(JwtAuthGuard)`** (or an
   equivalent guard). Public routes are an explicit decision — annotate
   them or comment why.
8. **Authorization, not just authentication.** A logged-in user is not the
   owner of every record. Always scope queries by `userId` (or tenant id)
   in the service layer. Reviewer checklist item: "does this query filter
   by the current user?"
9. **Passwords hashed with bcrypt cost ≥ 10.** The constant
   `PASSWORD_SALT_ROUNDS` is the single source of truth; raise it, don't
   bypass it. Never log a password, hash, JWT, refresh token, or session
   cookie — not in `console.log`, not in Nest's logger, not in error
   responses.
10. **Refresh-token rotation.** When a refresh token is used, the old one
    is revoked (`revokedAt`) and a new one is issued. Don't introduce a
    code path that reuses a token.

### Sessions, tokens, transport

11. **No tokens in URLs.** Auth tokens travel in `Authorization: Bearer`
    headers, never in query strings (leaks via logs, referrers).
12. **HTTPS in production.** Set `secure: true` on any cookie outside
    `NODE_ENV=development`. The template ships with Bearer auth — if you
    move to cookies, also configure `SameSite=Lax`, `HttpOnly`, and a
    CSRF token.
13. **CORS:** `app.enableCors()` allows any origin — fine for local dev,
    **must be tightened** before deploying. Production code must read an
    allow-list from config.

### Data & errors

14. **Errors don't leak internals.** The global `AllExceptionsFilter`
    normalizes responses — don't add controller-local catch blocks that
    return raw stack traces, Prisma error messages, or filesystem paths.
15. **Don't echo input.** Reflecting unsanitized input into error
    messages is a XSS amplifier when the client renders the response.
16. **Prisma `select`/`omit`** sensitive columns (password hash, token
    hash) out of every response. The `User` entity in `users/dto/` is the
    authoritative public shape — never return the raw Prisma `User`.
17. **No PII in logs.** Email, phone, address, document numbers — log a
    hash or an id, not the value.

### File system & external calls

18. **Path traversal:** any code that reads or writes a path derived from
    user input must `path.resolve` and reject the result if it escapes
    a known base directory.
19. **SSRF:** server-side `fetch(userUrl)` must validate the URL,
    enforce `https:`, and reject private IP ranges (`10/8`, `172.16/12`,
    `192.168/16`, `127/8`, `169.254/16`, `::1`). No follow-redirect across
    schemes.
20. **Command execution:** no `child_process.exec` with interpolated user
    input. Use `execFile`/`spawn` with an argv array.

### Dependencies & supply chain

21. **No dependencies from forks, gists, tarballs, or git URLs.** npm
    registry only. Lockfile (`package-lock.json`) must be committed and
    updated in the same commit as `package.json`.
22. **`npm audit --omit=dev`** must report 0 high/critical before
    merging a release. The agent should run it after dependency changes
    and surface the output in the PR description.
23. **No `postinstall` / `preinstall` scripts** in new direct
    dependencies without an explicit audit comment. They run arbitrary
    code on every install.

### Things the agent must NEVER do

- Commit `.env`, `*.pem`, `*.key`, `id_rsa`, `dev.db`, or anything matching
  obvious token patterns (AKIA…, `ghp_…`, `sk_live_…`, `xox[bpoa]-…`).
- Disable a guard, filter, or pipe with a comment promising to "fix
  later".
- Add `// eslint-disable` for a security rule without a `// SECURITY:`
  justification on the same line.
- Weaken `tsconfig.json` strictness (`strict`, `noImplicitAny`,
  `strictNullChecks`).

## Resource discipline — think before you build (NON-NEGOTIABLE)

Apps built from this template are deployed on **resource-constrained**
infrastructure (small pods, scale-to-zero nodes, modest laptops in dev).
"Lightweight" is not a nice-to-have here — it is the product. The agent's
default is the **smallest thing that satisfies the actual requirement**, not
the most featureful thing that is technically possible.

**Before implementing any feature, the agent MUST make the requester reason
about cost.** When a request implies non-trivial resource use, do not silently
build the heavy version. Ask — concisely — questions like:

- *What's the real expected load?* (10 req/day vs 10k req/s changes everything.)
- *Does this need to be real-time, or is on-demand / lazy enough?*
- *Does this need to persist, or can it be recomputed / cached briefly?*
- *Can the platform's existing pieces cover it instead of a new dependency,
  table, background worker, or service?*
- *What is the cheapest correct version, and what does the expensive version
  buy that the cheap one doesn't?*

State the lightweight option **first** and recommend it. Only build the heavy
path when the requester confirms they need it. A feature shipped 10× heavier
than the requirement is a defect, not a bonus.

Concrete defaults the agent applies without being asked:

1. **Prefer doing nothing in the background.** No polling loops, no cron, no
   queues, no warm caches that need eviction. Compute on request; let it be
   lazy. If scheduled work is truly needed, justify it in writing first.
2. **Prefer stateless.** Hold no in-memory session, counter, cache, or
   accumulator that would be wrong if the process restarts or a second
   instance starts. State lives in the DB (or an explicit external store the
   user opted into) — see the Karpenter section below.
3. **Pay for data once.** Fetch/select only the columns and rows you use.
   No `findMany()` then `.filter()` in JS. No over-fetching "just in case."
4. **Add a dependency only when 30 lines won't do.** Re-check the footprint
   rules above (≤ ~5 MB transitive, no native Windows build step). A new dep
   is a permanent tax on cold-start, bundle size, and audit surface.
5. **Pagination by default** on any list endpoint or list view that can grow.
   Unbounded result sets are a memory and latency bug waiting to happen.
6. **Right-size the data type and the work.** Don't load a file into memory to
   read one line; don't render 5,000 rows the user will never scroll to.

When the agent notices a request that will push the app past the footprint
budgets (RAM, bundle, cold start, deps), it must say so and propose the
lighter alternative **before** writing code — not apologize after.

See `docs/performance.md` for the full playbook and decision checklist.

## Cloud behavior — Karpenter & scale-to-zero (NON-NEGOTIABLE)

Dev is 100% local (SQLite, no Docker, `make dev`). **Production is different:**
downstream apps deploy the back-end to **Kubernetes with Karpenter**, which
provisions and *de-provisions* nodes to cut cost. That means at any moment:

- A pod can receive **SIGTERM** and be killed (node consolidation, spot
  reclaim, rollout). The app gets a short grace period to finish, then dies.
- The deployment can be **scaled to zero**. The next request triggers a node
  + pod cold start that can take **up to ~15 seconds** before the API answers.
- More than one pod can run at once (horizontal scale).

Code written in this template — even while it runs locally — **must already be
written for that reality.** Non-negotiable rules:

### Back-end: be stateless and shut down cleanly

1. **Stateless by default.** No in-process state that must survive a restart or
   be shared across pods: no in-memory sessions, no module-level mutable
   counters/caches used as a source of truth, no "the warm instance has the
   data" assumptions. If two pods running simultaneously would give a wrong
   answer, the design is wrong. Persist state in the DB. If you genuinely need
   shared ephemeral state (rate-limit counters, locks), that is an **explicit**
   architectural decision the requester must opt into — it implies an external
   store, which collides with the "no hosted services" local rule, so it must
   be config-gated and off by default.
2. **Graceful shutdown is mandatory.** `app.enableShutdownHooks()` stays on in
   `main.ts`. On SIGTERM the app must stop accepting new work, let in-flight
   requests drain, and close the DB connection (PrismaService `OnModuleDestroy`
   handles the disconnect). Never add a code path that ignores SIGTERM or holds
   the event loop open (stray `setInterval`, un-`unref`'d timers, open sockets).
3. **Health probes are first-class.** The app exposes:
   - `GET /api/health/live` — **liveness**: cheap, no I/O. "The process is up."
     Must NOT touch the DB (a slow DB must not get a recovering pod killed).
   - `GET /api/health/ready` — **readiness**: pings the DB; returns 503 when the
     DB is unreachable so Karpenter/K8s stops routing traffic to it.
   - `GET /api/health` — overall summary (uptime), kept for convenience.
   Keep these accurate. A readiness probe that always returns 200 defeats the
   purpose during cold start.
4. **Idempotency & retries.** Because clients retry during cold start (see
   front-end rules), prefer endpoints that are safe to call twice. For
   non-idempotent writes, design so a duplicated request is detectable
   (unique constraint, idempotency key) rather than silently double-applied.
5. **SQLite is local/single-instance only.** SQLite is a file on the pod's
   disk — it does **not** survive scale-to-zero on ephemeral storage and
   **cannot** be shared across multiple pods. The template keeps SQLite for
   local dev and single-instance deploys (with a persistent volume). A
   multi-pod / scale-to-zero production deploy needs a networked DB; that swap
   happens at deploy time and is documented in `docs/deployment.md`. **Do not
   silently assume SQLite scales horizontally** — flag the tradeoff when a
   feature depends on it.

### Front-end: assume the server may be asleep

6. **Every API call has a timeout.** Use the resilient client in
   `src/lib/api.ts` (AbortController-based, ~20s default to cover the ~15s cold
   start). No bare `fetch` without a timeout in feature code.
7. **Retry transient failures with backoff.** Connection errors, timeouts, and
   `502/503/504` mean "server waking up / not ready yet" — retry with
   exponential backoff (not a tight loop). Never retry `4xx` (except the
   existing 401→refresh path). The shared client already implements this; route
   new calls through it.
8. **Show a "waking up" state, not an error flash.** While the first request
   retries through a cold start, the UI shows a calm "acordando o servidor…"
   affordance (see `loading.tsx` / the wake hook), and only surfaces a real
   error after retries are exhausted. The global `error.tsx` boundary offers
   "tentar novamente".

See `docs/deployment.md` for probe wiring, SIGTERM handling, the SQLite→prod-DB
swap, and recommended Karpenter `terminationGracePeriodSeconds` / probe values.

## Studio deployment contract (NON-NEGOTIABLE)

When a project provisioned from this template is deployed by the Studio
control plane, the build + deploy pipeline assumes a **fixed structural
contract**. Changing any of the items below silently breaks the GitHub
Actions workflow (`.github/workflows/deploy.yml`), the per-service
Dockerfiles, or the K8s manifest overlay. The agent MUST treat them as
load-bearing — propose, document, and verify before touching them.

### Top-level shape — do NOT rename, move, or merge

```
.
├── back-end/                # NestJS image. Docker build context = this dir.
│   ├── Dockerfile           # required path; deploy.yml has it hardcoded
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma    # `provider` line swapped by db-prepare — never hand-edit
│   │   ├── migrations-sqlite/
│   │   └── migrations-postgres/
│   └── src/
├── front-end/               # Next.js image. Docker build context = this dir.
│   ├── Dockerfile           # required path
│   ├── package.json
│   ├── next.config.ts       # MUST keep `output: 'standalone'`
│   └── src/
├── scripts/
│   ├── db-prepare.sh        # required by deploy.yml (provider swap)
│   └── db-prepare.ps1
└── .github/workflows/
    └── deploy.yml           # injected by the Studio worker — do not edit lightly
```

Adding a sibling folder is fine. Renaming `back-end/`, `front-end/`,
`scripts/`, or anything under them is **not** — the workflow's path
filter (`back-end/**` / `front-end/**`) won't fire, the Docker context
won't resolve, and the runtime initContainer's `prisma migrate deploy`
won't find the schema.

### Ports, prefixes, and endpoints

- **Back-end listens on `3001`**, front-end on `3000`. Don't change them
  — the K8s base (`marcozero-manifests/internal/studio/_base/`) wires
  Service `targetPort` and probes against those exact ports.
- **Global API prefix is `/api`.** `main.ts` sets it; the front-end calls
  `/api/...` same-origin via the ingress. Removing the prefix breaks the
  ingress path-routing (`/api/* → back-end`, `/* → front-end`).
- **Health endpoints are part of the contract.** Keep `GET /api/health/live`
  (no DB), `GET /api/health/ready` (pings DB → 503 when down), and
  `GET /api/health`. The K8s probes reference these paths.

### Docker build assumptions

- **Builder images are `node:20-alpine`.** Don't bump Node major without
  also bumping both Dockerfiles (back-end + front-end) and verifying any
  native deps (bcrypt, sharp, …) ship a prebuilt for the new musl combo.
- **Frontend uses Next.js standalone output.** `next.config.ts` MUST
  have `output: 'standalone'`. The frontend Dockerfile only copies
  `.next/standalone` and `.next/static` — disabling standalone yields a
  broken image.
- **`public/` directory.** The frontend Dockerfile `mkdir -p`s it, so an
  absent `public/` doesn't fail the build — but don't move it to a
  non-standard path. Likewise for `back-end/dist/`.
- **Package manager is npm.** `package-lock.json` is committed in both
  subprojects and the Dockerfiles do `npm ci`. Don't switch to pnpm /
  yarn / bun — the build will fall back to `npm install` and lose
  determinism.
- **Native binaries:** any dep that compiles native (bcrypt, sharp,
  better-sqlite3, …) MUST work on `node:20-alpine` (musl). When in
  doubt, the agent runs `docker build -f back-end/Dockerfile back-end`
  locally before declaring done — production debug-by-tail is much
  slower.

### Env vars the runtime reads

The K8s overlay populates these from a Secrets Manager-backed secret
(`<project>-app-secrets`) and a ConfigMap. Adding a new variable means
also updating the worker's `PostgresProvisionerService` (so the value
is written to SM) **and** the External Secret. Until then, the variable
is `undefined` in prod even if it works locally.

Already wired: `DATABASE_URL`, `DATABASE_PROVIDER=postgresql`,
`JWT_ACCESS_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
`SEED_ADMIN_NAME`, `CORS_ORIGINS`, `NODE_ENV`, `PORT`.

### Default user (seeded at boot)

`UsersBootstrap` upserts a user from the `SEED_ADMIN_*` env on every pod
start — idempotent, runs in-process so no extra build tooling. Defaults
are `admin@studio.local / studio-admin`. Don't remove the bootstrap to
"clean up" unless you've added a /sign-up flow that's safe to expose on
ephemeral envs. To disable for a specific project, set
`SEED_ADMIN_EMAIL=` (empty string) in its secret.

### Things the agent must NEVER do in a Studio-provisioned project

- Move, rename, or wrap `back-end/` or `front-end/`.
- Delete `back-end/Dockerfile`, `front-end/Dockerfile`,
  `scripts/db-prepare.sh`, or `.github/workflows/deploy.yml`.
- Hand-edit the `provider` line in `prisma/schema.prisma` — it's the
  build script's job. Edit the schema, run db-prepare locally instead.
- Hardcode `http://localhost:3001/api` as the front-end API URL. Defaults
  to relative `/api` (same-origin via the ingress); local dev sets
  `NEXT_PUBLIC_API_URL` in `.env.local` per `.env.example`.
- Change the global `/api` prefix in `back-end/src/main.ts`.
- Switch the package manager away from npm.
- Disable `output: 'standalone'` in `next.config.ts`.
- Move or rename `prisma/migrations-postgres/` — the runtime
  initContainer expects it there.

### When you genuinely need to break the contract

It's not impossible — the contract is shared with the Studio control
plane, which lives in a separate repo. If a feature needs a structural
change here, the same change has to land in `loomi-studio` (the
worker's image-injection step and the K8s base) *first*, then in this
template. Don't ship the template-side change first; it'll break every
new project until the platform catches up.

## Vibe-coding strategy (end-of-turn verification)

A Claude Code **Stop hook** (configured in `.claude/settings.json`) runs
`make verify` after every agent turn. `make verify` performs:

- back-end: `npm run lint` + `npm run build`
- front-end: `npm run typecheck` + `npm run lint`
- both: `npm audit --audit-level=high --omit=dev` (supply-chain gate)

If verify fails, the next turn must start by resolving the failure before
introducing new work. Don't suppress the hook to "move on" — silent
breakage defeats the point of the template.

## First-run checklist

1. `make setup` — installs Node (if missing), deps, `.env`, first migration.
2. `make dev` — runs back-end on :3001 and front-end on :3000 in parallel.
3. Open <http://localhost:3000>. API at <http://localhost:3001/api>, docs at
   <http://localhost:3001/docs>.

## Things to avoid (template-wide)

- Don't switch the data layer away from Prisma. Both SQLite and PostgreSQL
  are supported (via `DATABASE_PROVIDER`); don't add a third provider or a
  second ORM. Keep schema/queries provider-agnostic.
- Don't introduce a process manager (pm2, foreman) — `make dev` is enough.
- Don't add monorepo tooling (Nx, Turbo) — two npm workspaces are not a
  monorepo, they're two folders.
- Don't pin Node to anything other than `>=20`. The template targets the
  current LTS.
- Don't add CI YAML to this template (downstream projects add their own).
