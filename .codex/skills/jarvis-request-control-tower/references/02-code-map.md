# Code Map

Use this map to choose what to read before editing. Confirm with `rg` because the repo evolves quickly.

## Request Control Tower

Current implemented dashboard calculation paths:

- Ledger, fulfillment events, SLA, status, reconciliation: `src/lib/dashboard/requestControlLedger.ts`.
- V3-to-dashboard adapter: `src/lib/dashboard/requestControlBridge.ts`.
- Main dashboard assembly: `src/lib/dashboard/buildDashboardData.ts`.
- Summary, flow, cohort, SLA, lifecycle insights: `src/lib/dashboard/buildRequestControlSummaries.ts`.
- Lifecycle classification and board: `src/lib/dashboard/lifecycle.ts`.
- Throughput/event aggregation: `src/lib/dashboard/throughput.ts`.
- Legacy/request-control model still used by consumers: `src/lib/requestControl.ts`.
- Dashboard types: `src/lib/dashboard/types.ts`.
- Dashboard page: `src/pages/dashboard/SupervisorDashboard.tsx`.
- Dashboard components: `src/components/dashboard/analytics/`.
- Demand forecast API/calculation/UI: `api/_handlers/request-control-forecast.ts`, `src/lib/dashboard/request-control/demandForecast.ts`, `src/lib/dashboard/request-control/demandForecastApi.ts`, `src/components/dashboard/request-control/DemandForecastPanel.tsx`.

Direct tests:

- `tests/api/requestControlLedger.test.ts`
- `tests/api/buildDashboardData.test.ts`
- `tests/api/demandFulfillmentBacklog.test.ts`
- `tests/api/requestControl.test.ts`
- `tests/api/lifecycleBoard.test.ts`
- `tests/api/lifecycleErpClassify.test.ts`
- `tests/api/throughput.test.ts`
- `tests/api/workStatusKpiAlign.test.ts`
- `tests/api/demandForecast.test.ts`

## Matching And Job Posting Requests

- Matching page/UI: `src/pages/matching/MatchingPage.tsx`, `src/pages/matching/MatchingDashboard.tsx`, `src/pages/matching/JobPostingsPage.tsx`.
- Server-side matching list: `api/_handlers/matching-list.ts`, `src/lib/matchingListFilter.ts`, `tests/api/matchingListFilter.test.ts`.
- Candidate proposals: `api/_lib/candidateProposals.ts`, `api/_handlers/matching-proposals.ts`, `src/lib/candidateProposalsApi.ts`, `tests/api/candidateProposalsAudit.test.ts`.
- Board match storage: `api/_lib/boardMatchStore.ts`, `migrations/057_board_match_results.sql`, `api/_lib/boardCandidateMatcher.ts`.
- Job posting request type/status: `migrations/045_job_posting_requests.sql`, `migrations/050_job_posting_request_type.sql`, `api/_lib/jobPostingRequests.ts`, `api/_handlers/matching-job-postings.ts`, `src/lib/jobPostingRequestsApi.ts`, `tests/api/jobPostingRequests.test.ts`.
- Matching progress and official remaining positions: `src/lib/matchingProgress.ts`, `tests/api/matchingProgress.test.ts`.

## Jobs And Siamraj Unit Requests

- Jobs API/UI: `api/_handlers/jobs.ts`, `src/pages/jobs/JobListPage.tsx`, `src/pages/jobs/StaffJobBoardPage.tsx`, `src/pages/jobs/JobDashboard.tsx`, `src/pages/jobs/JobDetailPage.tsx`.
- Siamraj unit request API/UI: `api/_handlers/siamraj-unit-requests.ts`, `api/_lib/siamrajUnitRequests.ts`, `src/lib/siamrajUnitRequestsApi.ts`, `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx`.
- Work status: `api/_handlers/siamraj-unit-work-status.ts`, `api/_lib/siamrajUnitWorkStatus.ts`, `src/lib/unitRequestWorkStatus.ts`, `tests/api/unitRequestWorkStatus.test.ts`.
- Request numbers and unit filters: `src/lib/siamrajRequestNo.ts`, `api/_lib/siamrajRequestNo.ts`, `tests/api/siamrajRequestNo.test.ts`, `src/lib/siamrajUnitFilters.ts`, `tests/api/siamrajUnitFilters.test.ts`.
- Job urgency/SLA helpers: `src/lib/jobUrgency.ts`, `src/lib/jobSla.ts`, `tests/api/jobUrgency.test.ts`.

## Public Apply And Short Links

- Public job board: `src/pages/public/PublicJobBoardPage.tsx`, `src/components/jobs/JobBoardView.tsx`, `api/_handlers/public/jobs.ts`.
- Apply form and API: `src/components/jobs/PublicApplyDialog.tsx`, `api/_handlers/public/apply.ts`, `api/_lib/publicApplications.ts`, `src/lib/publicApplicationsApi.ts`, `tests/api/publicApply.test.ts`.
- Short links: `api/_handlers/short-links.ts`, `api/_handlers/short-links-resolve.ts`, `src/lib/shortLinksApi.ts`, `src/pages/public/ShortLinkRedirectPage.tsx`.

## Auth, RBAC, Settings

- Auth context/UI: `src/contexts/AuthContext.tsx`, `src/pages/LoginPage.tsx`, `src/pages/MagicLinkVerifyPage.tsx`, `src/pages/ResetPasswordPage.tsx`.
- Auth APIs/libs: `api/_handlers/auth/*`, `api/_lib/auth.ts`, `api/_lib/authSession.ts`, `api/_lib/magicLinkLogin.ts`, `api/_lib/azureAdAuth.ts`, `api/_lib/passwordReset.ts`.
- RBAC: `api/_lib/rbac.ts`, `api/_handlers/role-permissions.ts`, `src/contexts/RolePermissionsContext.tsx`, `src/lib/rbac.ts`, `tests/api/rbac.test.ts`, `tests/api/production-rbac-http.test.ts`.
- Branding/settings: `src/pages/settings/AdminSettings.tsx`, `src/pages/settings/BrandingAppearanceTab.tsx`, `api/_handlers/branding.ts`, `src/contexts/BrandingContext.tsx`.

## Layout And UI System

- App shell: `src/components/layout/AppLayout.tsx`, `src/components/layout/AppNavDrawer.tsx`, `src/components/layout/bottom-nav/`.
- Shared components: `src/components/shared/`.
- UI primitives: `src/components/ui/`.
- Global styles: `src/index.css`, `src/App.css`.

## API And Infra

- Route registry: `api/_handlers/registry.ts`.
- Local API runtime: `server/local-api.ts`, `server/bootstrap-env.ts`.
- Catch-all Vercel function: `api/[[...path]].ts`.
- API utilities: `api/_lib/http.ts`, `api/_lib/body.ts`, `api/_lib/cors.ts`, `api/_lib/env.ts`, `api/_lib/postgres.ts`, `api/_lib/runtime.ts`, `api/_lib/logger.ts`, `api/_lib/domainErrors.ts`.
- Migrations: `migrations/`.
- Build/dev config: `vite.config.ts`, `tsconfig*.json`, `api/tsconfig.json`, `eslint.config.js`, `package.json`.
