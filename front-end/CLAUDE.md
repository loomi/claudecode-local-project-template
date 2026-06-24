# Front-end

## Stack
- Next.js 15 (App Router)
- TypeScript strict mode
- Tailwind CSS v4
- TanStack Query v5 (React Query)

## Project structure
- `src/app/` — App Router pages and layouts
- `src/components/ui/` — reusable primitive components (no business logic)
- `src/features/` — domain-scoped modules; each feature owns its components and hooks
- `src/lib/` — API client, shared utilities
- `src/types/` — shared TypeScript types
- `src/styles/` — global CSS

## Commands
```bash
npm run dev        # local dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint via next lint
```

## Conventions
- Features are self-contained under `src/features/<domain>/`
- All data fetching goes through React Query hooks in `src/features/<domain>/hooks/`
- UI primitives live in `src/components/ui/` — keep them generic and reusable
- No `any` types
- No `console.log` in production code
- Currency formatted with `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Images via Next.js `<Image>` — always include `alt` and `sizes`

## Security checklist (read before every change)

The root `CLAUDE.md` carries the full normative list. Front-end specifics:

- **No `dangerouslySetInnerHTML`.** Period. If a feature requires it,
  open a discussion before writing the line — the entry must include a
  sanitizer (DOMPurify) and a `// SECURITY:` comment with the reason.
- **Tokens are Bearer-only.** `tokenStore` writes to `localStorage` for
  dev simplicity; document that production deployments should move to
  HttpOnly cookies + CSRF before going public.
- **Never log a token, password, or user PII** — not in `console.*`, not
  in Sentry/analytics breadcrumbs (when added), not in URL query params.
- **External links** use `rel="noopener noreferrer"` and `target="_blank"`
  together — `noopener` alone is enough but the pair is the de facto
  rule.
- **`fetch`/`useQuery` URLs come from `NEXT_PUBLIC_API_URL`** (or a typed
  helper). Don't concatenate user input into a URL — encode it through
  `URLSearchParams` or the `params` option.
- **Forms always send through validated handlers.** Schema-validate the
  payload before calling the API; treat the server as the source of
  truth but fail fast on the client.
- **No `eval`, no `new Function(...)`** with model/runtime data.
- **Routing redirects:** if a `?next=` style param drives navigation,
  validate that the target is same-origin before redirecting.

## Performance & footprint rules

Read the root `CLAUDE.md` for the full list. Front-end specifics:

- **Bundle budget:** initial route JS must stay under **250 KB gzipped**.
  Run `npm run build` and inspect the route table before adding any UI
  library. Prefer server components and dynamic `import()` for heavy
  client-only widgets.
- **No global state libraries.** TanStack Query covers server state; use
  `useState`/`useReducer` + context for the rest. No Redux, Zustand,
  Jotai, Recoil unless the root `CLAUDE.md` is updated to allow it.
- **No chart/3D/animation libs by default.** `framer-motion` is already
  here — don't add a second animation library. Avoid `chart.js`, `d3`,
  `three`, `lottie` unless the feature truly requires them; lazy-load
  them with `next/dynamic`.
- **Images:** always `next/image` with explicit `sizes`. No raw `<img>`.
- **No client-side analytics SDKs** in the template. Downstream projects
  can add them.

## Cloud-readiness — assume the server may be asleep

The back-end deploys behind Karpenter and can be **scaled to zero**; the first
request after that triggers a cold start of up to **~15 s**. The front-end is
built to wait it out, not flash an error. Full story in the root `CLAUDE.md`
("Cloud behavior") and `docs/deployment.md`. Front-end rules:

- **Route every call through `src/lib/api.ts`.** It already provides an
  `AbortController` timeout (~20 s default, `timeoutMs` override) and
  exponential-backoff retry for transient/cold-start failures (network/timeout
  and `502/503/504`). Never write a bare `fetch` without a timeout in feature
  code.
- **Don't retry `4xx`** (the client doesn't, except the built-in 401→refresh
  path). Retrying a validation error just hammers a healthy server.
- **Show a wake state, not an error.** `app/loading.tsx` covers route-level
  waits; the `onWakeRetry` hook on a request lets a component show "acordando o
  servidor…". The global `app/error.tsx` boundary offers "tentar novamente" and
  only appears after retries are exhausted.
- **TanStack Query is tuned for this** (`QueryProvider.tsx`): retries only on
  transient errors with capped backoff, conservative mutation retries. Use the
  shared `isTransientError` helper if you need the same logic elsewhere.
- **Resource discipline applies here too** — see `docs/performance.md`. Prefer
  server components, paginate growing lists, lazy-load heavy widgets, and don't
  add a dependency 30 lines would cover.

## Custom Slash Commands
- `/frontend <task>` — two-mode frontend workflow (scaffold or feature/fix/refactor). See `.claude/commands/frontend.md`.

