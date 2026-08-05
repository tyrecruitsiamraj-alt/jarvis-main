# Editing Map

Use this file to know where to change the inside logic later.

## Business wording / dashboard labels

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/02-dashboard-metric-definitions.md
* .cursor/rules/request-control-tower.mdc

Future code:

* src/components/dashboard/request-control/
* KPI card components
* work queue table labels

## Request date / effective date logic

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/requestLedger.ts
* src/lib/dashboard/request-control/calculations.ts
* src/lib/jobUrgency.ts

## SLA days and SLA status

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/04-sla-rules.md

Future code:

* src/lib/dashboard/request-control/sla.ts

## Lifecycle mapping

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/lifecycle.ts

## Backlog equation / calculation

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/calculations.ts
* src/lib/dashboard/request-control/reconciliation.ts

## UI style / layout

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/05-ui-design-rules.md

Code:

* `src/lib/designTokens.ts` — **token กลางของสี** (แหล่งเดียวของความหมายสีทั้งแอป)
  * `TONE` 9 โทน × variant (`bar` / `tile` / `num` / `value` / `soft` / `softHover` / `solid` / `dot` / `chip` / `hex`)
  * `DASH` พื้นผิวหน้า `/dashboard` (การ์ด · หัวข้อ · ตาราง · การ์ดดำผู้บริหาร)
  * `CHART` ค่าที่ recharts ต้องรับเป็นค่าจริง (แกน/เส้นตารางใช้ `currentColor` · tooltip ป้ายดำ)
  * เปลี่ยนความหมายสีของ metric ให้แก้ที่ map ใน component (`KPI_TONE`, `BUCKET_TONE`, `SLA_TONE`, …)
    ซึ่งอ้าง `ToneKey` — ห้ามเขียน class สี Tailwind สดใหม่ในหน้า dashboard
* `tests/api/designTokens.test.ts` — contract: ครบทุกโทน · มีคู่ `dark:` · chip ต้องมี class จริงใน index.css
* `src/index.css` — `jarvis-chip-*` (คู่ light/dark ของชิปทั้ง 9 โทน) + `.jarvis-dark-card` + `.jarvis-hero-card`
* `src/components/dashboard/analytics/DashboardHeroStrip.tsx` — hero เข้ม "ต้องลงมือตอนนี้"
  (mockup rev.3 ข้อ 02): ถังอายุจาก `ageDaysBreakdown` (drill-down เดิม 1:1) + ชิปคงเหลือทั้งระบบ +
  แท่งเข้ามารายเดือนย่อจาก `activityTrend` — **แทนที่ DashboardAgeOverview บนหน้า**
  (ไฟล์เดิมยังอยู่แต่ไม่ถูก render · เกณฑ์ถัง/การนับไม่เปลี่ยน)
* Layout Dashboard ตาม mockup rev.3: KPI มีแถบสัดส่วน (`progressPercent` ใน DashboardKpiCard คำนวณใน Shell) ·
  สถานะทำงานเป็นชิปแทนการ์ด 11 ใบ (ครบทุกสถานะ ศูนย์=จาง) · "ต้องแก้วันนี้" (ย่อ, เลื่อนใน-การ์ด)
  คู่กับ "สมการงานค้าง" (FlowView ย่อ — สมการบรรทัดเดียว + อัตรา 8 ช่อง + กระทบยอดตามกติกา) ·
  สรุปผู้บริหาร/Life Cycle+แนวโน้ม ยุบเป็นแถวกดขยาย — **ข้อมูลครบทุกแผง ไม่มีตัวไหนหาย**
* `src/components/shared/PageHeroStrip.tsx` — แถบหัวหน้าสีเข้ม + `heroButton`/`heroButtonSolid`
  (ปุ่มบนพื้นเข้ม) · ใช้ที่บอร์ดรับสมัคร · หน้า admin ไม่ใส่ตามกติกา mockup ข้อ 09
