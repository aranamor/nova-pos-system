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

- **`artifacts/apexrx`** — ApexRx Pharmacy Console (React + Vite, Tailwind v3 + shadcn). Full pharmacy billing UI: Login, Dashboard (stats + 14-day sales trend), POS (cart, hold/recall, customer auto-fill, edit recalled bills), Inventory (grouped by name with batch detail dialog, add/edit/adjust/delete), Customers (CRUD + purchase history), Suppliers (CRUD), Purchases (create with CSGST/IGST taxType, view details), Reports, Settings. All pages talk to the real backend via `src/lib/api.ts` (cookie-based session, redirects to /login on 401). Custom dark/light theme via `src/lib/theme.tsx`. Auth context in `src/lib/auth.tsx` with `AuthGate` in `App.tsx`.
- **`artifacts/api-server`** — Express 5 + Drizzle backend that powers ApexRx. Cookie session ("apexrx.sid") stored in memorystore, login `gmtr004` / `art123`. Routes mounted under `/api`: `auth`, `products`, `customers`, `suppliers`, `settings`, `bills` (with `/held-bills`), `purchases`, `dashboard-stats` (with salesTrend + monthSales), `reports`, `stock-adjustments`. Bill numbers `INV-YYYY-NNNN`; stock decrements only on Completed status (transactional, GREATEST 0).
- **Schema (`lib/db/src/schema/*`)** — Postgres tables: `settings` (key/value), `suppliers`, `products` (unique name+batch), `customers` (unique mobile), `bills` + `bill_items`, `purchase_bills` + `purchase_bill_items`, `stock_adjustments`. Default settings seeded on first push.
- **`artifacts/mockup-sandbox`** — Canvas mockup sandbox.
