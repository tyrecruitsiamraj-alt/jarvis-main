# Jarvis Production Readiness Checklist

Use this document before deploying to production or after merging security/workflow fixes (Prompts 1–7).

## Quick commands

| Step | Command | Expected |
|------|---------|----------|
| Install | `npm ci` | No errors |
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit` | Exit 0 |
| Lint | `npm run lint` | Exit 0 |
| Build | `npm run build` | `dist/` created |
| Automated readiness tests | `npm run test:readiness` | All non-skipped tests pass |
| Full test suite | `npm test` | All non-skipped tests pass |
| DB ping (optional) | `npm run db:ping` | Connected |
| Migrations (optional) | `npm run db:migrate` | Up to date |

**One-command gate (no DB):**

```bash
npm ci && npx tsc -p tsconfig.app.json --noEmit && npm run lint && npm run build && npm run test:readiness
```

**With database integration (set `DATABASE_URL` in `.env.local` first):**

```bash
npm run db:ping && npm run db:migrate && npm run test:readiness
```

---

## Environment checklist (Vercel Production)

| Variable | Required | Production value |
|----------|----------|------------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PGSCHEMA` | Yes | App schema name |
| `PG_SSL` | Yes | `true` for managed Postgres |
| `AUTH_JWT_SECRET` | Yes | ≥32 random chars |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://your-app.vercel.app` |
| `VITE_DEMO_MODE` | Yes | `false` |
| `VITE_ENABLE_RUNTIME_DEMO_FALLBACK` | Yes | `false` |
| `JARVIS_DEV_ROLE_LOGIN` | Yes | **unset** or `false` |
| `JARVIS_ALLOW_PUBLIC_REGISTER` | Recommended | `false` |
| `APP_PUBLIC_URL` | Recommended | Production URL (password reset links in logs) |

Optional future cron:

| Variable | Purpose |
|----------|---------|
| `DRIVER_CARE_CRON_SECRET` | Protect scheduled Driver Care recalculation endpoint |

---

## Auth checklist

| Check | Automated | Manual UAT |
|-------|-----------|------------|
| `/api/auth/dev-role` returns 404 in production | ✅ `production-auth-handlers.test.ts` | POST `/api/auth/dev-role` on prod → 404 |
| Login sets HttpOnly cookie | ✅ handler test | DevTools → Cookies → `jarvis_auth` HttpOnly |
| JWT not in JSON response | ✅ handler test | Login response body has `user` only, no `token` |
| JWT not in localStorage | ✅ contract test | Application → Local Storage → no auth token |
| Forgot password generic message only | ✅ handler test | Response has `message` only, no reset token |
| Public register blocked in production | ✅ handler test + runtime test | POST `/api/auth/register` on prod → 403 |
| Bearer token ignored in production | ⚠️ manual | `Authorization: Bearer …` without cookie → 401 on prod |

---

## RBAC checklist

| Check | Automated | Manual UAT |
|-------|-----------|------------|
| Staff blocked from admin API (`audit-logs`, `app-users`) | ✅ `production-rbac-http.test.ts` | Staff session → GET `/api/audit-logs` → 403 |
| Staff blocked from `/settings` route | ✅ frontend rbac test | Staff login → navigate `/settings` → redirect/deny |
| Supervisor blocked from admin settings | ✅ frontend rbac test | Supervisor → `/settings` → deny |
| Admin can access settings | ✅ frontend rbac test | Admin → `/settings` → loads |
| Forbidden API returns 403 (not 500) | ✅ withRbac tests | Any under-privileged POST → 403 JSON |

---

## Demo fallback checklist

| Check | Automated | Manual UAT |
|-------|-----------|------------|
| Runtime demo fallback off in production build | ✅ `demo-fallback.test.ts` contract | Prod build with API down → login/error, not mock users |
| `VITE_ENABLE_RUNTIME_DEMO_FALLBACK=false` | Env checklist | Confirm in Vercel env |
| Work calendar empty without demo | ✅ contract test | Fresh prod session → calendar empty until API loads |
| PreCheck / candidates no mock merge | ⚠️ manual | Stop API → candidates page shows error, not fake rows |

---

## Assignment workflow checklist

| Check | Automated | Manual UAT |
|-------|-----------|------------|
| Duplicate active assignment → 409 | ✅ service rules + optional DB test | Assign same candidate to same job twice → 409 |
| Missing job → 404 | ✅ service rules + optional DB test | Invalid `job_id` → 404 |
| Missing candidate → 404 | ✅ service rules | Invalid `candidate_id` → 404 |
| Candidate status updates on assign | ✅ `candidateStatusAfterAssignment` | After assign `sent` → candidate `waiting_interview` |
| Transaction / audit on create | ✅ contract test | Check `audit_logs` after assign (admin) |

**DB integration (optional):** set `UAT_JOB_ID` and `UAT_CANDIDATE_ID` in env, then run `npm run test:readiness`.

---

## Work calendar checklist

| Check | Automated | Manual UAT |
|-------|-----------|------------|
| Duplicate employee+date POST → 409 | ✅ service rules + optional DB test | Create same date twice → 409 with PATCH hint |
| PATCH update flow parses input | ✅ `parseUpdateWorkCalendarInput` | Update status `normal_work` → `late` with reason |
| Issue reason required for problem statuses | ✅ service rules | POST `late` without reason → 400 |
| Invalid status transition blocked | ✅ service rules | `day_off` → `no_show` → 400 |

