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

### ⚠️ มี 2 เส้นคิด "หาได้แล้ว" ขนานกัน — อย่าสับสน

| เส้น | ไฟล์ | ธงคุณภาพ |
|---|---|---|
| เส้นหลัก (event-based) | `src/lib/dashboard/requestControlLedger.ts` | `DataQualityMode` = `event_based` / `snapshot_fallback` / `mixed` / `insufficient` · ถ้าเป็น `snapshot_fallback` จะ **zero ยอดรายงวด** ทิ้ง |
| เส้นย่อ (ต่อใบ) | `src/lib/requestControl.ts` → `positionBreakdownFromJob()` | `isDerived?: true` |

`positionBreakdownFromJob()` ถูกเรียก **12 จุด** ใน `buildDashboardData.ts` + `throughput.ts`
มันมี **ทางเดาจาก status** ที่แปลง `status === 'closed'` → `filledPositions = ทุกอัตรา`
ซึ่งขัดกติกาข้อ 1 ตรง ๆ (ห้ามเอา "ปิดครบใบขอ" มาเป็น "หาได้แล้ว") จึงต้องติดธง `isDerived`

**วัดกับข้อมูลจริงแล้ว (7 ส.ค. 2569) — ทางเดาไปไม่ถึงสำหรับข้อมูล ERP:**

| feed | จำนวน | ใช้เลขจาก ERP | ตกไปทางเดา |
|---|---|---|---|
| ใบขอเปิดอยู่ (`/api/siamraj/unit-requests`) | 325 | **325 (100%)** | 0 |
| ใบขอที่ปิดแล้ว (`?closed=1`) | 2,734 | **2,734 (100%)** | 0 |
| ใบขอฝั่ง PostgreSQL (`/api/jobs`) | 18 | **0 (0%)** | 18 (ในนั้น 7 ใบ `closed`) |

เหตุผลที่ไปไม่ถึง: `requestPositionTotal()` ใน `api/_lib/siamrajStaffingOpen.ts`
คืนค่า **อย่างน้อย 1 เสมอ** และ mapper ทั้งสองเส้น (`siamrajSqlServerRequests.ts` ·
`siamrajSqlServerClosed.ts`) เซ็ตครบทั้ง 3 ฟิลด์เสมอ → เข้าเงื่อนไข "เลขจาก ERP" ทุกแถว

⚠️ **แต่ลบทางเดาทิ้งไม่ได้** — `useUnitRequestsFeed` เป็นแบบ either/or:
feed Siamraj ปิด/ERP ล่มเมื่อไหร่ จะถอยไปใช้ `/api/jobs` ซึ่งไม่มีฟิลด์ staffing เลย
ทางเดาจะทำงานทันทีในจังหวะที่ตัวเลขสำคัญที่สุดและไม่มีใครสงสัยมัน

เทสต์ที่คุมไว้ (พังเมื่อไหร่ = มีคนเปิดประตูให้เลขเดาไหลเข้าแดชบอร์ด):
* `tests/api/requestControl.test.ts` — เลขจาก ERP ต้อง**ไม่**ติดธง · ทางเดาทั้ง 3 ทางต้องติดธง
* `tests/api/siamrajStaffingOpen.test.ts` — `requestPositionTotal()` ไม่มีทางคืน 0/ติดลบ
  และ `staffingPositionBreakdown()` ต้องครบสมการ ขอมา = หาได้ + ยกเลิก + เหลือหา

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
  · `outline` ต้องมี `bg-white` คู่กับ `dark:bg-*` (บั๊กที่ทำให้ต้องมี variant นี้)

### กับดักโหมดมืดที่เจอซ้ำ ๆ (ตรวจด้วยการวัด ไม่ใช่ดูตา)

อาการ: **พื้นสีอ่อนไม่มีคู่ `dark:` แต่ตัวหนังสือมี** → โหมดมืดกล่องยังสว่าง
ตัวหนังสือกลายเป็นสีจาง จมหายไปกับพื้นของตัวเอง (วัดได้ต่ำถึง 1.23 จากเกณฑ์ 4.5)
เขียนมือแล้วพลาดจุดนี้ง่ายมาก เพราะมักใส่ `dark:border` / `dark:text` ครบแต่ลืม `dark:bg`

หาเจอได้เร็วด้วยการ grep หา `bg-white` / `bg-<สี>-50|100` ในบรรทัดที่ไม่มี `dark:bg-`

⚠️ **`solid` ปลอดภัยเฉพาะตัวเลขใหญ่** — ตัวขาวบน `sky-600` ได้ 4.10 · `teal-600` 4.0 ·
`orange-500` 2.8 ซึ่งผ่านเกณฑ์ตัวใหญ่ (3:1) แต่ไม่ผ่านตัวหนังสือปกติ (4.5:1)
เอาไปทำปุ่มตัวหนังสือเล็กจะตกเกณฑ์ — ใช้ `tile` + `num` แล้วเน้นด้วยวงแหวนแทน
(เคสจริง: ปุ่มเลขหน้าใน MatchingPage)

⚠️ **เครื่องวัด contrast ที่เขียนเองต้องซ้อนสีจากล่างขึ้นบน** ถ้าไล่จากบนลงล่าง
ค่าที่ได้จะเพี้ยนบนกล่องกระจก (`bg-white/5`) และรายงาน false positive เป็นสิบจุด
— รอบนี้เจอ 17 จุด พอแก้เครื่องวัดเหลือของจริง 3 จุด
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
* `src/lib/callOutcomeTone.ts` — **โทนของ "ผลโทร" แหล่งเดียวของทั้งระบบ**
  (เดิมแตกเป็น 4 map ในไฟล์หน้า แล้วเพี้ยนกันจริง: "ไม่รับสาย" เทาใน funnel/หน้างานโทร
  แต่เหลืองบนหน้าหลัก/การ์ด Matching — เจ้าของกวาดเจอเอง 10 ส.ค. 2569)
  ทิศทางที่เคาะ: เขียว=จบดี · แดง=จบไม่ดี · เหลือง=ยังไม่จบ รอโทรซ้ำ ·
  ส้ม=ต้องคนตาม (ชุดเดียวกับถัง needs_human) · เทา=ไม่ใช่ผลการโทร (คนกดยกเลิก)
  ผู้ใช้: `CallFunnelPanel` · `CallHoldPanel` · `MyCallsPage` · `CallTeamBoardPage`
  เทสต์บังคับใน `tests/api/statusTones.test.ts` (ห้ามไฟล์หน้าประกาศ map เอง ·
  ครบทุก outcome · ทิศทางความหมายคงที่)
* **สีของสถานะ = ประกาศที่ lib เดียวเท่านั้น ห้ามทำตารางสีในไฟล์หน้า** — มีเทสต์บังคับที่
  `tests/api/statusTones.test.ts` (เช็คทั้งว่าชิปมีจริงใน index.css มีคู่ dark และหน้าเว็บ
  ไม่ประกาศ `STATUS_CLASS` ซ้ำ):
  - `candidateProposalsApi.ts` → `PROPOSAL_STATUS_TONE` / `proposalStatusChip()`
  - `jobPostingRequestsApi.ts` → `JOB_POSTING_STATUS_TONE` / `jobPostingStatusChip()`
  - `followApi.ts` → `FOLLOW_STATUS_TONE` / `FOLLOW_STATUS_CLASS` / `FOLLOW_STATUS_BAR`
  - อายุใบขอ → `jobUrgency.ts` → `JOB_AGE_URGENCY_META`
* `src/lib/candidatePriority.ts` — ลำดับความสำคัญการเรียงผู้สมัครหน้า Matching ที่เจ้าของกำหนด
  (อายุ → ที่อยู่ → ประสบการณ์ → เหล้า-บุหรี่ → คดี → รายได้ · สองตัวแรกเกณฑ์แข็ง ที่เหลือ flexible)
  เหล้า-บุหรี่/คดี ยังไม่มีข้อมูลจากบอร์ด iRecruit — โครงรับไว้แล้ว ส่ง verdict เข้ามาได้ทันทีเมื่อมี field
  เทสต์ที่ `tests/api/candidatePriority.test.ts` · จะแก้น้ำหนัก/ลำดับ แก้ที่ไฟล์นี้ที่เดียว
* `src/pages/jobs/JobListPage.tsx` (หน้าหน่วยงาน) — ตัวกรองเป็นแถบบนเต็มความกว้าง แถวแรกรวม
  ค้นหา+ปุ่มสถานะ+เปิดแท็บใหม่ · ชิปอายุใบขอ 4 ระดับจาก `JOB_AGE_URGENCY_META` (เกณฑ์ถังไม่เปลี่ยน)
  · ตัวหนังสือในตารางใช้ `DASH.cell*` (ดูหัวข้อ "สีพื้นผิวของแบรนด์ vs โหมดมืด" ด้านล่าง —
  บั๊ก `--foreground` ที่เคยเขียนไว้ตรงนี้ **แก้แล้วและมีเทสต์คุมแล้ว**)
