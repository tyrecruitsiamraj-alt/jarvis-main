# Project Overview

Jarvis is a workforce management web app for staffing operations. It is a React/Vite TypeScript SPA with shadcn/Radix UI components, Tailwind styling, Vercel-style API handlers, local API emulation, PostgreSQL migrations, and selected MSSQL/Siamraj/Lumos integrations.

## Runtime And Commands

- App stack: React 18, Vite 5, TypeScript, TanStack Query, React Router, shadcn/Radix UI, lucide-react, Recharts.
- API stack: single Vercel catch-all function in `api/[[...path]].ts`; private route handlers under `api/_handlers/`; shared API utilities under `api/_lib/`.
- Local full stack: `npm run dev` starts `npm run api:local` and Vite. Vite defaults to `http://localhost:8080` and proxies `/api` to `http://127.0.0.1:3000`.
- Frontend-only: `npm run dev:vite`.
- Local API only: `npm run api:local` via `tsx watch server/local-api.ts`.
- Build: `npm run build`.
- Tests: `npm test` or targeted `npx vitest run <test-file>`.
- Readiness tests: `npm run test:readiness`.
- Database: `npm run db:migrate`, `npm run db:migrate:status`, `npm run db:seed`, `npm run db:ping`, `npm run db:ping:mssql`.

## App Surface

Primary routes are declared in `src/App.tsx`:

- Public: `/apply`, `/s/:code`, `/careers`, `/mapwork`, `/auth/magic-link`, `/reset-password`.
- Protected role hubs: `/`, `/opl`, `/staff`, `/supervisor`, `/admin`.
- Workforce/labor: `/wl`, `/wl/monthly-planner`, `/wl/daily-assignment`, `/wl/global-calendar`, `/wl/employees`.
- Matching: `/matching`, `/matching/candidates`, `/matching/match`, `/matching/pre-check`, `/matching/job-postings`, `/matching/reservations`.
- Jobs: `/jobs/list`, `/jobs/board`, `/jobs/overview`, `/jobs/siamraj/:id`, `/jobs/:id`.
- Dashboard: `/dashboard`.
- Settings/account: `/settings`, `/account/change-password`.

## API Shape

`api/_handlers/registry.ts` is the route table shared by local and Vercel runtime. It includes auth, jobs, candidates, employees, work calendar, Siamraj unit requests, matching, Lumos, public apply/jobs, short links, branding, follow, request-control demand forecast, RBAC, audit, and diagnostics routes.

Important patterns:

- API handlers use `ApiReq`/`ApiRes` from `api/_lib/http.ts`.
- Vercel runtime expects relative API imports with `.js` suffixes.
- Source imports can use `@/` according to existing tests/build setup.
- Keep dashboard APIs read-only unless a write flow is explicitly requested and approved.

## Data Sources

- PostgreSQL migrations live in `migrations/`.
- Siamraj/MSSQL adapters and probes live under `api/_lib/siamraj*`, `api/_lib/irecruit*`, and `scripts/probe-*.mjs`.
- Public applications use `migrations/048_public_job_applications.sql`, `migrations/049_public_job_applications_structured.sql`, `api/_lib/publicApplications.ts`, `api/_handlers/public/apply.ts`, and `src/components/jobs/PublicApplyDialog.tsx`.
- Matching data uses candidate/job APIs, board match storage, proposals, request-type tracking, and server-side list filtering.

## Documentation Source Of Truth

- Request Control Tower domain rules: `.claude/skills/request-control-tower-advisor/`.
- Human project handbook: `docs/request-control-tower/HANDBOOK.md`.
- Cursor rule mirror: `.cursor/rules/request-control-tower.mdc`.
- This `.codex` skill is a project adapter. If rules disagree, stop and reconcile with `.claude/skills/request-control-tower-advisor/` first.
