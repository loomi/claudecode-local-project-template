# Performance & resource discipline

This template targets **resource-constrained deployments**: small pods,
scale-to-zero nodes, and modest dev laptops. Lightweight is the product, not a
bonus. This page is the practical playbook behind the *Resource discipline*
section of the root `CLAUDE.md`.

## The one rule

> Build the **smallest thing that satisfies the actual requirement** — and make
> the requester confirm the requirement before building the expensive version.

Heavy is easy to add later and painful to remove. Start cheap.

## Budgets (hard limits)

| Budget | Limit | How to check |
| --- | --- | --- |
| Cold start (`make setup`, Node present, 50 Mbps) | < 90 s | time the script |
| Dev → served page (`make dev`) | < 10 s | wall clock |
| Idle dev RAM (back + front + Next dev) | < 1.5 GB RSS | `ps`, Activity Monitor |
| Front-end initial route JS | < 250 KB gzipped | `npm run build` route table |
| New runtime dependency | ≤ ~5 MB transitive, no native Windows build | `npm ls`, package size |

If a change blows a budget, **stop and propose the lighter path** instead of
shipping it and apologizing.

## Decision checklist — run this before building a feature

Ask the requester (concisely) and answer for yourself:

1. **Load** — real expected volume? 10/day and 10k/s are different machines.
2. **Timing** — must it be real-time, or is on-demand / lazy enough?
3. **Persistence** — must it persist, or can it be recomputed or briefly cached?
4. **Reuse** — can existing endpoints/tables/components cover it instead of a
   new dependency, table, worker, or service?
5. **Cheapest correct version** — what is it, and what does the heavy version
   actually buy over it?

Recommend the lightweight option **first**. Only build heavy on confirmation.

## Default lightweight choices (applied without being asked)

- **Nothing in the background.** No polling, cron, queues, or warm caches that
  need eviction. Compute on request; be lazy. Scheduled work must be justified
  in writing first.
- **Stateless.** No in-memory counter/cache/session as a source of truth. State
  lives in the DB. (See `docs/deployment.md` — this is also a correctness
  requirement under Karpenter.)
- **Pay for data once.** Select only the columns/rows used. No `findMany()` then
  `.filter()` in JS. No over-fetch "just in case."
- **Pagination by default** on any list that can grow. Unbounded result sets are
  a latency + memory bug.
- **30-line rule.** Add a dependency only when ~30 lines of your own won't do.
- **Right-size the work.** Don't load a whole file to read one line; don't render
  5,000 rows nobody scrolls to.

## Back-end specifics

- **Single `PrismaClient`** (via `PrismaService`). Never `new PrismaClient()` in
  a feature — it leaks connections and corrupts SQLite under contention.
- **SQLite is single-writer.** Keep transactions short; long ones block
  everything. Use `prisma.$transaction` only for genuine atomicity.
- **No N+1.** Reach for `include`/`select`; replace `findUnique` loops with one
  `where: { id: { in } }` query.
- **No verbose logging in hot paths.** `LOG_LEVEL` defaults to `info`; gate debug
  logs.

## Front-end specifics

- **Server components first.** Push client-only widgets behind `next/dynamic`.
- **No new state lib.** TanStack Query (server state) + `useState`/`useReducer`
  + context (local) cover it. No Redux/Zustand/Jotai/Recoil.
- **No chart/3D/animation lib by default.** `framer-motion` is already present —
  don't add a second. Lazy-load anything heavy with `next/dynamic`.
- **`next/image` with explicit `sizes`.** No raw `<img>`.
- **Read the route table** after `npm run build` before merging anything that
  adds a UI library.

## Measuring

```bash
# back-end build output + size
cd back-end && npm run build

# front-end bundle / route table
cd front-end && npm run build   # read the "Route (app)" + "First Load JS" table

# idle memory while running
make dev   # then inspect RSS of the node processes
```

When in doubt, measure before and after. A guess is not a budget.