* src/components/dashboard/request-control/ (แผงใหม่ของ parallel layer)

### สีพื้นผิวของแบรนด์ vs โหมดมืด (บั๊กเก่า — แก้แล้ว มีเทสต์คุมแล้ว)

* `src/lib/brandingStorage.ts` — `applyBrandSurfaceVars()` + `resyncBrandingForTheme()`
* `src/lib/theme.ts` — `applyThemeMode()` เรียก `resyncBrandingForTheme()` ทุกครั้งที่สลับธีม
* `tests/api/brandingSurfaceTheme.test.ts` — contract 8 เคส

ตัวบั๊ก: สีพื้นผิวของแบรนด์ถูกเขียนเป็น **inline style บน `<html>`** ซึ่ง specificity
**ชนะกฎ `.dark` ใน index.css เสมอ** เดิมเขียนทับทุกครั้งโดยไม่ดูธีม → โหมดมืดได้
"หมึกเข้มของธีมสว่าง" บนพื้นเข้ม ตัวหนังสือจมหายทั้งแอป

ทางแก้ที่ใช้อยู่: อยู่โหมดมืด = **ถอด inline ออกให้หมด** ปล่อยให้ `.dark` ทำงาน ·
โหมดสว่าง = เขียนสีแบรนด์ตามปกติ · สีที่เป็นตัวตนของแบรนด์ (primary/accent/ring)
ยังคุมทั้งสองธีมเหมือนเดิม

⚠️ **บั๊กแบบนี้ดูโค้ดเฉย ๆ ไม่เห็น** เพราะ CSS กำหนดสีถูกต้องอยู่แล้ว ตัวการคือ inline
ที่มาทับทีหลัง — จุดที่แตะแล้วบั๊กกลับมาเงียบ ๆ: ถอด `isDarkTheme()` ·
ลบตัวใดตัวหนึ่งจาก `SURFACE_VARS` · ถอด `resyncBrandingForTheme()` ออกจาก `applyThemeMode()`
เทสต์คุมทั้ง 3 ทาง (ลองย้อนโค้ดกลับไปเป็นบั๊กเดิมแล้ว เทสต์ล้ม 5 จาก 8 เคส)

วัดของจริงในเบราว์เซอร์แล้ว: มืด → ไม่มี inline `--foreground` ค่าที่ใช้จริง `240 10% 92%` ·
สว่าง → inline `0 0% 12%` · สลับไปกลับ 3 รอบยังถูก

## ความเร็วของเส้นใบขอ (ห้ามสร้าง Intl.DateTimeFormat ในลูป)

`api/_lib/businessDate.ts` — `bangkokBusinessDateYmd()` ใช้ตัวจัดรูปที่สร้าง **ครั้งเดียว**
ระดับโมดูล เดิมสร้างใหม่ทุกครั้งที่เรียก ซึ่งแพงมาก (~0.16ms/ครั้ง):
เส้นใบขอที่ปิดแล้วเรียก `toBangkokYmd` 6 ครั้ง/แถว × 5,000 แถว = 30,000 ครั้ง → 4.7 วินาที
เป็นต้นเหตุจริงของอาการ "API ใบขอที่ปิดแล้วช้า" (ไม่ใช่ SQL — SQL ใช้แค่ 0.6 วินาที)

* `src/lib/dateTh.ts` — `toYmdBangkok()` ฝั่ง client ก็ hoist แบบเดียวกัน
  · `formatDateTimeTh()` (วันที่+เวลา) และ `shortTime()` (เวลาสั้น) ใช้ตัวจัดรูป
  `thDateTimeFormat` / `thShortTimeFormat` ที่ hoist ระดับโมดูลเช่นกัน
* `tests/api/businessDate.test.ts` — contract: ความถูกต้องข้ามเขตเวลา/ข้ามปี ·
  ฝั่ง client กับ API ต้องให้ผลตรงกัน · **เทสต์ความเร็ว 30,000 ครั้งต้องไม่เกิน 1.5 วินาที**
  (พังแปลว่ามีคนเอา `new Intl.*` กลับเข้าไปในฟังก์ชัน)
* `tests/api/dateThFormatters.test.ts` — contract ของสองตัวข้างบน:
  ผลต้องตรงกับ `toLocaleString`/`toLocaleTimeString` เดิมเป๊ะ · ค่าที่อ่านไม่ออกคืนต่างกัน
  โดยตั้งใจ (`formatDateTimeTh` คืนสตริงเดิม · `shortTime` คืน `—`) · **เทสต์ความเร็ว**

⚠️ กติกา: `new Intl.DateTimeFormat` / `new Intl.NumberFormat` ให้ประกาศระดับโมดูลเสมอ
ห้ามสร้างในฟังก์ชันที่ถูกเรียกต่อแถว

⚠️ **`toLocaleString()` / `toLocaleTimeString()` / `toLocaleDateString()` ก็นับด้วย** —
มันสร้าง Intl formatter ใหม่ข้างในทุกครั้งที่เรียก ไม่ได้ปลอดภัยกว่า `new Intl.*`
วัดจริงแล้ว: 30,000 ครั้ง **4,964 ms → 266 ms (เร็วขึ้น 18.7 เท่า)** ผลลัพธ์ตรงกันทุกค่า

### cache ใบขอที่ปิดแล้ว

`api/_lib/siamrajSqlServerClosed.ts` — cache ในหน่วยความจำ TTL 10 นาที
key = `departmentScope | from | to | limit` (**scope ต้องอยู่ใน key** ไม่งั้นข้ามสิทธิ์กัน)

* เก็บเฉพาะข้อมูลจาก SQL Server ซึ่งเป็นประวัติที่ไม่ขยับแล้ว
* **ชื่อผู้รับผิดชอบไม่ถูก cache** — `attachAssignments` (PostgreSQL) วิ่งใหม่ทุกครั้ง
  เพราะ admin แก้ได้ตลอด
* คืนค่าเป็น **สำเนา** เสมอ (`{...r}`) — `attachAssignments` เขียนทับ object ที่ได้รับ
  ถ้าคืนตัวจริงจาก cache ชื่อของรอบก่อนจะค้างในแถวที่รอบใหม่ไม่มีข้อมูล (ถอนคนแล้วชื่อไม่หาย)
* `clearSiamrajClosedCache()` สำหรับเทสต์
* ผลที่วัดได้: 4–5 วินาที → **1.3 วินาที (cold) · 0.08 วินาที (warm)**

หมายเหตุ: แผน "API สรุปยอดปิดต่อคน" ในเอกสารส่งต่อ **ไม่ต้องทำแล้ว** — เป้าหมายคือกันไม่ให้
Dashboard รอนาน ซึ่งแก้ที่ต้นเหตุได้ผลกว่าและช่วยทุก endpoint ที่แปลงวันที่ ไม่ใช่แค่แผงเดียว

## ผลคัดกรองผู้สมัคร (เหล้า/บุหรี่ + ประวัติคดี)

บอร์ด iRecruit (SQL Server ของ ERP) ไม่มีสองฟิลด์นี้ และเราเพิ่มคอลัมน์ในฐานเขาไม่ได้
จึงเก็บเป็น "ชั้นทับ" ฝั่ง Jarvis ผูกด้วยคู่ `(source, candidate_ref)` แบบเดียวกับ `candidate_proposals`

* `migrations/067_candidate_screening.sql` — ตาราง `candidate_screening`
  (drinking / smoking / criminal_record เป็น `yes|no|unknown` + `criminal_note`)
* `api/_lib/candidateScreening.ts` — อ่านหลายคนในคิวรีเดียว + upsert (ส่งฟิลด์ไหนแก้ฟิลด์นั้น)
* `api/_handlers/matching-candidate-screening.ts` — `GET/POST /api/matching/candidate-screening`
  rbac ใช้ `matching-proposals` · เขียนทุกครั้งลง audit log (**ไม่เก็บข้อความคดีลง log** เก็บแค่ธงว่ามี)
* `src/lib/candidateScreeningApi.ts` — client adapter (แบ่งก้อนละ 300 ref อัตโนมัติ)
* `src/lib/candidatePriority.ts` — **ความหมายของค่า → verdict อยู่ที่นี่ที่เดียว**
  `lifestyleVerdict()` · `criminalRecordVerdict()` · `screeningVerdicts()`
* `tests/api/candidateScreening.test.ts` — contract ของทั้งการแปลงความหมายและตัวเก็บข้อมูล

กติกาที่ตั้งใจไว้ (แก้ที่ `candidatePriority.ts` ถ้าเจ้าของอยากปรับ):