* `src/components/shared/NameAvatar.tsx` + `src/lib/nameAvatar.ts` — ตัวย่อชื่อ + สีประจำคน
  (deterministic จากชื่อ ไม่ผูกลำดับแถว) · เทสต์ที่ `tests/api/nameAvatar.test.ts`
* `src/lib/followApi.ts` — `FOLLOW_STATUS_CLASS`/`FOLLOW_STATUS_BAR` ชี้เข้า TONE แล้ว
  (เดิมเป็นชุดสี `/15` ของตัวเอง ไม่มีคู่ dark)
* `src/pages/jobs/JobListPage.tsx` (หน้าหน่วยงาน) — ตัวกรองเป็นแถบบนเต็มความกว้าง แถวแรกรวม
  ค้นหา+ปุ่มสถานะ+เปิดแท็บใหม่ · ชิปอายุใบขอ 4 ระดับจาก `JOB_AGE_URGENCY_META` (เกณฑ์ถังไม่เปลี่ยน)
  · **ตัวหนังสือในตารางต้องใช้ `DASH.cell*` ไม่ใช้ `text-foreground`** เพราะ
  `brandingStorage.applyBrandingToDocument()` เขียน `--foreground` ทับ inline บน `<html>`
  ค่านั้นจึงไม่สลับตามธีม (bug ระดับแอป แยกไป task ต่างหาก) — ถ้าเผลอใช้ `text-foreground`
  บนพื้นเข้ม จะได้ตัวหนังสือเข้มบนการ์ดเข้มในโหมดมืด
* src/components/dashboard/request-control/ (แผงใหม่ของ parallel layer)

## Safe implementation / feature flag

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/06-safe-implementation-rules.md
* .cursor/rules/request-control-tower.mdc

Future code:

* feature flag config
* dashboard routing/render logic

## Cursor prompt patterns

Edit:

* .claude/skills/request-control-tower-advisor/references/07-cursor-prompt-patterns.md

## Codex project skill adapter

Edit:

* .codex/skills/jarvis-request-control-tower/SKILL.md
* .codex/skills/jarvis-request-control-tower/references/01-project-overview.md
* .codex/skills/jarvis-request-control-tower/references/02-code-map.md
* .codex/skills/jarvis-request-control-tower/references/03-workflow-and-validation.md

Rule:
Keep `.claude/skills/request-control-tower-advisor/` as the domain source of truth. The `.codex` skill may summarize repo structure and route Codex to the `.claude` references, but it must not introduce conflicting metric rules.

## Redteam / SWOT / pre-mortem checklist

Edit:

* .claude/skills/request-control-tower-advisor/references/08-redteam-premortem-checklist.md

## SQL mapping changes

Edit documentation first:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* api/_lib/siamrajRequestControlAdapter.ts
* api/_handlers/request-control-dashboard.ts

Rule:
If new internal files are added later, update this editing map.

## Current related code (already in repo — do not rewrite blindly)

Existing Control Tower / analytics paths (read before parallel-layer work):

* `src/lib/dashboard/requestControlLedger.ts`
* `src/lib/dashboard/requestControlBridge.ts`
* `src/lib/dashboard/buildDashboardData.ts`
* `src/lib/dashboard/buildRequestControlSummaries.ts`
* `src/pages/dashboard/SupervisorDashboard.tsx`
* `src/components/dashboard/analytics/`
* `src/lib/requestControl.ts`
* `tests/api/requestControlLedger.test.ts`
* `tests/api/buildDashboardData.test.ts`
* `tests/api/demandFulfillmentBacklog.test.ts`
* `src/pages/matching/MatchingPage.tsx`
* `api/_lib/candidateProposals.ts`
* `migrations/047_candidate_proposals_branch.sql`
* `tests/api/unitBranchOverride.test.ts`

## Scrap & Content work requests from Matching

