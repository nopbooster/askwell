# Askwell

AI support chat widget for any website. See `docs/project.md` (what we build) and `docs/plan.md` (phases).

## Setup

Requires Node 24 (`.nvmrc`) and pnpm (version pinned in `package.json` → `packageManager`).

```sh
pnpm install
cp .env.example .env.local   # fill in values when a phase needs them
pnpm dev                     # http://localhost:3000
```

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js app (App Router, Tailwind v4) |
| `apps/widget` | Vanilla TS loader, bundled by esbuild to `apps/widget/dist/widget.js` |
| `packages/shared` | `@askwell/shared`: the shared contract |
| `packages/db` | `@askwell/db`: database types and test helpers (Phase 1) |

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Run the web app locally |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm lint` | ESLint (one flat config at the root) |
| `pnpm test` | Vitest across all packages |
| `pnpm build` | Build every package (Next.js app + widget bundle) |
| `pnpm db:types` | Stub; wired to Supabase in Phase 1 |