| ข้อมูล | verdict |
|---|---|
| ไม่ดื่ม + ไม่สูบ | pass |
| ดื่มหรือสูบ อย่างใดอย่างหนึ่ง | warn |
| ทั้งดื่มและสูบ | fail |
| ไม่มีคดี | pass · มีคดี = fail |
| ยังไม่ได้ถาม | unknown (ไม่ถูกนับทั้งตัวตั้งและตัวหาร) |

### ต่อฝั่ง iRecruit แล้ว (เจ้าของเคาะ 7 ส.ค. 2569: ใช้ `id` ของ iRecruit เป็น ref)

* `MatchingPage` มี **2 map แยกกัน** — `screeningByRef` (บอร์ด · คีย์ `card_id`) และ
  `irScreeningByRef` (iRecruit · คีย์ `id`) + effect โหลดคนละตัว (`source` ต่างกัน)
* `ScreeningEditor` รับ prop `source` แล้ว (เดิม hardcode `'board'`)
* แถว iRecruit มีปุ่มกางฟอร์ม — `screeningOpenIrId` เปิดทีละคน (ลิสต์ยาว กางหมดอ่านไม่ไหว)

⚠️ **ห้ามยุบ 2 map เป็นก้อนเดียว** — `card_id` ของบอร์ดกับ `id` ของ iRecruit เป็นเลข
คนละชุดที่ชนกันได้ (เช่น 1805 มีทั้งสองฝั่งแต่คนละคน) ฝั่ง DB แยกด้วยคอลัมน์ `source`
อยู่แล้ว ถ้าฝั่งหน้าเว็บรวม map ผลคัดกรองของคนหนึ่งจะไปโผล่ที่อีกคน
ทดสอบกับข้อมูลจริงแล้ว: iRecruit id `209375` เก็บลง `source='irecruit'` ถูกต้อง

⚠️ ทั้งสองเกณฑ์เป็น **flexible** — `fail` แค่ลดอันดับ **ไม่ตัดใครออกจากลิสต์**
(จะให้ตัดต้องใส่ใน `config.hard` ซึ่งค่าเริ่มต้นมีแค่ `age` กับ `area`)
⚠️ `criminal_note` เป็นบันทึกให้คนอ่าน **ไม่ถูกเอาไปคิดคะแนนอัตโนมัติ** — ไม่ให้โค้ดเดาความหนักเบาของคดี
⚠️ ตารางยังไม่ถูก migrate ก็ไม่พัง — `getCandidateScreeningMap()` คืน map ว่าง (มีเทสต์คุม)

## "รับไปโทรเอง" — ล็อกสิทธิ์โทรผู้สมัคร (กันคนโทรชนกัน + กัน AI โทรทับ)

โจทย์: เจ้าหน้าที่ 6 คนโทรเอง + AI (Lumos) โทรด้วย · คนเดียวแมทได้หลายใบ
(ข้อมูลจริง: card 1805 อยู่ในผลแมท **113 ใบขอ**) ถ้าไม่ล็อกจะโทรถล่มคนเดียวกัน

* `migrations/068_candidate_call_holds.sql` — ตาราง `candidate_call_holds`
* `api/_lib/thaiPhone.ts` — `toE164Thai()` **สูตรเดียวของทั้งระบบ** (แยกออกมาเพื่อตัดวง
  import ระหว่าง `lumosDispatch` ↔ `candidateCallHolds`) — ห้ามก๊อปสูตรไปไว้ที่อื่น
* `api/_lib/candidateCallHolds.ts` — จับ/ปล่อย/บันทึกผล + `listHeldPhones()`
* `api/_handlers/matching-call-holds.ts` — GET/POST/PATCH/DELETE · rbac `matching-proposals`
* `src/lib/callHoldsApi.ts` — client adapter + `CALL_RESULT_LABEL` / `CALL_RESULT_DESTINATION`
* `src/pages/matching/MatchingPage.tsx` — การ์ด 4 สถานะ + `CallHoldPanel` (แผงโทรกางในการ์ดเดิม)
* `tests/api/candidateCallHolds.test.ts` — contract ของการกันชน

### กติกาที่ห้ามพลาด

⚠️ **กุญแจล็อกคือเบอร์ (E.164) ไม่ใช่ `candidate_ref`** — คนเดียวมีหลายรหัส
(บอร์ด `card_id` · iRecruit `id` · Follow `follow-<id>`) แต่เบอร์ที่ดังมีเบอร์เดียว
ล็อกที่ ref จะกันไม่อยู่จริง

⚠️ **DB เป็นคนตัดสินว่าใครชนะ ไม่ใช่ลำดับโค้ด** — `partial unique index`
`(phone_e164) where released_at is null` + จับด้วยการ insert แล้วอ่าน unique violation
เป็นคำตอบ "มีคนถือแล้ว" · ห้ามเปลี่ยนไปเช็คก่อนแล้วค่อย insert (race กันได้)

⚠️ **`insertQueueItems()` ใน `lumosDispatch.ts` เป็นคอขวดเดียวของการเข้าคิวทุกเส้น**
(auto / คนติ๊กเลือก / Follow) — กรองเบอร์ที่คนถือไว้ที่นั้นที่เดียวจึงครอบทุกทางเข้า
คืน `{ added, held }` · `held` ต้องไม่ถูกนับเป็น `duplicated`

⚠️ **ผลโทรใช้ศัพท์ชุดเดียวกับ Lumos outcome** (`confirmed` / `declined` /
`reschedule_requested` / `no_answer` / `wrong_person`) เพื่อให้ funnel นับ "ผลจากคน"
รวมกับ "ผลจาก AI" เป็นชุดเดียว — เพิ่มค่าใหม่ต้องเป็นค่าที่ Lumos ส่งกลับได้จริงด้วย

⚠️ **"ไม่สนใจ" แยก 2 แบบด้วย `result_scope`** (เจ้าของกำหนด):
`job` = ไม่เอางานนี้ → AI ยังเสนองานอื่นต่อได้ · `all` = ไม่หางานแล้ว → ต้องพักเบอร์
ไม่ส่ง scope มาถือเป็น `job` (ปลอดภัยกว่า ไม่ตัดคนออกจากระบบเอง)

⚠️ อายุล็อก **1 วัน** · กวาดแบบ lazy (`releaseExpiredCallHolds()` เรียกก่อนจับ/อ่านทุกครั้ง)
ไม่มี cron · `criminal`-style ข้อมูลอ่อนไหวไม่มีในตารางนี้

⚠️ **API ไม่ส่งเบอร์กลับไปหน้าเว็บ** (`toWire()`) — ล็อกของแผนกอื่นจึงไม่รั่วเบอร์
หน้าเว็บมีเบอร์อยู่แล้วและใช้ `candidateRef` เป็นคีย์

⚠️ **แตะเบอร์บนการ์ด = รับไปโทรเองอัตโนมัติ** (ล็อกก่อน แล้วต่อสาย) เดิมเป็นลิงก์ `tel:`
เปล่า ๆ กดโทรได้เลยโดยไม่ผ่านอะไร — ตัวต้นเหตุที่ทำให้โทรชนกัน

หมายเหตุ: `AcquireCallHoldResult` เป็น object **แบน** ไม่ใช่ discriminated union โดยตั้งใจ
เพราะจุดเรียกใช้อยู่ใน callback ของ setState ซึ่ง narrowing ไม่ข้ามเข้าไปให้

### หน้า "งานโทร" (โทรของฉัน + ภาระทีม รวมหน้าเดียว)

เจ้าของสั่ง 7 ส.ค. 2569: ยุบสองหน้าเป็นหน้าเดียว และ **ซ่อนไว้ให้เห็นเฉพาะ admin ก่อน**

* `src/pages/matching/MyCallsPage.tsx` (`/matching/my-calls`) — หน้าเดียวที่เหลือ
  ถังงานโทรของตัวเอง จัดกลุ่มตามใบขอ · ไฮไลต์แถวที่ใกล้คายภายใน 2 ชม. ·
  แผนผังปลายทางของผลแต่ละแบบ + ยอดวันนี้ · แล้วต่อด้วย `<CallTeamBoardSection />`
* `src/pages/matching/CallTeamBoardPage.tsx` — **เป็น section ไม่ใช่หน้าแล้ว**
  export `CallTeamBoardSection` (ไม่มี PageHeader ของตัวเอง) · แถบภาระเทียบเพดาน
  10 คน/คน · แดงเมื่อค้างเกิน 20 ชม. · โอนรายคน · คืน AI ทั้งกอง · เทกอง
* `/matching/call-team` เหลือเป็น **redirect** ไป `/matching/my-calls` (กัน bookmark เก่าพัง)