* `migrations/045_job_posting_requests.sql` — original request table
* `migrations/050_job_posting_request_type.sql` — backward-compatible Content/Scraping discriminator
* `api/_lib/jobPostingRequests.ts` — request adapter and validation
* `api/_handlers/matching-job-postings.ts` — read/write API
* `src/lib/jobPostingRequestsApi.ts` — frontend API adapter
* `src/pages/matching/MatchingPage.tsx` — request-type selection at source
* `src/pages/matching/JobPostingsPage.tsx` — request tracking UI
* `tests/api/jobPostingRequests.test.ts` — request type/status contract tests

## Demand forecast (พยากรณ์ใบขอเข้าใหม่ตามประเภท — แทนที่ตาราง Life Cycle เมื่อ flag เปิด)

* `api/_handlers/request-control-forecast.ts` — read-only API: aggregate 3y+YTD by month × lifecycle (net = intake − cancelled), per-year in-memory cache
* `src/lib/dashboard/request-control/demandForecast.ts` — pure forecast calc: avg/min/max per month per group, current-month expectedMore
* `src/lib/dashboard/request-control/demandForecastApi.ts` — frontend fetch adapter
* `src/components/dashboard/request-control/DemandForecastPanel.tsx` — dashboard panel UI
* `src/components/dashboard/analytics/DashboardChartSection.tsx` — flag switch (VITE_REQUEST_CONTROL_FORECAST_ENABLED !== 'false'; ปิด flag = ตาราง Life Cycle เดิม)
* `tests/api/demandForecast.test.ts` — aggregation + forecast contract tests

## Matching list server-side pagination (zero-drift)

* `src/lib/matchingListFilter.ts` — filter+sort ของลิสต์ Matching เป็น pure fn ชุดเดียว รันทั้ง client และ server (ห้าม logic แตกกัน — แก้ที่นี่ที่เดียว)
* `api/_handlers/matching-list.ts` — GET /api/matching/list: ท่อเดียวกับ feed หลัก (fetch+attach) + enrich + proposals/stored-matches จาก PG + shared filter/sort + slice; คืน items/total/unitOptions/summary/storedMatches
* `api/_lib/boardMatchStore.ts` + `migrations/057_board_match_results.sql` — ผล AI แมทเก็บถาวร (write-through ใน boardCandidateMatcher; endpoint เดี่ยวเสิร์ฟจาก store เมื่อไม่ refresh)
* `src/pages/matching/MatchingPage.tsx` — flag `VITE_MATCHING_SERVER_LIST` (default on; ตั้ง 'false' = กลับ client เดิม)
* `tests/api/matchingListFilter.test.ts` — contract ของ pipeline กลาง
* หมายเหตุ: api import src ผ่าน `@/` ได้ (tsx + Vercel build ตรวจแล้วผ่านทั้งคู่)

## Public applications from /apply

* `migrations/048_public_job_applications.sql` — application table
* `migrations/049_public_job_applications_structured.sql` — structured fields (prefix/name/age/gender/address)
* `api/_lib/publicApplications.ts` — validation + Thai phone/age normalization
* `api/_handlers/public/apply.ts` — public POST endpoint (rate-limited)
* `src/components/jobs/PublicApplyDialog.tsx` — application form dialog
* `src/components/jobs/JobBoardView.tsx` — apply buttons on /apply board
* `tests/api/publicApply.test.ts` — validation contract tests

## ภาระงานตามรหัสไซต์ (Root Cause ระดับไซต์ — เดิม group ตามชื่อหน่วยงาน)

เจ้าของสั่งเปลี่ยน 4 ส.ค. 2569: แผงนี้ group ด้วย `site_code` ไม่ใช่ `unit_name`
เหตุ: ลูกค้ารายเดียวมีหลายไซต์ (ข้อมูลจริง 147 รหัสไซต์ จาก 127 ชื่อลูกค้า) การ group ด้วยชื่อ
ยุบหลายไซต์เป็นแท่งเดียว มองไม่เห็นว่าไซต์ไหนหนักจริง — ตรงกับเป้าข้อ 9 (root cause ระดับ site)

