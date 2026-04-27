# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **`artifacts/apexrx`** — ApexRx Pharmacy Console (React + Vite, Tailwind v3 + shadcn). Ported from a Lovable.dev import. Frontend-only — uses mock data via `src/lib/api.ts` (the original Lovable app shipped with no backend). Custom dark/light theme provider in `src/lib/theme.tsx`. Routing via `react-router-dom`.
- **`artifacts/api-server`** — Express 5 API scaffold. Not currently used by `apexrx` but available for future expansion.
- **`artifacts/mockup-sandbox`** — Canvas mockup sandbox.
