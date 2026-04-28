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

- **`artifacts/apexrx`** — ApexRx Pharmacy Console (React + Vite, Tailwind v3 + shadcn). Full pharmacy billing UI: Login, Dashboard (stats + 14-day sales trend), POS (batch-level inventory search, Rx/H1/Narcotic compliance gating doctor name, hold/recall, customer auto-fill, edit recalled bills), Inventory (3 tabs Available/Out of Stock/All driven by server status filter, compliance badges, batch detail dialog, add/edit/adjust/delete), Customers (CRUD + purchase history), Suppliers (CRUD), Purchases (catalog autocomplete, per-line UoM dropdown — Primary or Secondary — with live conversion footer, CSGST/IGST taxType), Reports (compliance filter + new compliance_sales / compliance_purchases types), Settings. All pages talk to the real backend via `src/lib/api.ts` (cookie-based session, redirects to /login on 401). Shared dropdown values in `src/lib/constants.ts` (CATEGORIES, UNITS, GST_RATES). Custom dark/light theme via `src/lib/theme.tsx`. Auth context in `src/lib/auth.tsx` with `AuthGate` in `App.tsx`.
- **`artifacts/api-server`** — Express 5 + Drizzle backend that powers ApexRx. Cookie session ("apexrx.sid") stored in memorystore, login `gmtr004` / `art123`. Routes mounted under `/api`: `auth`, `products` (catalog list with status filter + total_quantity aggregate, `/products/search`, `/inventory` flat batch listing for POS, `/products/:id/batches`), `customers`, `suppliers`, `settings`, `bills` (decrements `product_batches` by `batch_id`, `/held-bills`), `purchases` (`calcSaleUnits` branches on `purchasingUom`: Primary → qty×purchaseConv×sellingConv, Secondary → qty×sellingConv; `upsertBatch` per (productId, batchNumber)), `dashboard-stats` (low-stock via `product_batches` aggregate), `reports` (compliance filter + compliance_sales / compliance_purchases types), `stock-adjustments` (per-batch). Bill numbers `INV-YYYY-NNNN`; stock decrements only on Completed status (transactional, GREATEST 0).
- **Schema (`lib/db/src/schema/*`)** — Postgres tables: `settings` (key/value), `suppliers`, `products` (catalog only — unique name, holds manufacturer/content/packing/category, compliance flags `is_h1`/`is_narcotic`/`is_prescription_required`, GST rate, MRP, sale rate excl/incl, unit conversion fields `primary_unit`/`secondary_unit`/`purchase_conv_multiplier`/`sale_unit`/`selling_conv_multiplier`), `product_batches` (one row per (productId, batchNumber) holding quantity in sale units, expiry, purchase rate, MRP), `customers` (unique mobile), `bills` + `bill_items` (with `batch_id` FK), `purchase_bills` + `purchase_bill_items` (with `batch_id` FK + `purchasing_uom` snapshot), `stock_adjustments` (with `batch_id` FK). Default settings seeded on first push.
- **`artifacts/mockup-sandbox`** — Canvas mockup sandbox.