⚠️ **จุดที่คุมการซ่อน มี 4 ที่ ต้องแก้พร้อมกันตอนจะเปิดให้ทุกคน**
1. `canSeeCallDesk` ใน `MyCallsPage` (หน้าจะขึ้น "ยังไม่เปิดให้ใช้งาน")
2. `minimumRole: 'admin'` ของ `/matching/my-calls` ใน `dockNavConfig.tsx` (เมนู)
3. `canSeeCallDesk` ใน `MatchingPage` (ชิป "ของฉันถืออยู่ n คน")
4. `canSeeCallDesk` ใน `CallFunnelPanel` (ลิงก์ "รับแล้ว → ไปหน้างานโทร")
ลืมข้อ 3-4 = คนที่เข้าหน้าไม่ได้จะเห็นลิงก์แล้วกดไปเจอหน้าปิด

⚠️ นี่คือการซ่อน **หน้าจอ** เท่านั้น — สิทธิ์จริงยังอยู่ที่ API เหมือนเดิม
(`?team=1` ต้อง supervisor+ · จับล็อกใช้ rbac `matching-proposals`) ไม่ได้ผ่อนหรือรัดเพิ่ม
* API เพิ่ม: `GET ?mine=1` (คืน `{holds, tally}`) · `GET ?team=1` (403 ถ้าไม่ใช่หัวหน้า) ·
  `PATCH {holdId, transferToUserId}` โอนงาน · `DELETE ?dumpUserId=&reason=` เทกอง
* `tallyCallResultsSince()` — สรุปผลโทร**ที่คนบันทึก**ของวันนี้
  ⚠️ **แยก "ไม่เอางานนี้" (`job`) กับ "ไม่หางานแล้ว" (`all`) เป็นสองตัวเลข** เพราะปลายทางต่างกัน
  ยอดของ AI อยู่ที่ `lumos_dispatch_queue` — หน้าเว็บเอามาต่อกันเป็น funnel เดียว

⚠️ **โอนงาน = ปล่อยแถวเดิม (`transferred`) + สร้างแถวใหม่** ไม่ใช่ update ผู้ถือ
เพื่อให้ timeline เห็นว่างานเคยอยู่มือใคร · **คนรับได้เวลาใหม่เต็ม 1 วัน** ไม่ใช่เศษเวลาของคนเดิม

⚠️ บอร์ดหัวหน้าจับคู่ผู้ถือด้วย **ชื่อ** (`heldByName`) เพราะ API ไม่ส่ง `heldByUserId` กลับ
(กันข้อมูลรั่ว) — จับคู่ไม่ได้จะเทกองไม่ได้ ปุ่มจะ disable และบอกให้โอนรายคนแทน
ถ้าจะแก้ให้แน่นกว่านี้ ต้องเพิ่ม field ที่ปลอดภัย (เช่น hash) ไม่ใช่ส่ง userId ดิบ

## โหมดส่งงานให้ Lumos (manual / auto ต่อจุด)

เดิม auto-send ถูก hardcode 3 จุด · เจ้าของสั่งปิดก่อน (commit `eb8c386` ถอด call ออกตรง ๆ)
แต่บอกว่า "อนาคตจะเอากลับมานะ" — ถอดโค้ดทิ้งแล้วต้องเขียนใหม่ทั้งชุดตอนอยากเปิด
จึงเอา call กลับมา **แต่ครอบด้วยสวิตช์** ที่เก็บใน DB

* `migrations/069_lumos_dispatch_mode.sql` — ตาราง `app_lumos_dispatch_mode` (jsonb แถวเดียว)
* `src/lib/lumosDispatchMode.ts` — **ความหมายของค่าอยู่ที่นี่ที่เดียว** (ใช้ร่วมสองฝั่ง)
  trigger: `board_match` · `irecruit_search` · `follow_entry` · mode: `manual` | `auto`
* `api/_lib/lumosDispatchMode.ts` — อ่าน/เขียน + cache 60 วินาที + `isAutoDispatchEnabled()`
* `api/_handlers/lumos-dispatch-mode.ts` — `GET/PUT /api/lumos/dispatch-mode`
  (GET ทุก role · **PUT เฉพาะ admin** เพราะเปิด auto = ระบบเริ่มโทรหาคนจริง) + audit before/after
* `src/lib/lumosDispatchModeApi.ts` · `src/pages/settings/LumosDispatchModeTab.tsx` (แท็บ admin)
* `tests/api/lumosDispatchMode.test.ts` + guard เพิ่มใน `tests/api/lumosDispatchSelection.test.ts`

จุดที่ถูกครอบ (เดิมเรียกตรง ๆ):

| ไฟล์ | trigger | ช่องคิว |
|---|---|---|
| `api/_lib/boardCandidateMatcher.ts` | `board_match` | reminder |
| `api/_handlers/matching-irecruit-candidates.ts` | `irecruit_search` | interview |
| `api/_handlers/follow.ts` | `follow_entry` | reminder |

⚠️ **ทุก call site ของ auto-send ต้องผ่าน `isAutoDispatchEnabled()`** ห้ามเรียก enqueue ตรง ๆ
มีเทสต์กันที่ `lumosDispatchSelection.test.ts` (เช็คว่ามีทั้ง call และ `isAutoDispatchEnabled('<trigger>')`)

⚠️ **ค่าเริ่มต้น = manual ทุกจุด และ fail-safe ทุกทาง** — ตารางยังไม่ migrate / ค่าเพี้ยน /
คีย์ไม่รู้จัก → `manual` · เพราะเดาผิดทาง auto = โทรหาผู้สมัครจริงโดยไม่มีใครสั่ง ซึ่งกู้คืนไม่ได้
มีเทสต์กันไม่ให้ default เป็น `auto`
⚠️ DB ล้มด้วยเหตุอื่น (ไม่ใช่ 42P01) **โยนต่อ ไม่กลืน** — ไม่งั้นจะเข้าใจผิดว่าปิด auto อยู่

หมายเหตุ: ยังไม่มีโหมด `assist` (ระบบจัดชุดให้ คนกดยืนยันทีเดียว) เพราะยังไม่มีชั้น
"ชุดส่ง + อนุมัติ" รองรับ — ใส่ตอนนี้จะเป็นตัวเลือกที่กดได้แต่ไม่มีผล

## ลูปโทรซ้ำ + นัดโทรใหม่อัตโนมัติ (ได้ผลโทรแล้วทำอะไรต่อ)

ปัญหาเดิม: Lumos ส่งผลกลับครบทุกแบบอยู่แล้ว แต่ระบบเอามาแค่ "โชว์"
ไม่รับสาย 1 ครั้งจบเลย · ขอเลื่อนก็ไม่มีใครนัดใหม่ → งานตายคาที่

* `migrations/070_call_followup.sql` — เพิ่มคอลัมน์ในคิว (`attempt_count` ·
  `next_attempt_at` · `last_outcome` · `followup_state`) + ตาราง `candidate_call_suppression`
* `src/lib/callFollowupPolicy.ts` — **สมองของลูป pure ทั้งไฟล์** `resolveCallFollowup()`
  → `retry` / `needs_human` / `closed` / `suppress` · เทสต์ 25 เคส
* `api/_lib/callFollowup.ts` — เอาคำตัดสินไปเขียน DB + พักเบอร์ + `listNeedsHumanQueueItems()`
* `tests/api/callFollowupPolicy.test.ts` · `tests/api/callFollowup.test.ts`

นโยบายที่เจ้าของกำหนด (แก้ที่ `callFollowupPolicy.ts` ที่เดียว):

| ผลโทร | ทำต่อ |
|---|---|
| ไม่รับสาย / สายไม่ว่าง / โทรไม่สำเร็จ | โทรซ้ำสูงสุด **3 ครั้ง** เว้น **24 ชม.** |
| ขอเลื่อน | นัดตามเวลาที่เขาบอก · ไม่บอกใช้ **+4 ชม.** |
| สนใจ / รับทราบ | ปิดเรื่อง ส่งต่อเจ้าหน้าที่ |
| ไม่สนใจงานนี้ | ปิดแค่ใบนี้ — ใบอื่นยังเสนอได้ |
| **ไม่หางานแล้ว** | **พักเบอร์ 30 วัน ดับทุกใบขอ** |
| เบอร์ผิด | ต้องคนตาม + พักเบอร์ 7 วัน (กัน AI วนโทรเบอร์เดิม) |
| ครบเพดาน | ตกถัง **`needs_human`** = "ต้องคนตาม" |

⚠️ **ห้ามโทรช่วง 20:00–08:00** — `shiftOutOfQuietHours()` เลื่อนเวลานัดออกจากช่วงเงียบ
รวมถึงกรณีผู้สมัครนัดเองตอนกลางคืน (24 ชม. มักไปตกตอนตี 2 พอดี)

⚠️ **ตั้งคิวโทรซ้ำต้องรีเซ็ต `result` + `delivery_count` ด้วย** ไม่ใช่แค่ status = pending
ไม่งั้น `takePendingLumosItems()` จะไม่หยิบแถวนั้นอีก (มันกรอง `result is null`
และ `delivery_count < MAX_DELIVERIES`) — มีเทสต์คุม

