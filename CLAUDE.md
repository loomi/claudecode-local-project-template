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

1. **No hosted services.** SQLite is the only database. Never reintroduce
   Postgres, Mongo, Redis, RabbitMQ, Kafka, S3, or any other service that
   requires the user to install / sign up / run a daemon.
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

## Vibe-coding strategy (end-of-turn verification)

A Claude Code **Stop hook** (configured in `.claude/settings.json`) runs
`make verify` after every agent turn. `make verify` performs:

- back-end: `npm run lint` + `npm run build`
- front-end: `npm run typecheck`

If verify fails, the next turn must start by resolving the failure before
introducing new work. Don't suppress the hook to "move on" — silent
breakage defeats the point of the template.

## First-run checklist

1. `make setup` — installs Node (if missing), deps, `.env`, first migration.
2. `make dev` — runs back-end on :3001 and front-end on :3000 in parallel.
3. Open <http://localhost:3000>. API at <http://localhost:3001/api>, docs at
   <http://localhost:3001/docs>.

## Things to avoid (template-wide)

- Don't switch the data layer away from Prisma + SQLite.
- Don't introduce a process manager (pm2, foreman) — `make dev` is enough.
- Don't add monorepo tooling (Nx, Turbo) — two npm workspaces are not a
  monorepo, they're two folders.
- Don't pin Node to anything other than `>=20`. The template targets the
  current LTS.
- Don't add CI YAML to this template (downstream projects add their own).
