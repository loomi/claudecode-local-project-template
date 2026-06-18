# loomi-product-view

## Stack
- Next.js 15 (App Router)
- TypeScript strict mode
- Tailwind CSS v3
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

## Custom Slash Commands
- `/frontend <task>` — two-mode frontend workflow (scaffold or feature/fix/refactor). See `.claude/commands/frontend.md`.

## Onboarding
See `ONBOARDING.md` for team guidance on using Claude Code in this repo.
