# แผนที่โค้ด (Code Map)

ใช้แผนที่นี้เลือกว่าจะอ่านอะไรก่อนแก้ · ยืนยันด้วย `rg` เสมอ เพราะ repo เปลี่ยนเร็ว

## ศูนย์ควบคุมใบขอ (Request Control Tower)

เส้นทางการคำนวณของแดชบอร์ดที่ทำไว้แล้ว:

- บัญชีคุม (ledger), เหตุการณ์หาได้, SLA, สถานะ, การกระทบยอด: `src/lib/dashboard/requestControlLedger.ts`.
- adapter จาก V3 เข้าแดชบอร์ด: `src/lib/dashboard/requestControlBridge.ts`.
- ตัวประกอบแดชบอร์ดหลัก: `src/lib/dashboard/buildDashboardData.ts`.
- สรุป, การไหล, cohort, SLA, insight วงจรชีวิต: `src/lib/dashboard/buildRequestControlSummaries.ts`.
- การจำแนกวงจรชีวิตและบอร์ด: `src/lib/dashboard/lifecycle.ts`.
- การรวมยอด throughput/เหตุการณ์: `src/lib/dashboard/throughput.ts`.
- โมเดล request-control เดิมที่ยังมีคนเรียกใช้: `src/lib/requestControl.ts`.
- ชนิดข้อมูลของแดชบอร์ด: `src/lib/dashboard/types.ts`.
- หน้าแดชบอร์ด: `src/pages/dashboard/SupervisorDashboard.tsx`.
- คอมโพเนนต์ของแดชบอร์ด: `src/components/dashboard/analytics/`.
- API/การคำนวณ/หน้าจอ ของพยากรณ์ความต้องการ: `api/_handlers/request-control-forecast.ts`, `src/lib/dashboard/request-control/demandForecast.ts`, `src/lib/dashboard/request-control/demandForecastApi.ts`, `src/components/dashboard/request-control/DemandForecastPanel.tsx`.

เทสต์ที่คุมโดยตรง:

- `tests/api/requestControlLedger.test.ts`
- `tests/api/buildDashboardData.test.ts`
- `tests/api/demandFulfillmentBacklog.test.ts`
- `tests/api/requestControl.test.ts`
- `tests/api/lifecycleBoard.test.ts`
- `tests/api/lifecycleErpClassify.test.ts`
- `tests/api/throughput.test.ts`
- `tests/api/workStatusKpiAlign.test.ts`
- `tests/api/demandForecast.test.ts`

## Matching และคำขอโพสหางาน

- หน้า/UI ของ Matching: `src/pages/matching/MatchingPage.tsx`, `src/pages/matching/MatchingDashboard.tsx`, `src/pages/matching/JobPostingsPage.tsx`.
- ลิสต์ Matching ฝั่ง server: `api/_handlers/matching-list.ts`, `src/lib/matchingListFilter.ts`, `tests/api/matchingListFilter.test.ts`.
- การเสนอผู้สมัคร (proposals): `api/_lib/candidateProposals.ts`, `api/_handlers/matching-proposals.ts`, `src/lib/candidateProposalsApi.ts`, `tests/api/candidateProposalsAudit.test.ts`.
- ที่เก็บผลแมทของบอร์ด: `api/_lib/boardMatchStore.ts`, `migrations/057_board_match_results.sql`, `api/_lib/boardCandidateMatcher.ts`.
- ประเภท/สถานะคำขอโพสหางาน: `migrations/045_job_posting_requests.sql`, `migrations/050_job_posting_request_type.sql`, `api/_lib/jobPostingRequests.ts`, `api/_handlers/matching-job-postings.ts`, `src/lib/jobPostingRequestsApi.ts`, `tests/api/jobPostingRequests.test.ts`.
- ความคืบหน้า Matching และอัตราเหลือหาทางการ: `src/lib/matchingProgress.ts`, `tests/api/matchingProgress.test.ts`.

## ใบขอและใบขอหน่วยงาน Siamraj