**DB integration (optional):** set `UAT_EMPLOYEE_ID`, run readiness tests.

---

## Audit checklist

| Check | Automated | Manual UAT |
|-------|-----------|------------|
| Client POST `/api/audit-logs` → 403 | ✅ `production-audit-rbac.test.ts` | Any role POST audit → 403 |
| Audit read admin-only | ✅ rbac tests | Supervisor GET audit → 403; admin → 200 |
| Mutations write audit server-side | ✅ contract tests | After job assign / driver recalc → row in `audit_logs` |
| Soft delete (not hard delete) jobs/candidates/employees | ✅ `destructiveEndpoints` registry | DELETE job → `status=cancelled` |

---

## Driver Care checklist

| Check | Automated | Manual UAT |
|-------|-----------|------------|
| GET overview/risk-list does not recalculate | ✅ contract test | Open dashboard twice → no new rows without recalc |
| POST `/api/driver-care/recalculate` supervisor+ only | ✅ rbac + contract | Staff → 403; supervisor → 200 + audit |
| Bangkok business date for scoring | ✅ `businessDate` test | Recalc after midnight Bangkok → new `score_date` |
| No fallback to all employees | ✅ unit test | Empty driver filter → 400, not 50 random staff |
| Empty state when no scores | ⚠️ manual | Fresh DB → overview shows empty + recalc (supervisor) |
| Action validation (type, status, note length) | ✅ `driver-care.test.ts` | Invalid action POST → 400 |

---

## Manual UAT scenarios (recommended before go-live)

### 1. Auth smoke

1. Open production URL → login page loads.
2. Login with real user → lands on role home (`/staff`, `/supervisor`, or `/admin`).
3. Refresh page → still authenticated (cookie).
4. Logout → `/api/auth/me` returns 401, redirected to login.
5. Try dev-role URL/tool → must not work in production.

### 2. RBAC smoke

1. **Staff:** can open `/jobs`, cannot open `/settings` or `/dashboard`.
2. **Supervisor:** can open `/dashboard`, `/jobs/add`, cannot open `/settings`.
3. **Admin:** can open `/settings`, audit logs, app users.

### 3. Demo / API failure

1. With production env flags, stop API or use wrong `DATABASE_URL` in preview only.
2. App must show error / login failure — **not** mock employees, jobs, or calendar data.

### 4. Assignment happy path

1. Create job (supervisor+).
2. Assign candidate → 201, candidate status advances.
3. Repeat assign → **409 Conflict**.

### 5. Work calendar

1. Add calendar entry for employee + date.
2. Add same employee + date again → **409**.
3. PATCH same entry status → 200.

### 6. Audit trail

1. Perform mutation (e.g. create client, assign job).
2. As admin, open audit logs UI or `GET /api/audit-logs` → event present with user + action.

### 7. Driver Care

1. Open Driver Care overview → no auto-recalc (may show empty).
2. As supervisor, click **คำนวณใหม่** → scores appear.
3. As staff, recalculate button hidden; direct POST → 403.

---

## What is automated vs manual vs DB-blocked

### Fully automated (no database)

- Runtime security flags (`runtime-security.test.ts`)
- Auth handler contracts (`production-auth-handlers.test.ts`)
- RBAC matrix API + routes (`rbac.test.ts`, `production-rbac-http.test.ts`)
- Demo fallback contracts (`demo-fallback.test.ts`)
- Assignment/calendar business rules (`assignment-calendar-services.test.ts`)
- Audit RBAC + mutation contracts (`production-audit-rbac.test.ts`, `audit.test.ts`)
- Driver Care read/recalc contracts (`production-driver-care.test.ts`, `driver-care.test.ts`)

### Automated with database (`DATABASE_URL` required)

- `db-integration.test.ts` — connectivity `select 1`
- Optional: duplicate assignment 409 (needs `UAT_JOB_ID`, `UAT_CANDIDATE_ID`)
- Optional: duplicate calendar 409 (needs `UAT_EMPLOYEE_ID`)

### Manual only (UI / full stack)

- Cookie visibility in browser DevTools
- Production CORS from real origin
- End-to-end assignment/calendar UI flows
- Driver Care empty-state UX
- API-down behavior on production build (deploy preview)

### Blocked until DB integration

| Scenario | Reason | Expected when unblocked |
|----------|--------|-------------------------|
| Live duplicate assignment 409 | Needs seeded job + candidate IDs | Second POST returns 409 |
| Live calendar duplicate 409 | Needs `UAT_EMPLOYEE_ID` | Second POST returns 409 |
| Audit row after mutation | Needs DB + admin read | Row in `audit_logs` |

---

## Test file map

| Area | File |
|------|------|
| Auth / runtime | `tests/api/runtime-security.test.ts`, `tests/api/production-auth-handlers.test.ts` |
| RBAC | `tests/api/rbac.test.ts`, `tests/api/production-rbac-http.test.ts` |
| Demo fallback | `tests/demo/demo-fallback.test.ts` |
| Assignments / calendar | `tests/api/assignment-calendar-services.test.ts` |
| Audit | `tests/api/audit.test.ts`, `tests/api/production-audit-rbac.test.ts` |
| Driver Care | `tests/api/driver-care.test.ts`, `tests/api/production-driver-care.test.ts` |
| DB integration | `tests/api/db-integration.test.ts` |

---

## Playwright

`playwright.config.ts` exists (Lovable template) but **E2E is not part of the automated readiness gate**. Use manual UAT above or add Playwright specs later if you wire `baseURL` + test users.