⚠️ `takePendingLumosItems()` กรอง `next_attempt_at is null or next_attempt_at <= now()`
ถ้าลืมเงื่อนไขนี้ Lumos จะโทรทันทีไม่รอเวลานัด

⚠️ **พักเบอร์กรองที่ `insertQueueItems()`** (คอขวดเดียวเหมือนล็อกโทร)
ต่างจากล็อก: **อ่านรายการพักไม่ได้ = ไม่ส่ง** เพราะเผลอโทรคนที่บอกว่าเลิกหางานแล้วเสียหายกว่า
(ล็อกอ่านไม่ได้ = ส่งต่อ เพราะเสี่ยงโทรซ้ำ < เสี่ยงงานไม่วิ่ง) · `suppressPhone()` ใช้ `greatest()`
ตอนต่ออายุ ไม่ให้การพักถูกย่อลงโดยการเขียนทับ

⚠️ ผลจาก **AI** เข้าทาง `applyLumosResult()` · ผลจาก **คน** เข้าทาง `applyHumanCallFollowup()`
ทั้งสองใช้ `resolveCallFollowup()` ตัวเดียวกัน — คนกับ AI จึงส่งไม้ต่อกันได้
(คนโทรไม่ติด → AI รับช่วงโทรซ้ำ) · error ในลูปนี้ **ห้ามทำให้ ingest/บันทึกผลล้ม**

### นโยบายการโทร — ตั้งจากหน้า Follow ได้ (migration 073)

เจ้าของขอตั้งเองว่า "คนนึงจะโทรกี่ครั้ง และโทรช่วงเวลากี่โมงบ้าง"

* `migrations/073_call_followup_policy.sql` — `app_call_followup_policy` (jsonb แถวเดียว
  แพตเทิร์นเดียวกับ 069) seed = ค่า hardcode เดิมเป๊ะ → deploy แล้วไม่มีอะไรเปลี่ยน
* `src/lib/callFollowupPolicy.ts` — ความหมาย + normalize อยู่ที่เดิม · เพิ่ม
  `allowedCallWindow()`/`withAllowedCallWindow()` แปลงมุมคนใช้ ("โทรได้ 8–20")
  ↔ มุมนโยบาย ("ห้ามโทร 20–8") — เลขชุดเดียวกันกลับด้าน
* `api/_lib/callFollowupPolicyStore.ts` — อ่าน/เขียน + cache 60 วิ · ตารางยังไม่ migrate
  = ค่าเริ่มต้น · **DB ล้มเหตุอื่น = โยนต่อ** (ไม่งั้นเงียบ ๆ ใช้เพดานโทรคนละชุดกับที่ตั้ง)
* `api/_handlers/lumos-call-policy.ts` — `GET/PUT /api/lumos/call-policy`
  (GET ทุก role ที่เห็นหน้า Follow · **PUT เฉพาะ admin** + audit before/after)
* `src/lib/callFollowupPolicyApi.ts` · `src/components/follow/CallPolicyPanel.tsx`
* `tests/api/callFollowupPolicyStore.test.ts` (14 เคส) + เคส window ใน
  `callFollowupPolicy.test.ts`

⚠️ **จุดใช้นโยบายมี 3 ที่ ต้องครบ** (มีเทสต์ source-guard คุม):
1. `applyCallFollowupToQueueRow` (ผลจาก AI) — `policy: await getCallFollowupPolicy()`
2. `applyHumanCallFollowup` (ผลจากคน) — เหมือนกัน
3. **`insertQueueItems` ตั้ง `next_attempt_at` ให้พ้นช่วงห้ามโทรตั้งแต่ตอนเข้าคิว** —
   เดิมช่วงห้ามโทรคุมเฉพาะ "โทรซ้ำ" ของใหม่ที่กดส่งตอน 19:55 ถูก Lumos หยิบไป
   โทรตอน 21:00 ได้ · อ่านนโยบายไม่ได้ = ใช้ค่าเริ่มต้น (เข้มไว้ก่อน)

⚠️ เทสต์ `callFollowup.test.ts` นับลำดับคิวรีด้วย `sqlOf(i)` จึง mock store ให้คืน
ค่าเริ่มต้นคงที่ — พฤติกรรม store จริงมีเทสต์แยกของตัวเอง

### หน้า Follow — funnel การโทร + ถัง "ต้องคนตาม"

* `api/_handlers/lumos-call-funnel.ts` — `GET /api/lumos/call-funnel` (rbac `follow`)
  นับด้วย **group by ในฐาน** ไม่ดึงแถวมานับที่ node (คิวมี 5,300+ แถว)
  · รับ `?source=follow|board|irecruit|all` แยกต้นทางจาก prefix ของ `person_ref`
  (`follow-` / `card-` / `ir-`) · ค่าที่ไม่รู้จัก = `all` (ลิงก์เก่าไม่พัง)
  · **ถัง "ต้องคนตาม" ต้องกรองต้นทางเดียวกัน** ไม่งั้นตัวเลขกับรายชื่อขัดกันเอง

⚠️ **ยอดรวมกับยอดของหน้าเป็นคนละคำถาม** — หน้า Follow เคยโชว์ 5,307 (ทั้งระบบ)
ทั้งที่หน้านั้นส่งเองแค่ 1 คน เจ้าของทัก 10 ส.ค. 2569 ว่า "ส่ง 1 คนเองทำไมขึ้นตั้ง 5307"
ตัวเลขถูกแต่ตอบผิดคำถาม · ตอนนี้แผงเริ่มที่ `follow` (ของหน้านั้นเอง) แล้วสลับดูต้นทางอื่นได้
ข้อมูลจริงตอนแก้: card 5,280 · ir 26 · follow 1 = 5,307
เทสต์คุมที่ `tests/api/callFunnelSource.test.ts` (8 เคส รวมเคสค่ามั่วต้องไม่หลุดลง SQL)
* `src/lib/callFunnelApi.ts` · `src/components/follow/CallFunnelPanel.tsx`
  เสียบบนสุดของ `src/pages/follow/FollowPage.tsx`

⚠️ **อ่าน outcome ด้วย `coalesce(last_outcome, result->>'outcome')`** —
`last_outcome` เป็นคอลัมน์ใหม่ (migration 070) แถวที่มีผลอยู่ก่อนหน้าจะว่าง
ถ้าไม่ถอยไปอ่าน `result` หน้าเว็บจะโชว์ "มีผลกลับ 458 แต่โทรติด 0" ซึ่งดูเหมือนพัง
(เจอตอนทดสอบกับข้อมูลจริง)

⚠️ `byOutcome` อาจมีค่าที่ไม่ใช่ outcome จริงหลุดมาจากข้อมูลเก่า (เจอ `completed` 1 แถว)
หน้าเว็บกรองด้วย `CALL_OUTCOMES` จึงไม่โชว์ — อย่าถอดตัวกรองนั้นออก

⚠️ `listNeedsHumanQueueItems()` **ส่งเฉพาะฟิลด์ที่หน้าเว็บใช้** (ชื่อ/เบอร์/ref/จำนวนครั้ง)
ไม่ dump `payload` ทั้งก้อน — payload มีข้อความที่ Lumos จะพูดและข้อมูลอื่นที่ไม่จำเป็นต้องส่งออก

⚠️ ปุ่ม "รับไปตาม" ในถังนี้ใช้ **ล็อกตัวเดียวกับหน้า Matching** (`acquireCallHold` ผูกกับเบอร์)
คนอื่นถือแล้วได้ 409 พร้อมชื่อคนถือ — ไม่มีทางที่ 2 คนรับคนเดียวกันจากคนละหน้า
· `person_ref` ที่ขึ้นต้นด้วย `follow-` รับไปตามแบบนี้ไม่ได้ (ไม่ใช่ผู้สมัครในบอร์ด) ปุ่มจะไม่ขึ้น

## ชุดส่งงานโทร + อนุมัติ + ช่วงถอนคำ

โจทย์: "อนุมัติไปแล้วแล้วอยากยกเลิกมีปรับแก้อะไรจะได้ทำได้"
ทางแก้: อนุมัติแล้ว **ยังไม่เข้าคิวจริงทันที** — ตั้ง `release_at` ไว้ข้างหน้า
ระหว่างนั้นยกเลิก/ถอนคนออกได้ · พ้นเวลาแล้วค่อยเข้าคิว

* `migrations/071_lumos_call_batches.sql` — `lumos_call_batches` + `lumos_call_batch_items`
* `src/lib/callBatch.ts` — สถานะ + `CALL_BATCH_UNDO_MINUTES` (**10 นาที** — ตัวเลขที่เสนอไว้
  เจ้าของยังไม่ยืนยัน แก้ที่ค่านี้ที่เดียว)
