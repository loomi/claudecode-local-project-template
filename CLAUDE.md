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

- Don't switch the data layer away from Prisma + SQLite.
- Don't introduce a process manager (pm2, foreman) — `make dev` is enough.
- Don't add monorepo tooling (Nx, Turbo) — two npm workspaces are not a
  monorepo, they're two folders.
- Don't pin Node to anything other than `>=20`. The template targets the
  current LTS.
- Don't add CI YAML to this template (downstream projects add their own).
