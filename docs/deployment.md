# Deployment — Kubernetes, Karpenter & scale-to-zero

Dev is 100% local (SQLite, no Docker, `make dev`). This page is about the
**production target**: the back-end runs on Kubernetes with
[Karpenter](https://karpenter.sh/) provisioning and de-provisioning nodes to cut
cost. The code in this template is written to behave well in that environment
even while it runs locally.

> If you only develop locally, you can skip this page. But **do not remove the
> code that makes the app cloud-ready** (graceful shutdown, health probes,
> front-end retry/timeout) — it costs nothing locally and is mandatory in prod.

## What Karpenter does to your app

1. **Pods get killed on short notice.** Node consolidation, spot reclaim, and
   rollouts send the pod **SIGTERM**, wait `terminationGracePeriodSeconds`, then
   **SIGKILL**. Your app must drain in-flight work and exit within the grace
   window.
2. **Scale-to-zero.** When idle, the deployment can drop to **0 replicas**. The
   next request must wait for a node to be provisioned and a pod to boot — up to
   **~15 seconds**. During that window the API is unreachable.
3. **Horizontal scale.** More than one pod can run at once. Anything held in one
   pod's memory is invisible to the others.

The three consequences: **be stateless**, **shut down gracefully**, and **make
clients patient**.

## Back-end: graceful shutdown

`main.ts` calls `app.enableShutdownHooks()`. On SIGTERM, Nest fires
`OnModuleDestroy`; `PrismaService` disconnects the DB. The HTTP server stops
accepting new connections and lets in-flight requests finish.

Rules to keep this working:

- **Never ignore SIGTERM** or hold the event loop open with a stray
  `setInterval` / un-`unref`'d timer / dangling socket.
- **Keep handlers short** so they finish inside the grace period.
- Set a sane grace period in the Deployment:

```yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30   # > your slowest expected request
      containers:
        - name: api
          # ...
```

## Back-end: health probes

The app exposes three endpoints (global prefix `/api`):

| Endpoint | Purpose | Touches DB? | Failure meaning |
| --- | --- | --- | --- |
| `GET /api/health/live` | **liveness** | No | Process is wedged → restart pod |
| `GET /api/health/ready` | **readiness** | Yes (`SELECT 1`) | Not ready → stop routing traffic (503) |
| `GET /api/health` | summary (uptime) | No | convenience / humans |

Liveness must **not** hit the DB — a slow DB should not get a recovering pod
killed. Readiness **must** hit the DB so a pod with a dead connection is pulled
out of rotation. Wire them up:

```yaml
livenessProbe:
  httpGet: { path: /api/health/live, port: 3001 }
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  httpGet: { path: /api/health/ready, port: 3001 }
  initialDelaySeconds: 3
  periodSeconds: 5
  failureThreshold: 3
```

## Back-end: stateless or it's a bug

Two pods running at once must give the same answer. So:

- **No in-memory source of truth** — no module-level counters, caches, or
  sessions you'd be sad to lose on restart. State lives in the DB.
- **JWT auth is already stateless** (the token carries identity; refresh tokens
  are persisted in the DB, not in memory) — keep it that way.
- If you truly need shared ephemeral state (rate-limit counters, distributed
  locks), that implies an **external store** (e.g. Redis). That collides with the
  template's "no hosted services" local promise, so it must be **config-gated and
  off by default**, and the requester must explicitly opt in.

## Choosing the database — SQLite vs PostgreSQL

The template supports **both** providers via Prisma, selected by
`DATABASE_PROVIDER` (`sqlite` | `postgresql`). They are not interchangeable in
production:

| | SQLite | PostgreSQL |
| --- | --- | --- |
| What it is | a file on the pod's local disk | a networked server |
| Survives scale-to-zero | ❌ ephemeral storage loses data on pod death | ✅ |
| Shared across multiple pods | ❌ single-writer, local file | ✅ |
| Good for | local dev, single-instance + PVC | **multi-pod / scale-to-zero prod** |

**SQLite is the zero-setup local default.** In production it is only viable for
a **single-instance** deploy (`replicas: 1`, no horizontal scale) with a
**PersistentVolume** mounted where `DATABASE_URL` points.

**PostgreSQL is the prioritized production path** — the only option that works
under Karpenter's multi-pod / scale-to-zero reality. To deploy on Postgres:

1. Set in the deployed environment:
   ```bash
   DATABASE_PROVIDER=postgresql
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public"
   ```
2. The setup/deploy step runs `scripts/db-prepare` which swaps the Prisma
   provider and copies the Postgres migration set (`prisma/migrations-postgres/`)
   into place, then `prisma migrate deploy` runs against the server on rollout.
3. Everything else (stateless services, probes, graceful shutdown, the
   front-end cold-start handling) is already correct and provider-agnostic.

Migrations are kept per provider (`prisma/migrations-sqlite/` and
`prisma/migrations-postgres/`) because the generated SQL differs; the active
`prisma/migrations/` is generated state and git-ignored. Keep new schema and
queries **provider-agnostic** so both sets stay in lockstep — when you add a
model/field, regenerate both migration sets (see `back-end/CLAUDE.md`).

**Do not assume SQLite scales horizontally.** When a feature's correctness
depends on the DB surviving a pod restart or being shared across pods, it
requires PostgreSQL — say so.

## Front-end: survive the cold start

When the back-end is scaled to zero, the first request can take ~15 s. The
front-end is built to wait it out instead of flashing an error:

- **Timeout** — every call goes through `src/lib/api.ts`, which uses an
  `AbortController` with a ~20 s default (covers the ~15 s cold start + margin).
- **Retry with backoff** — connection errors, timeouts, and `502/503/504` are
  treated as "server waking up" and retried with exponential backoff. `4xx`
  (except the 401→refresh path) is **not** retried.
- **Wake UX** — `loading.tsx` and the wake hook show "acordando o servidor…"
  during the retry window; `error.tsx` offers "tentar novamente" only after
  retries are exhausted.

Keep new API calls routed through the shared client so they inherit this
behavior. Don't introduce bare `fetch` without a timeout.

### Recommended client/infra alignment

| Knob | Where | Suggested |
| --- | --- | --- |
| Request timeout | `api.ts` `timeoutMs` | ~20 s |
| Max retries | `api.ts` `retries` / QueryProvider | ~4 |
| Backoff cap | `api.ts` / QueryProvider `retryDelay` | ~8 s |
| Pod grace period | Deployment | ≥ slowest request, e.g. 30 s |
| Readiness `failureThreshold` | Deployment | ~3 |

## Checklist before deploying

- [ ] `JWT_ACCESS_SECRET` overridden (app refuses to boot in prod with the
      default — see `main.ts`).
- [ ] `CORS_ORIGINS` set to your real front-end origin(s).
- [ ] DB decision made: `DATABASE_PROVIDER=postgresql` (+ `DATABASE_URL`) for
      multi-pod / scale-to-zero, **or** single-instance SQLite + PVC.
- [ ] Liveness/readiness probes wired to `/api/health/live` and `/api/health/ready`.
- [ ] `terminationGracePeriodSeconds` ≥ slowest request.
- [ ] `prisma migrate deploy` runs on rollout.
- [ ] Front-end `NEXT_PUBLIC_API_URL` points at the deployed API.
- [ ] `npm audit --omit=dev` clean (run by `make verify`).