* `api/_lib/callBatchStore.ts` — สร้าง/อนุมัติ/ยกเลิก/ถอนคน/ปล่อย
* `api/_lib/callBatchDispatcher.ts` — ตัวปล่อยเข้าคิวจริง (แยกไฟล์กัน import วงกลม)
* `api/_handlers/lumos-call-batches.ts` — `GET/POST/PATCH/DELETE /api/lumos/call-batches`
* `tests/api/callBatch.test.ts` — ความหมายของสถานะ/ช่วงถอนคำ (ฝั่ง `src/lib/callBatch.ts`)
* `tests/api/callBatchStore.test.ts` — **เงื่อนไขที่ยิงลง DB จริง** (22 เคส) ·
  พังเมื่อไหร่แปลว่ามีคนถอดตัวกันของพวกนี้ออก: `for update skip locked` ·
  `status = 'approved'` ตอน claim · `release_at` ต้องอยู่ข้างหน้าตอนอนุมัติ ·
  ยกเลิกต้องล้าง `release_at` · ถอนคนต้องผูก `batch_id` ด้วย ·
  `releaseDueCallBatches` ต้องเช็ค dispatcher **ก่อน** claim (ไม่งั้นชุดถูก mark
  `dispatched` ทั้งที่ไม่มีใครส่ง = หายเงียบ) · mutation test แล้ว 12/12 จับได้

⚠️ **ชื่อ/เบอร์อ่านใหม่ตอนปล่อย ไม่ใช่ snapshot ตอนกดเลือก** — คนอาจย้ายถัง/เปลี่ยนเบอร์
ระหว่างรออนุมัติ ใช้ค่าเก่าจะโทรผิดเบอร์ · ใช้ `resolveBoardSelection` ชุดเดียวกับการส่งเอง

⚠️ **ไม่มี cron** — `releaseDueCallBatches()` ถูกเรียกตอน `takePendingLumosItems()`
(Lumos ดึงคิวเป็นระยะอยู่แล้ว) และตอนอ่านรายการชุด · ล้มก็ไม่กระทบการเสิร์ฟคิวเดิม

⚠️ ปล่อยชุดใช้ **claim-then-work**: `update ... where status='approved' returning`
+ `for update skip locked` — 2 request พร้อมกันจะไม่ปล่อยชุดเดียวกันซ้ำ (DB ตัดสิน)

⚠️ **หนึ่งชุด = หนึ่งช่อง** (board→reminder · iRecruit→interview) ผสมกันไม่ได้
เพราะสถานะ/การยกเลิกจะกำกวม — handler ตอบ 400
· `createCallBatch()` ใน `src/lib/callBatchApi.ts` เป็นตัวเรียกฝั่ง client
· `createBatchFromSelection()` ใน `MatchingPage` **ยิงทีละฝั่ง** ถ้าผู้ใช้ติ๊กปนกัน
  = ได้ 2 ชุด ไม่ใช่ชุดเดียว · ถ้าครั้งที่สองล้ม ชุดแรกยังอยู่ ต้องบอกผู้ใช้ว่าอะไรสำเร็จแล้ว
  ไม่งั้นกดซ้ำจะได้ชุดซ้อน

⚠️ **อนุมัติได้เฉพาะ supervisor/admin** (สมมติฐาน — เจ้าของยังไม่ยืนยัน)
แก้ที่ `canApprove()` ใน handler ที่เดียว

### โหมด assist — ระบบจัดชุด คนอนุมัติ

* `src/lib/lumosDispatchMode.ts` — เพิ่มค่า `assist` + `TRIGGERS_WITH_ASSIST` + `modesForTrigger()`
* `api/_lib/lumosDispatchMode.ts` — `isAssistDispatchEnabled()`
* จุดที่รองรับ: `board_match` · `irecruit_search` (ระบบเป็นคนเริ่ม)
  **`follow_entry` ไม่มี assist** เพราะคนกรอกเอง = อนุมัติแล้วในตัว
* `src/components/follow/CallBatchPanel.tsx` — อนุมัติ/ยกเลิก/ถอนคนออก + นับถอยหลังช่วงถอนคำ
  (ซ่อนตัวเองเมื่อไม่มีชุด · **กรอง `cancelled` ออกจากรายการ** ชุดที่ยกเลิกแล้วไม่รก)
  ⚠️ **แผงนี้อยู่หน้างานโทร (`/matching/my-calls`) ไม่ใช่หน้า Follow แล้ว**
  (เจ้าของสั่ง 10 ส.ค. 2569: "หน้า Follow ไม่ต้องมีอนุมัติ") · ลิงก์แจ้งเตือน
  `batch_pending` ชี้ `/matching/my-calls` ตาม · หน้างานโทรยังซ่อนให้ admin —
  supervisor จะอนุมัติได้ก็ต่อเมื่อเปิดหน้านั้นให้ (จุดคุมการซ่อน 4 ที่ ดูหัวข้อหน้างานโทร)

### สร้างชุดเองจากหน้า Matching (ไม่ต้องรอโหมด assist)

ปุ่ม **"ตั้งชุดรออนุมัติ (n)"** ใน `LumosSendBar` — ทางเลือกคู่กับ "ส่ง AI โทร"
ที่ยิงเข้าคิวทันที · เดิมชุดเกิดได้จากโหมด assist อย่างเดียวทั้งที่ API รองรับมาแต่แรก

⚠️ **`assist` ที่จุดที่ไม่รองรับ → normalize เป็น `manual` ไม่ใช่ `auto`** (ปลอดภัยกว่า)
มีเทสต์คุม

## ฟิลด์ใบขอที่ดึงจาก ERP (หน้า "ข้อมูลใบขอ")

* `api/_lib/siamrajSqlServerRequests.ts` — **ที่เดียวที่ประกาศว่าดึงคอลัมน์ไหนจาก ERP**
  เพิ่มฟิลด์ใหม่ต้องแก้ **3 จุดในไฟล์นี้พร้อมกัน** ไม่งั้นค่าหายเงียบ:
  1. `SqlServerRequestRow` (type ของแถวดิบ)
  2. `BASE_SQL` (SELECT ชั้นใน)
  3. **`SELECT_COLUMNS`** ← จุดที่ลืมบ่อยสุด · query ซ้อน CTE อยู่
     ถ้าชั้นนอกไม่ได้ SELECT ชื่อคอลัมน์นั้น จะได้ `undefined` โดยไม่มี error
* `src/types/index.ts` (`JobRequest`) → `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx`

⚠️ **`work_place` กับ `location_address` ไม่ใช่ตัวเดียวกัน ห้ามยุบรวม**
`location_address` = `work_place1+2+3` ต่อกันแล้วผ่าน `normalizeSiamrajWorkAddress()`
เป็นตัวที่ **ตัวกรองจังหวัด/อำเภอและการจับคู่พื้นที่ฝั่ง Matching ใช้** (`useJobBoardFilters`,
`inferProvinceFromAddress`, `MatchingPage` `jobArea`) — เปลี่ยนรูปเมื่อไหร่ตัวกรองเพี้ยนทันที
`work_place` = `work_place1` เดี่ยว ๆ = ชื่อสถานที่ที่ไปประจำ **ไว้อ่านอย่างเดียว ไม่เอาไปกรอง**

⚠️ `cleanErpText()` ตัดค่าที่คนกรอกใส่ขีดทิ้งไว้ (`-` `--` `.`) ออกเป็น `undefined`
แต่ **ไม่ตัด "ไม่ระบุ"** เพราะนั่นคือคำตอบจริง ไม่ใช่ช่องว่าง
(ข้อมูลจริง 2 ปี: `boss_nationality` กรอกมา 1,949/4,924 ใบ ในนั้นเป็น `-` อีก 408 ใบ)

## แจ้งเตือนในแอป (server-backed · migration 072)

เดิมเหตุการณ์ฝั่ง server จบเงียบ — ระบบดีแค่ไหนก็ช้าเท่าคนเปิดหน้าจอ

* `migrations/072_app_notifications.sql` — กล่องขาเข้ารายคน (แจ้งทั้ง role = fan-out ตอนสร้าง)
* `api/_lib/appNotifications.ts` — `notifyUsers`/`notifyRoles` (**กลืน error เงียบ** —
  แจ้งเตือนเป็นของแถม ห้ามทำให้ ingest/สร้างชุดล้ม) · `listMyNotifications`/`markNotificationsRead`
* `api/_handlers/notifications.ts` — GET/PATCH `/api/notifications` (withAuth ทุก role เห็นของตัวเอง)
* จุดยิง: `callFollowup.applyCallFollowupToQueueRow` (สนใจ + ต้องคนตาม → admin) ·
  `callBatchStore.createCallBatch` (ชุดรออนุมัติ → supervisor/admin ครอบทุกทางเข้า)
