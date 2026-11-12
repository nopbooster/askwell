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
| `packages/db` | `@askwell/db`: database types and the pglite test helper (`@askwell/db/supabase-pglite`, tests only) |
| `supabase` | `config.toml` and `migrations/` (SQL files, `<UTC timestamp>_<name>.sql`). No local Supabase stack. |

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Run the web app locally |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm lint` | ESLint (one flat config at the root) |
| `pnpm test` | Vitest across all packages |
| `pnpm build` | Build every package (Next.js app + widget bundle) |
| `pnpm db:types` | Regenerate `packages/db/types.ts` from the Supabase dev project. Needs `SUPABASE_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` in your shell (tooling variables, not in `.env.example`). Agents use the Supabase MCP's type generator instead. |

## Deployments

| | |
|---|---|
| Host | Vercel. The project's Root Directory is `apps/web`. |
| Pull requests | Every PR gets a Vercel preview deployment. From Phase 1 on, previews use the Supabase dev project. |
| `main` | Every merge builds production, but automatic promotion is off. Only the product owner promotes a build to production. |
| Protection | Previews are protected. Automated requests must send the `x-vercel-protection-bypass` header with the value of `VERCEL_AUTOMATION_BYPASS_SECRET` (browser tests also send `x-vercel-set-bypass-cookie: true` on the first request). Never commit the secret. |

Get a preview's URL from GitHub (the Vercel comment on the PR, or the PR's deployment status), not from the branch name.