- API/UI ของใบขอ: `api/_handlers/jobs.ts`, `src/pages/jobs/JobListPage.tsx`, `src/pages/jobs/StaffJobBoardPage.tsx`, `src/pages/jobs/JobDashboard.tsx`, `src/pages/jobs/JobDetailPage.tsx`.
- API/UI ของใบขอหน่วยงาน Siamraj: `api/_handlers/siamraj-unit-requests.ts`, `api/_lib/siamrajUnitRequests.ts`, `src/lib/siamrajUnitRequestsApi.ts`, `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx`.
- สถานะทำงาน: `api/_handlers/siamraj-unit-work-status.ts`, `api/_lib/siamrajUnitWorkStatus.ts`, `src/lib/unitRequestWorkStatus.ts`, `tests/api/unitRequestWorkStatus.test.ts`.
- เลขที่ใบขอและตัวกรองหน่วยงาน: `src/lib/siamrajRequestNo.ts`, `api/_lib/siamrajRequestNo.ts`, `tests/api/siamrajRequestNo.test.ts`, `src/lib/siamrajUnitFilters.ts`, `tests/api/siamrajUnitFilters.test.ts`.
- ตัวช่วยเรื่องความด่วน/SLA ของใบขอ: `src/lib/jobUrgency.ts`, `src/lib/jobSla.ts`, `tests/api/jobUrgency.test.ts`.

## การรับสมัครสาธารณะและลิงก์สั้น

- บอร์ดประกาศงานสาธารณะ: `src/pages/public/PublicJobBoardPage.tsx`, `src/components/jobs/JobBoardView.tsx`, `api/_handlers/public/jobs.ts`.
- ฟอร์มสมัครงานและ API: `src/components/jobs/PublicApplyDialog.tsx`, `api/_handlers/public/apply.ts`, `api/_lib/publicApplications.ts`, `src/lib/publicApplicationsApi.ts`, `tests/api/publicApply.test.ts`.
- ลิงก์สั้น: `api/_handlers/short-links.ts`, `api/_handlers/short-links-resolve.ts`, `src/lib/shortLinksApi.ts`, `src/pages/public/ShortLinkRedirectPage.tsx`.

## Auth, RBAC, การตั้งค่า

- context/UI ของ auth: `src/contexts/AuthContext.tsx`, `src/pages/LoginPage.tsx`, `src/pages/MagicLinkVerifyPage.tsx`, `src/pages/ResetPasswordPage.tsx`.
- API/ไลบรารีของ auth: `api/_handlers/auth/*`, `api/_lib/auth.ts`, `api/_lib/authSession.ts`, `api/_lib/magicLinkLogin.ts`, `api/_lib/azureAdAuth.ts`, `api/_lib/passwordReset.ts`.
- RBAC: `api/_lib/rbac.ts`, `api/_handlers/role-permissions.ts`, `src/contexts/RolePermissionsContext.tsx`, `src/lib/rbac.ts`, `tests/api/rbac.test.ts`, `tests/api/production-rbac-http.test.ts`.
- Branding/การตั้งค่า: `src/pages/settings/AdminSettings.tsx`, `src/pages/settings/BrandingAppearanceTab.tsx`, `api/_handlers/branding.ts`, `src/contexts/BrandingContext.tsx`.

## เลย์เอาต์และระบบ UI

- โครงหลักของแอป: `src/components/layout/AppLayout.tsx`, `src/components/layout/AppNavDrawer.tsx`, `src/components/layout/bottom-nav/`.
- คอมโพเนนต์ที่ใช้ร่วม: `src/components/shared/`.
- ชิ้นส่วน UI พื้นฐาน: `src/components/ui/`.
- สไตล์ส่วนกลาง: `src/index.css`, `src/App.css`.

## API และโครงสร้างพื้นฐาน

- ตาราง route: `api/_handlers/registry.ts`.
- runtime ของ API ในเครื่อง: `server/local-api.ts`, `server/bootstrap-env.ts`.
- ฟังก์ชัน catch-all ของ Vercel: `api/[[...path]].ts`.
- ยูทิลิตี้ของ API: `api/_lib/http.ts`, `api/_lib/body.ts`, `api/_lib/cors.ts`, `api/_lib/env.ts`, `api/_lib/postgres.ts`, `api/_lib/runtime.ts`, `api/_lib/logger.ts`, `api/_lib/domainErrors.ts`.
- Migration: `migrations/`.
- คอนฟิก build/dev: `vite.config.ts`, `tsconfig*.json`, `api/tsconfig.json`, `eslint.config.js`, `package.json`.