* client: `NotificationContext` poll ทุก 60 วิ · id ฝั่ง server ขึ้นต้น `srv-` ·
  กดอ่าน PATCH กลับ · `NotificationPanel` ชนิดที่ไม่รู้จักตกไปไอคอนกระดิ่งกลาง

⚠️ dedupe ต่อคนต่อเหตุการณ์ (`recipient_user_id, dedupe_key`) — Lumos ยิงผลเดิมซ้ำไม่เด้งซ้ำ
⚠️ ผู้รับตอนนี้ = admin (หน้างานโทรยังซ่อนให้ admin) — เปิดกว้างเมื่อไหร่ขยาย role ที่จุดยิง

* `tests/api/appNotifications.test.ts` — contract 18 เคส

⚠️ **ฝั่งสร้างกลืน error ทุกแบบโดยตั้งใจ = พังแล้วไม่มีสัญญาณอะไรเลย**
ไม่มี error ไม่มี log เจ้าหน้าที่แค่ "ไม่ได้รับแจ้งเตือน" แล้วงานค้างโดยไม่มีใครรู้สาเหตุ
**เทสต์คือด่านเดียวที่จับได้** — เส้นแบ่งที่ต้องรักษา:
ฝั่ง**สร้าง** (`notifyUsers`/`notifyRoles`) กลืนหมด · ฝั่ง**อ่าน** (`listMyNotifications`/
`markNotificationsRead`) กลืนเฉพาะ 42P01 ที่เหลือโยนต่อ ไม่งั้นเข้าใจผิดว่าไม่มีแจ้งเตือน

## ประวัติการติดต่อรายคน

* `api/_handlers/matching-contact-history.ts` — GET `?phone=` รวม holds + คิว Lumos
  เส้นเวลาเดียว · คีย์เบอร์ E.164 · **ไม่ส่งเบอร์กลับ** · อ่าน outcome แบบ coalesce กับ result
* `src/components/matching/ContactHistoryStrip.tsx` — เสียบใน dialog รายละเอียดผู้สมัคร
* `tests/api/contactHistory.test.ts` — contract 13 เคส

⚠️ **สองข้อห้ามที่ผิดแล้วเป็นข้อมูลรั่ว ไม่ใช่แค่หน้าเพี้ยน** (แผงนี้รวมประวัติข้ามแผนก):
1. ห้ามส่งเบอร์กลับไปในผลลัพธ์ — หน้าเว็บมีเบอร์อยู่แล้ว มันเป็นคนส่งมาถาม
2. ห้าม select `payload` ของคิว Lumos ออกมา (มีบทที่ AI จะพูด + ข้อมูลภายใน)
   ใช้เป็นเงื่อนไข `where` ได้เท่านั้น
เทสต์คุมทั้งสองข้อ + กับดัก coalesce `last_outcome` กับ `result->>'outcome'`
(แถวก่อน migration 070 ไม่มี `last_outcome` ถ้าไม่ถอยไปอ่าน `result` จะเห็น
"มีผลกลับ แต่โทรติด 0" ซึ่งดูเหมือนพัง)

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

## แตกไฟล์ MatchingPage (5,138 → 4,221 บรรทัด)

หน้าเดียวใหญ่เกินอ่านรอบเดียว จึงค่อย ๆ ย้ายชิ้นที่ **จบในตัว รับ props อย่างเดียว**
ออกไปทีละชิ้น — ตรวจและ commit ทุกชิ้น ถอยได้ทีละชิ้นถ้าพัง

| ชิ้น | ไฟล์ที่ได้ |
|---|---|
| ตรรกะตรวจคุณสมบัติผู้สมัคร | `src/lib/candidateVerdicts.ts` · `src/components/matching/CandidateChecklist.tsx` |
| แผงโทร "รับไปโทรเอง" | `src/components/matching/CallHoldPanel.tsx` · `src/hooks/useNowTick.ts` · `src/lib/dateTh.ts` (`formatCountdown`) |
| ฟอร์มผลคัดกรอง | `src/components/matching/ScreeningEditor.tsx` |
| แผงฝั่ง Lumos | `src/components/matching/LumosPanels.tsx` (`LumosCallBadgeRow` · `LumosJobSummaryStats` · `LumosSendBar`) · `src/lib/matchingCardAction.ts` (`cardNextAction`) |
| เกณฑ์สี + รอ AI ประเมิน | `src/lib/matchTierCriteria.ts` (`TIER_CRITERIA`) · `src/components/matching/TierCriteriaTooltip.tsx` · `src/components/matching/AiEvaluationStatus.tsx` |

⚠️ **สูตรที่ใช้ได้ผลมาแล้ว 5 ครั้ง — ทำผิดลำดับแล้วพังมาก่อน**

1. **ชนิดข้อมูล/ค่าคงที่ที่ใช้ร่วมย้ายไป `src/lib/` ก่อน** ไม่งั้น import วนกลับเข้าหน้า
2. **ฟังก์ชันล้วน/ข้อมูลล้วน → `src/lib/xxx.ts` · component → `src/components/matching/Xxx.tsx`
   คนละไฟล์เสมอ** — ไฟล์ที่ export ทั้ง component และ non-component จะได้ warning
   `react-refresh/only-export-components` เพิ่ม (baseline คือ 16 warning ห้ามเกิน)
   ตัวช่วยที่ใช้แต่ในไฟล์ component เดียว **ไม่ต้อง export** ก็ไม่โดนกฎนี้
   (เช่น `formatCallWhen` ใน LumosPanels · `formatElapsed` ใน AiEvaluationStatus)
3. **ตัดบล็อกด้วย python โดยหา index ของข้อความหัว/ท้าย** ห้ามใช้ regex แทนที่
   (กติกาข้อ 3 ของโปรเจกต์ — regex หลายจุดพังมาแล้ว 2 ครั้ง)
4. **ถอด import ที่ไม่ได้ใช้แล้วออกจากหน้าด้วย** — `tsc` ไม่ฟ้อง type import
   ที่ไม่ได้ใช้ ต้องไล่เองว่าสัญลักษณ์ไหนย้ายไปหมดแล้ว
5. **พิสูจน์ว่าเป็นการย้ายล้วน** — ประกอบไฟล์ใหม่กลับเป็นบล็อกเดิมแล้วเทียบกับ
   `git show HEAD:<ไฟล์>` ให้ได้ "เท่ากันตัวต่อตัว" ก่อน commit
   (ถูกกว่าการเดาว่าไม่ได้แก้อะไร และทำให้รีวิวเชื่อได้)
6. ตรวจตามลำดับ: tsc **2 config** → eslint (ต้องได้ 16 warning เท่าเดิม) → test →
   **เปิดแท็บใหม่ในเบราว์เซอร์** เช็ค console 0 error + ฟีเจอร์ยังทำงาน

⚠️ **แก้ไฟล์ทั้งที่หน้ายัง mount อยู่ = HMR ทำให้ MatchingPage โยน error ในแท็บเก่า**
(เห็นเป็นจอดำ + `The above error occurred in the <MatchingPage> component`)
**ไม่ใช่บั๊กของโค้ด** — เปิดแท็บใหม่แล้ว flow เดิมผ่านหมด console 0 error
อย่าไล่แก้ตามรอย error ในแท็บเก่า

### ชิ้นที่แยกได้สะอาดชิ้นถัดไป (ยังไม่ทำ)

`CallHoldPanel` กับ `IrecruitMatchPanel` แยกไปแล้ว · ที่เหลือในหน้าเป็น JSX ก้อนใหญ่
ที่ผูกกับ state ของหน้าหลายตัว (การ์ดใบขอ · dialog รายละเอียดผู้สมัคร · แผง iRecruit)
แยกต่อได้แต่ต้องส่ง props เป็นสิบตัว หรือยกไปเป็น context — **ต้องถามเจ้าของก่อน**
ว่าคุ้มกับความเสี่ยงไหม อย่าตัดสินใจเอง

## หน้าจอมือถือ/แท็บเล็ต (responsive)

* `src/components/layout/AppLayout.tsx` — หัวเว็บ 2 ชุด: จอใหญ่ `hidden lg:flex` ·
  จอเล็ก `lg:hidden` (ใช้ตั้งแต่ **ต่ำกว่า 1024px** ซึ่งรวมแท็บเล็ตด้วย)
* `src/components/layout/AppNavDrawer.tsx` — เมนูข้าง (ที่อยู่ของปุ่มที่ไม่พอใส่บนหัว)
* `src/components/shared/PageHeader.tsx` — หัวของแต่ละหน้า (title + actions)

⚠️ **กับดักเดียวที่ทำให้พังซ้ำ ๆ ทั้ง 3 ที่: `shrink-0` คู่กับ `flex` ที่ไม่ wrap**

ฝั่งที่เป็น `shrink-0` จะไม่ยอมหด แล้วไปบีบฝั่ง `min-w-0` จนเหลือศูนย์ —
ของในฝั่งที่ถูกบีบจะ **ทะลุออกไปซ้อนทับเพื่อนบ้าน** ไม่ใช่แค่ล้นเฉย ๆ