* `src/lib/dashboard/buildDashboardData.ts` — `buildUnitOverview()` group ด้วย `site_code`
  (ถอดพารามิเตอร์ `organizationScopeNames` ของ `buildDashboardData` ที่ใช้แค่รวมชื่อออกแล้ว)
* `src/lib/dashboard/types.ts` — `DashboardUnitOverview` เพิ่ม `siteCode` / `unitName`
  (`name` = ป้ายบนกราฟ = รหัสไซต์ · คงชื่อฟิลด์ไว้ให้ผู้ใช้เดิมไม่พัง)
* `src/lib/unitGroupName.ts` — `NO_SITE_CODE_LABEL` ถังใบขอที่ไม่มีรหัสไซต์ (ห้ามทิ้งเงียบ)
* `src/lib/dashboard/drillDownFilters.ts` — `filterJobsForSiteCode()` แทน `filterJobsForUnitName()`
  (เทียบรหัสตรงตัว ไม่ผ่านการรวมชื่อ)
* `src/components/dashboard/analytics/DashboardUnitOverviewChart.tsx` — แกน Y = รหัสไซต์ ·
  ชื่อลูกค้าอยู่ใน tooltip · prop `onSiteClick(siteCode, label)`
* `src/components/dashboard/analytics/DashboardShell.tsx` — หัวข้อ "ภาระงานตามรหัสไซต์" · นับเป็น "ไซต์"
* `tests/api/unitGroupName.test.ts` — contract: ลูกค้าเดียวกันต่างไซต์ต้องแยกแถว · ไซต์เดียวกันต้องรวม ·
  ใบไม่มีรหัสไซต์ต้องอยู่ในถังที่มีป้าย ยอดรวมไม่หาย

⚠️ helper รวมชื่อ (`buildOrganizationKeyResolver` / `pickUnitOrganizationDisplayName`) ยังใช้อยู่ —
ใช้เลือกชื่อลูกค้าที่จะโชว์ใน tooltip และใช้ที่ตัวกรองหน่วยงาน ไม่ใช่ที่การ group แล้ว

## Work status master (สถานะทำงานของใบขอ — Admin แก้ได้เอง)

ก่อนหน้านี้สถานะทำงาน hardcode ไว้ 3 ที่ (CHECK constraint + array ฝั่ง API + labels ฝั่ง client)
ทำให้ต้องเขียน migration ใหม่ทุกครั้งที่เพิ่มสถานะ (039/053/054/056) — ย้ายมาเก็บใน DB แล้ว

* `migrations/062_work_status_master.sql` — ตาราง master + seed 9 ค่า built-in + เปลี่ยน CHECK → FK
* `api/_lib/workStatusMaster.ts` — CRUD + `BUILTIN_WORK_STATUSES` (fallback เมื่อยังไม่ migrate)
* `api/_handlers/work-status-master.ts` — GET ทุก role / POST-PATCH-DELETE admin (rbac: `work-status-master`)
* `api/_lib/siamrajUnitWorkStatus.ts` — `isAllowedWorkStatusCode()` รับค่าที่ admin เพิ่มเองด้วย
* `src/lib/workStatusMasterApi.ts` — client API + `builtinWorkStatusItems()`
* `src/hooks/useWorkStatusOptions.ts` — cache ระดับ module + `invalidateWorkStatusOptions()`
* `src/pages/settings/WorkStatusMasterTab.tsx` — หน้าตั้งค่า (แท็บ "สถานะทำงาน", admin only)
* `src/components/jobs/UnitRequestWorkStatusField.tsx` — dropdown/ป้ายวันที่อ่านจาก master
* `tests/api/workStatusMaster.test.ts` — built-in ต้องตรงกัน 3 ที่ + migration seed ก่อน FK

⚠️ ค่า built-in 9 ตัวลบไม่ได้ (dashboard/KPI อ้าง code ตรง ๆ เช่น `in_progress`) — ปิดใช้งานได้เท่านั้น
