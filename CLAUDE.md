# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frontend for DistriLow, a multi-branch POS/inventory system. Next.js 15 (App Router), React 19, TypeScript, Tailwind + shadcn/ui (Radix primitives). Talks to a separate DistriLow backend over REST (default `http://localhost:3000`); this repo never talks to a database directly.

## Commands

```bash
npm run dev       # dev server on port 3001 (not 3000 — backend owns 3000)
npm run build     # production build
npm run lint      # ESLint (eslint-config-next)
npm test          # vitest run (all tests)
npx vitest run lib/reports/month-selection.test.ts   # single test file
npx knip           # find unused files/exports/deps (config in knip.json)
```

`vitest.config.ts` only adds the `@/` alias; otherwise Vitest defaults (node environment, no jsdom). Tests live next to the source file as `*.test.ts` under `lib/`. A test that reproduces a documented, not-yet-fixed bug uses `it.fails` and is listed in `docs/audit/controles.md`; when the fix lands, switch it to `it`.

Both `eslint.ignoreDuringBuilds` and `typescript.ignoreBuildErrors` are set to `true` in `next.config.mjs`, so `npm run build` succeeding is not proof the code type-checks or lints clean — run `npm run lint` and `tsc` (via your editor) separately when that matters.

## Environment variables

Reference values live in `.env.example` (copy to `.env.local`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Backend origin, no `/api` suffix (default `http://localhost:3000`) |
| `NEXT_PUBLIC_API_PREFIX` | REST prefix (default `/api`) |
| `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_URL` | Legacy alternatives, still read by `resolveApiBaseUrl()` in `lib/api-client.ts` |
| `BACKEND_URL` | Backend URL for server components / SSR |

`next.config.mjs` derives its CSP `connect-src` from these same vars, so a backend origin change needs updating there too if it's not already covered by an existing entry.

## Architecture

### Request flow and auth

`component → lib/backend-api.ts (typed method) → lib/api-client.ts (executeRequest) → fetch (credentials: "include")`

- The session (access token, user, branches, `needsOnboarding`) has a single writer: `lib/session.ts`. Write it only through `applySession(payload, source)` / `clearSession()`; React reads it via `useSyncExternalStore` in `UserProvider`. The access token lives **only in memory** (never localStorage/cookie) and resets on every full page reload by design; the session survives reloads through the httpOnly `refreshToken` cookie, restored on page load in `UserProvider`.
- On a 401, `executeRequest` calls `refreshSession()` once and retries the original request (`_retried` guard prevents loops). `refreshSession()` returns `ok | invalid | unavailable`: only `invalid` (401/403) ends the session; network errors, 5xx and 429 keep it (the request fails, page load retries). A refresh that brings a different user than the tab's makes the tab reload instead of adopting it.
- An explicit logout is broadcast to every tab (`lib/auth-live-sync.ts`), and idle logout counts activity across tabs; an open `/pos` tab keeps the session alive (`hooks/use-idle-logout.ts`).
- The active branch has a single owner: `lib/active-branch.ts` (per tab, `sessionStorage`; new tabs start from the user's last-used branch, else the server's default). Write it only through `selectBranch` / `reconcileActiveBranch` — never a cookie, React state or a module variable of your own. `x-branch-id` is attached to **every** request from that value (routes without branch scope ignore it); with no active branch it is omitted and branch-scoped routes answer 400. React reads it via `useUser().branchId`. Any move from one branch to another (selector, or a refresh that revoked the current branch) reloads the tab (`reloadOnBranchSwitch`, wired in `UserProvider`), so nothing of the previous branch survives in memory; login and logout don't reload. Don't add per-screen "reset on branch change" logic — the reload already covers it. Rules and rationale: `docs/design/01-login-y-sesion.md` §12.
- `middleware.ts` makes routing decisions purely from a non-secret `hasSession` marker cookie plus `user`/`branches` cookies (never reads the real JWTs, which may live on the API's own subdomain and are httpOnly). It redirects unauthenticated users to `/login`, and "restricted" users (role `seller`, or any non-management role with ≤1 branch) to `/pos`-only routes.
- Client-side role/branch logic mirrors this in `lib/permissions.ts` (`isManagementRole`, `isPosCashOnlyUser`, `canAccessExpenses`, etc.) — keep both in sync when changing access rules.

### Provider tree

`app/layout.tsx` wraps everything in `ThemeProvider` → `AppProviders` (`components/providers/app-providers.tsx`). `AppProviders` branches on `pathname`: `/pos` routes get a minimal `OfflineProvider > UserProvider` tree (lighter SWR config, no revalidate-on-reconnect); every other route gets the full stack — `OfflineProvider > UserProvider > BusinessProvider > AuditProvider > BranchProvider > TransactionsProvider > ProductProvider`. Provider order matters (branch depends on user, transactions/products depend on branch, etc.) — respect it when adding a new context provider. (`app/providers/provider.tsx` is a legacy, currently-unused SWRConfig-only wrapper — don't confuse it with `components/providers/`.)

### Adapters (API → ViewModel)

Raw backend responses are normalized before reaching components, under `lib/adapters/` (e.g. `sales.ts`: `SaleSummary` → `SaleViewModel`) and `lib/reports/` for reporting-specific shaping. This is the layer to change when the backend response shape shifts without wanting to touch every consuming component. `lib/reports/calculate-product-margin.ts` and the margin formulas described in `CONFIABILIDAD-MARGENES.md` (margin = (price − cost) / price, **not** cost-based markup) are the canonical reference if you touch profit/margin reporting.

### Cross-tab sync (BroadcastChannel)

Each domain that needs cross-tab cache invalidation has its own `lib/*-live-sync.ts` module (`cash-live-sync.ts`, `sales-live-sync.ts`, `products-live-sync.ts`, `expenses-live-sync.ts`, plus `auth-live-sync.ts` for logout), all following the same shape: `emitXSync()` broadcasts via `BroadcastChannel` + a `window` CustomEvent + a `localStorage` fallback key (for browsers/contexts without `BroadcastChannel`), and `subscribeXSync()` dedupes by a `branchId:timestamp` signature (`type:timestamp` for auth). Copy this pattern rather than inventing a new sync mechanism for a new domain.

### Offline mode (POS only)

`lib/db.ts` defines a Dexie (IndexedDB) schema: `products`, `clients`, `sales` (local sales start as `PENDING`), `pendingActions` (queue). `useNetworkStatus`/`OfflineProvider` detect connectivity; `lib/sync-manager.ts` (`syncPendingActions`) drains the queue action-by-action when back online, only implements `CREATE_SALE` and `CREATE_EXPENSE` today — other `PendingAction` types are declared but fall through to a no-op warning, so check `sync-manager.ts` before assuming offline support for a given action type actually round-trips.

### Module structure

- `app/*/page.tsx` routes are thin; real screens live in `components/modules/*-module.tsx` (one per top-level route: pos, sales, cash, expenses, inventory, reports, branches, users, profile).
- `components/products/` is the one module broken into its own `components/`, `hooks/`, `types/`, `utils/` subfolders — treat it as the pattern to follow if another module grows past a single file.
- `components/ui/` are shadcn/ui primitives (Radix-based) — see `components.json` for aliases (`@/components`, `@/lib`, `@/hooks`, etc., all rooted at `@/*` per `tsconfig.json`). These are project-owned and safe to modify directly, not a vendored dependency.
- `app/actions/*.actions.ts` are server actions (audit, expenses, inventory, sales, users).
- Newer top-level routes not covered by the README's architecture diagram: `app/intelligence/`, `app/orders/`, `app/reservations/` — check these for current status/ownership before assuming they're production-ready.

### Reports/margin data integrity

If working on profit/margin/cost reporting, read `CONFIABILIDAD-MARGENES.md` and `CORRECCION-COSTOS-BD.md` first — they document the margin formula the whole system standardizes on (margin over price, not over cost), how `unitCost` is snapshotted at sale time (never recalculated retroactively), and a known historical data-quality issue (`unitCost = 0` when stock is adjusted without a cost) with the backend-side fix already applied (`costPriceFallback` in `inventory-command.service.ts` / `stock-movement.service.ts`, in the separate backend repo). Reporting reads are cached for 30s (`HOT_CACHE_REPORTING_TTL_MS`) backend-side.