| ที่เจอ | อาการจริงที่วัดได้ |
|---|---|
| หัวเว็บจอเล็ก (`AppLayout`) | กลุ่มขวา 306px ไม่ยอมหด บีบกลุ่มซ้ายเหลือ 24px ทั้งที่ปุ่ม burger กว้าง 50px → **burger ซ้อนกระดิ่งแจ้งเตือน 17px** และชื่อแอปหายทั้งอัน · ต้องการจอ ~438px ขึ้นไปถึงไม่เบียด = **มือถือทุกรุ่นพัง** |
| `PageHeader` | ช่อง `actions` เป็น `shrink-0` + แถวไม่ wrap → ล้นออกนอกจอที่ 320px (กระทบทุกหน้าที่ส่ง actions มา) |
| ช่องค้นหาหน้า Matching / หน่วยงาน | `input` ใน flex ไม่มี `min-w-0` จึงหดต่ำกว่าความกว้างเนื้อหาไม่ได้ ดันปุ่มข้าง ๆ ทะลุจอ |

**วิธีแก้ที่ใช้:** ให้แถวหลัก `flex-wrap` · ฝั่งที่ควรหดใส่ `min-w-0` ·
เลิกใช้ความกว้างตายตัว (`w-[200px]`) เปลี่ยนเป็น `max-w-*` · ปุ่มที่ไม่จำเป็นบนหัวจอเล็ก
**ย้ายเข้าเมนูข้าง ไม่ใช่ซ่อนทิ้ง** (เปลี่ยนรหัสผ่าน + ออกจากระบบ) ·
สลับธีมจอเล็กใช้ปุ่มเดียว (108px → 44px) แทนชุด Sun+Switch+Moon

### วิธีตรวจ responsive ที่ใช้ได้ผล (ทำซ้ำได้)

วัดจาก DOM ไม่ใช่ดูตา — เขียน probe แล้วไล่ทุกหน้า × ทุกขนาด เช็ค 3 อย่าง:
1. ปุ่มในหัวเว็บซ้อนกันไหม (เทียบ `getBoundingClientRect` ทุกคู่)
2. หน้าเลื่อนแนวนอนได้ไหม (`documentElement.scrollWidth > innerWidth`)
3. มีอะไรล้นขอบขวาไหม — **ต้องข้ามตัวที่อยู่ในกล่อง `overflow-x` และ `position: fixed`**
   ไม่งั้นได้ false positive จากตารางที่ตั้งใจให้เลื่อนในกล่อง

ขนาดที่ต้องลองอย่างน้อย: **320 · 375 · 414 · 768 · 1023 · 1440**
(1023 สำคัญ เพราะเป็นค่าสุดท้ายก่อนสลับไปหัวจอใหญ่)

⚠️ เปลี่ยนหน้าใน SPA ให้ใช้ `history.pushState` + `PopStateEvent` แทน `location.href`
จะได้ไม่โหลดใหม่ทั้งหน้า และ probe ที่ฝังไว้ใน `window` ไม่หาย

## typecheck ของ api/ (tsconfig.api.json — ใหม่ 10 ส.ค. 2569)

**ความจริงที่เพิ่งเจอ: `api/` ไม่เคยถูก typecheck เลย** — `npx tsc --noEmit` (default)
มีแต่ references เปล่า · `-p tsconfig.app.json` ครอบแค่ `src/` · เทสต์รันผ่าน esbuild
ซึ่งถอด type ทิ้งโดยไม่เช็ค · tsx ตอน dev ก็ไม่เช็ค → type error ใน api/ มองไม่เห็นทุกทาง

พิสูจน์ด้วยการยัด `const x: number = 'พัง'` ลง handler แล้วทั้งสอง config เงียบสนิท

* `tsconfig.api.json` — extends app + `strictNullChecks: true` · include `api` + `src/lib` + `src/types`
* บั๊กจริงที่เปิดเจอและแก้แล้ว (เทสต์คุมที่ `tests/api/loggerAndBatchNames.test.ts`):
  1. **เส้นปล่อยชุดโทรเรียกชื่อคนผิดทุกราย** — `callBatchDispatcher` อ้าง `c.full_name`
     ที่ไม่มีในชนิดข้อมูล (มีแต่ first/last/nick) → undefined เสมอ → Lumos เรียก
     ชื่อเล่นหรือ "การ์ด n" · ฝั่ง iRecruit ส่ง `job_name_th`/`position_name` ขาด
     → บทพูด AI ไม่มีชื่อตำแหน่ง
  2. **`logError(msg, e, ctx)` กลืนทั้ง error และ context** — 5 จุดเรียกแบบ 3 arg
     แต่ signature รับ 2 · Error spread ไม่ออก (non-enumerable) → log วิกฤตว่างเปล่า
     แก้ที่ signature ของ logger รองรับ (msg, error, fields) จุดเรียกเดิมถูกทันที
  3. `.replace(a, b, 1)` ใน recruitRegisterSql — arg ที่สามไม่มีจริง (ถูกทิ้งอยู่แล้ว)

⚠️ **ยังเหลือ ~25 error รอกวาด** (ส่วนใหญ่ null-safety ใน driverCareActionValidation ·
job-staff · role-permissions ฯลฯ) — config นี้ยังไม่ใช่ "ต้องเป็น 0" ใน baseline
จนกว่าจะกวาดเสร็จ · ระหว่างนี้กติกาคือ **ห้ามทำให้ตัวเลขเพิ่ม** (เช็คก่อน/หลังแก้)

## เข้าสู่ระบบด้วย Microsoft (Azure AD SSO — ใช้จริงทั้งบริษัทแล้ว)

* `api/_lib/azureAdAuth.ts` — สร้าง state · cookie · ประกอบ URL · แลก code · อ่านโปรไฟล์
* `api/_lib/authSession.ts` — ออก session หลังยืนยันตัวตนผ่าน
* `api/_handlers/auth/azure-ad-start.ts` · `api/_handlers/auth/azure-ad-callback.ts`
* `tests/api/azureAdAuth.test.ts` — contract 20 เคส (ชุดแรกของไฟล์นี้)

### ⚠️ `sanitizeReturnPath()` คือด่านกัน open redirect — แตะแล้วต้องรันเทสต์เสมอ

ค่า `returnTo` จบที่ header `Location` ตอนล็อกอินเสร็จ หลุดออกนอกเว็บได้เมื่อไหร่
= พาคนที่เพิ่งล็อกอินไปหน้าปลอมได้ทันที

**เบราว์เซอร์ normalize URL ก่อนใช้** — สองแบบนี้ผ่านด่าน "ขึ้นต้น `/` และไม่ใช่ `//`"
ได้ทั้งคู่ แต่กลายเป็น protocol-relative ตอนเบราว์เซอร์อ่าน จึงต้องตัดทิ้งด้วย:

| ค่าที่ส่งมา | เบราว์เซอร์เห็นเป็น |
|---|---|
| `/\evil.com` | `//evil.com` (แปลง `\` เป็น `/`) |
| `/<tab>/evil.com` | `//evil.com` (ตัดอักขระควบคุมทิ้ง) |

⚠️ **อย่าพึ่ง origin ที่เติมข้างหน้าอย่างเดียว** — `azureAuthSuccessRedirect()` เติม
`getAppPublicUrl()` ไว้ข้างหน้าก็จริง แต่ค่านั้นเป็น **สตริงว่างได้** เมื่อไม่ได้ตั้ง
`APP_PUBLIC_URL` และ `isAzureAdConfigured()` **ไม่ได้บังคับให้ตั้ง** (เช็คแค่
client id / secret / tenant) — เจอสภาพนั้นเมื่อไหร่ Location เหลือ path ล้วน ๆ
แล้วช่องโหว่ทำงานจริง เทสต์จึงมีเคส "ไม่ได้ตั้ง APP_PUBLIC_URL ก็ต้องไม่หลุด"

ยิงของจริงยืนยันแล้ว (`/api/auth/azure-ad/start?returnTo=...`):
`https://evil.com` · `//evil.com` · `/\evil.com` · `/\/evil.com` · `/<tab>/evil.com` ·
`/api/jobs` → ถูกตัดเป็น `/` ทั้งหมด ส่วน `/dashboard` ผ่านตามปกติ

### ของที่ยังไม่มีเทสต์ในสายนี้ (ไล่ต่อได้เลย)

`authSession.ts` · `magicLinkLogin.ts` · `roleFunctionGrants.ts` — ยังไม่มีเทสต์แตะเลย
เกณฑ์เลือกอันถัดไป: **"พังแล้วเงียบ"** กับ **"ผิดแล้วข้อมูลรั่ว"** ก่อนเสมอ

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
