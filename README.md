# Jarvis — Workforce Management

React (Vite) SPA with serverless-style API routes (`api/`) and optional **local Node server** (`server/local-api.ts`) for development without Vercel.

## Quick start (local)

1. **Install**

   ```bash
   npm install
   ```

2. **Environment**

   Copy [`.env.example`](.env.example) to `.env.local` and set at least:

   - `DATABASE_URL` or `POSTGRES_URL`
   - `PGSCHEMA` (e.g. `jarvis_rm`) if your tables live in a non-public schema
   - `PG_SSL` (`true` / `false`) as required by your host
   - `AUTH_JWT_SECRET` — long random string (required for real login and protected APIs)

3. **Database migrations & seed**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   Default seeded users (password from `SEED_USER_PASSWORD` or `ChangeMe123!`):

   - `admin@example.com`
   - `supervisor@example.com`
   - `staff@example.com`

4. **Run app + API**

   ```bash
   npm run dev
   ```

   - Starts local API (default port `3000`) and Vite together.
   - Vite: `http://localhost:8080` (proxies `/api` → `127.0.0.1:3000` by default)
   - Frontend only: `npm run dev:vite` (then run `npm run api:local` separately if you need `/api`).

5. **Sign in**

   - **Production mode** (default): email/password on the login screen.
   - **Demo mode**: set `VITE_DEMO_MODE=true` in `.env.local` and pick a role (no backend auth).

## Deploy to Vercel

1. **Create a Vercel project** from this repo. Framework: **Vite**; build output: **`dist`** (default `npm run build`).
2. **Environment variables** (Project → Settings → Environment Variables). Set for *Production* (and *Preview* if needed):

   | Variable | Where used | Notes |
   |----------|------------|--------|
   | `DATABASE_URL` | Serverless `api/*` | Same connection string as local |
   | `PGSCHEMA` | API | e.g. `jarvis_rm` |
   | `PG_SSL` | API | Hosted Postgres often needs `true` |
   | `AUTH_JWT_SECRET` | API | Long random secret; required for login / cookies |
   | `VITE_DEMO_MODE` | **Build** | `false` for real DB (default if unset in many setups—set explicitly) |
   | `VITE_DEV_ROLE_ENTRY` | **Build** | Optional; `true` only if you also set server `JARVIS_DEV_ROLE_LOGIN=true` (unsafe on public URLs) |

   Do **not** commit secrets; add them only in the Vercel UI.

3. **Database**: Before the app can log in, run migrations and seed **against the same database** Vercel will use (from your machine, with production `DATABASE_URL` in `.env.local` or env):

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   PostgreSQL **13+** is supported; older servers may need upgrades.

4. **Redeploy** after changing any `VITE_*` variable (they are baked in at build time).

All `/api/*` routes are served by **one** Serverless Function (`api/[[...path]].ts`) so the project stays within the **Hobby plan limit** (12 functions). Handlers live under `api/_handlers/` (private, not separate endpoints). `vercel.json` rewrites non-`/api` routes to `index.html` for the SPA. Under `api/`, relative imports use a **`.js` suffix** (e.g. `./foo.js`) so Node ESM on Vercel can resolve modules at runtime.

TypeScript for the API is configured in `api/tsconfig.json` (`moduleResolution: bundler`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local API + Vite (default for full stack) |
| `npm run dev:vite` | Vite only |
| `npm run dev:local` | Same as `npm run dev` |
| `npm run api:local` | `tsx watch server/local-api.ts` |
| `npm run db:migrate` | Apply SQL files under `migrations/` |
| `npm run db:migrate:status` | List applied migrations |
| `npm run db:seed` | Upsert default users (after migrate) |
| `npm run db:seed:demo` | Upsert mock jobs/candidates/employees from `mockData.ts` into `PGSCHEMA` |
| `npm run db:ping` | Test Postgres connectivity |
| `npm test` | Vitest (app + API unit tests) |
| `npm run build` | Production frontend build |

## API overview

| Route | Auth | Notes |
|-------|------|--------|
| `GET /api/health` | No | DB ping when `DATABASE_URL` set |
| `GET /api/geocode` | No | Needs `GOOGLE_MAPS_API_KEY` |
| `GET /api/public/jobs` | No | Public job board (open / in_progress only) |
| `POST /api/auth/login` | No | Sets httpOnly JWT cookie |
| `POST /api/auth/logout` | No | Clears cookie |
| `GET /api/auth/me` | Yes | Current user |
| `POST /api/auth/register` | Admin | Create users |
| `GET/POST/PATCH/DELETE /api/candidates` | Yes | Staff read; supervisor/admin write |
| `GET/POST/PATCH/DELETE /api/jobs` | Yes | Same RBAC |
| `GET/POST/PATCH/DELETE /api/employees` | Yes | Same RBAC |

**RBAC:** `staff` can `GET`; `POST`, `PUT`, `PATCH`, `DELETE` require `supervisor` or `admin`.

**CRUD:** `PATCH` expects JSON body including `id` plus fields to update. `DELETE` uses query `?id=`.

**Pagination / filter (GET lists):** `limit`, `offset`, optional `status` where applicable.

## Vercel deployment

- API files under `api/` map to `/api/*` (including `api/auth/login.ts` → `/api/auth/login`).
- Set the same env vars in the project (especially `DATABASE_URL`, `PGSCHEMA`, `AUTH_JWT_SECRET`).
- Run migrations against production DB from your machine or CI: `npm run db:migrate` with `DATABASE_URL` pointing at production.

## Testing

- `npm test` runs:
  - Frontend example tests (jsdom)
  - API tests in `tests/api/` (JWT + `withAuth` behaviour)

Full integration tests against a live DB are optional; point `DATABASE_URL` in CI and extend `tests/api/` if needed.

## Production-readiness notes

### Implemented in this phase

- bcrypt password hashing, JWT in **httpOnly** cookie, `/api/auth/login|logout|me`, admin-only `/api/auth/register`
- RBAC on `candidates`, `jobs`, `employees`
- Structured JSON logging for local server (`api.request` / `api.response` / `api.unhandled`)
- Centralized API errors via `handleApiError` / `sendError`
- SQL migrations + seed script
- Vitest coverage for JWT and auth wrapper
- Public job endpoint so `/apply` works without login

### Remaining gaps (recommended next)

| Area | Gap |
|------|-----|
| Security | CSRF strategy for cookie-based auth (e.g. double-submit token or SameSite-only flows) |
| Security | Rate limiting on `/api/auth/login` |
| Ops | Centralized log shipping (Datadog, etc.) and request IDs propagated to handlers |
| Data | Formal migration history for `candidates` / `jarvis_rm.*` if not already managed elsewhere |
| API | Soft-delete vs hard-delete policy; audit columns (`updated_by`, `deleted_at`) |
| Auth | SSO / Microsoft as hinted in UI |
| Frontend | Wire `PATCH`/`DELETE` into all screens that need edit/remove |

### Suggested order

1. **Quick wins:** stricter `AUTH_JWT_SECRET` validation in CI; document rotate procedure; rate-limit login.
2. **Medium:** CSRF tokens + audit fields on mutations.
3. **Larger:** SSO, multi-tenant `tenant_id`, full E2E tests with Playwright + test DB.

## Project layout (partial)

- `src/` — React app
- `api/` — Vercel-style handlers
- `api/_lib/` — postgres, env, auth, http helpers, logger
- `migrations/` — ordered `.sql` files
- `scripts/migrate.mjs`, `scripts/seed.mjs`, `scripts/pg-ping.mjs`
- `server/local-api.ts` — local HTTP router mirroring `/api` paths
