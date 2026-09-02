# แผนที่การแก้ไข (Editing Map)

ใช้ไฟล์นี้เพื่อรู้ว่าจะไปแก้ตรรกะภายในเรื่องไหนที่ไฟล์ไหน

## ถ้อยคำทางธุรกิจ / ป้ายบนแดชบอร์ด

แก้เอกสาร:

* .claude/skills/request-control-tower-advisor/references/02-dashboard-metric-definitions.md
* .cursor/rules/request-control-tower.mdc

โค้ดที่จะเกิดในอนาคต:

* src/components/dashboard/request-control/
* คอมโพเนนต์การ์ด KPI
* ป้ายตารางคิวงาน

## ตรรกะวันที่ของใบขอ / วันที่มีผล

แก้เอกสาร:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/requestLedger.ts
* src/lib/dashboard/request-control/calculations.ts
* src/lib/jobUrgency.ts

## จำนวนวัน SLA และสถานะ SLA

แก้เอกสาร:

* .claude/skills/request-control-tower-advisor/references/04-sla-rules.md

Future code:

* src/lib/dashboard/request-control/sla.ts

## การแมปวงจรชีวิตใบขอ (Lifecycle)

แก้เอกสาร:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/lifecycle.ts

## สมการ/การคำนวณงานค้าง (Backlog)

แก้เอกสาร:

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

## สไตล์/เลย์เอาต์ของ UI

แก้เอกสาร:

* .claude/skills/request-control-tower-advisor/references/05-ui-design-rules.md

โค้ด:

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

⚠️ **ชื่อคีย์ของเบอร์ใน payload ต่างกันตามช่อง** — reminder ใช้ `recipient_phone` ·
interview ใช้ `phone` · `PAYLOAD_PHONE_KEYS` ใน `lumosDispatch.ts` เป็นแหล่งเดียว
ทั้งฝั่ง JS (`payloadPhone()`) และฝั่ง SQL (`phoneExprFor()`) — **ต้องแก้พร้อมกันเสมอ**
บั๊กเดิม (แก้ 11 ส.ค. 2569): อ่านแค่ `recipient_phone` → ฝั่ง iRecruit ได้ null ทุกแถว
โค้ดข้ามการเช็คเมื่อไม่มีเบอร์ → **ล็อก "รับไปโทรเอง" กับการพักเบอร์ไม่เคยมีผลกับช่อง
interview เลย** (AI โทรทับคนที่เจ้าหน้าที่ถืออยู่ และโทรคนที่บอกว่าเลิกหางานแล้ว)

### บทที่ AI พูด — รายละเอียดใบขอที่ส่งไปกับสาย

`api/_lib/lumosJobBrief.ts` (pure) · เทสต์ `tests/api/lumosJobBrief.test.ts` (19 เคส · mutation 8/8)

⚠️ **schema ของ Lumos ไม่มีที่ใส่ข้อมูลงานแบบมีโครงสร้าง** (ดู `docs/lumos-api.md`)
reminder รับแค่ 7 ฟิลด์ตายตัว — ช่องเดียวที่ถึงหูผู้สมัครคือ `steps[].message`
ฝั่ง interview คือ `questions[]` · **ห้ามเพิ่มฟิลด์ใหม่เข้า payload** เราคุมฝั่ง Lumos ไม่ได้

ที่ใส่เพิ่ม (เจ้าของสั่ง 11 ส.ค. 2569): สถานที่ทำงาน · วันเวลาทำงาน · "ต้องใช้รถของตัวเอง"
(จาก `contract_type_name` = "คน+รถ") · ช่วงอายุที่รับ · วันเริ่มงานเป็นวันที่ไทย
วัดแล้วทุกฟิลด์กรอกมา **100%** จาก 313 ใบขอที่เปิดอยู่

⚠️ **`work_schedule` = `work_date • work_time` ตัดรวมเป็นก้อนเดียวไม่ได้** — ท่อนแรก
เป็นข้อความบรรยายยาวได้ ตัดตรง ๆ แล้ว "เวลาจริง" หายทั้งท่อน ซึ่งเป็นข้อมูลที่ผู้สมัคร
อยากรู้ที่สุด (เจอกับข้อมูลจริง 2 ใน 3 ใบที่สุ่มดู) · `trimSchedule()` ตัดทีละท่อนแล้วต่อกลับ
⚠️ **ทุกค่าตัดความยาวมาแล้ว** เพราะเป็นบทที่ AI พูดออกเสียง ไม่ใช่ข้อความบนจอ
ข้อมูลจริงมี `work_time` ยาวเกิน 300 ตัวอักษร (ตารางกะ 4 กะพร้อมหมายเหตุภายใน)
· ข้อความยาวสุดจาก 313 ใบขอหลังแก้ = **427 ตัวอักษร**
⚠️ **ประโยคเรื่องรถห้ามถูกตัด** — เป็นเงื่อนไขที่ผู้สมัครตัดสินใจได้ทันที
⚠️ **ห้ามเอา `contact_name`/`contact_phone`/`resigned_employee_name` เข้าบท** —
เป็นข้อมูลภายใน มีเทสต์คุม (fixture ต้องยิงครบทุกสาขา ไม่งั้นเทสต์อ่อนโดยไม่มีใครรู้ —
รอบแรกพลาดตรงนี้ mutation หลุด)
⚠️ `new Intl.DateTimeFormat` ของ `speakableDate()` ประกาศระดับโมดูล (กติกาข้อ 10)
มีเทสต์ความเร็ว 30,000 ครั้ง — ย้ายกลับเข้าฟังก์ชันแล้วช้าจาก 0.1 วิ เป็น 4.9 วิ

### ระบบ Lead — ปัดใบสมัครเข้าคลังสำรอง (migration 083 · 14 ส.ค. 2569)

เจ้าของเคาะ: *"ตามระบบเดิมเป๊ะ — ปัดออกจากคิว"* + **ปัดแล้วหายจากทุกแท็บ + มีตัวกรองเรียกคืน**

* `migrations/083_application_leads.sql` — `is_lead` / `lead_by` / `lead_by_name` / `lead_at`
  บน `public_job_applications` (แพตเทิร์นเดียวกับ claim 079) · partial index บนฝั่ง Lead
* `api/_handlers/job-applications.ts` — `{{leadWhere}}` ใน `buildApplicationsListQuery()`
  (`not is_lead` ปกติ · `is_lead` เมื่อ `?lead=1`) · `patchLead()` รับ `PATCH {id, lead}`
* `src/lib/publicApplicationsApi.ts` — `fetchAllJobApplications(leadView)` · `setJobApplicationLead()`
* `src/lib/recruitLead.ts` — `summarizeLeadUpdate()` + ป้าย · เทสต์ `tests/api/recruitLead.test.ts`
  (10 เคส · mutation 6/6)
* `src/components/recruit-rm/RmWorkspace.tsx` (`?lead=1` + `applyLead()`) · `RmSearchBar.tsx`

⚠️ **กรองที่คิวรีฝั่ง server ไม่ใช่ที่หน้าเว็บ** — แท็บของหน้า RM เป็นตัวกรองที่หั่นลิสต์
ก้อนเดียวกัน กรองทีหลังจะหลุดบางแท็บ ("หายจากทุกแท็บ" จึงต้องหายตั้งแต่ต้นทาง)
⚠️ **เงื่อนไข Lead ห้ามกิน param** — คิวรีนี้เคยตาย 500 มาแล้วจาก `bind message supplies
N parameters` (ดูหัวข้อ claim) · `not is_lead` เป็นเงื่อนไขล้วน ไม่ต้องมี `$n` · มีเทสต์
เช็คว่า `$n` สูงสุดที่ SQL อ้าง = จำนวน param ที่ส่ง ครบทุกชุดเงื่อนไข
⚠️ **fallback คอลัมน์เป็น 4 ชั้นแล้ว** (074+079+083 → 074+079 → 074 → ก่อน 074)
· ชั้นที่ยังไม่มีคอลัมน์ Lead ใช้ `true` แทนเงื่อนไข **ยกเว้นมุมมองคลังสำรองที่ต้องเป็น
`false`** ไม่งั้นฐานที่ยังไม่รัน 083 จะโชว์ทุกแถวเป็น "คลังสำรอง"
⚠️ **Lead เป็นสถานะระดับระบบ ไม่ใช่ของใครคนหนึ่ง** (ต่างจาก claim) — ใครปัดก็หายจาก
ลิสต์ของทุกคน จึงไม่มี 409 · ชื่อคนปัดส่งให้ทุกคนเห็นได้
⚠️ **ไม่แตะ `status`** ตอนปัด — ต่างจาก claim ที่ขยับ new → contacted · ปัดเข้าคลังสำรอง
ไม่ได้แปลว่าคุยกับเขาแล้ว เดาแทนคนตรงนี้จะทำให้ยอด funnel เพี้ยน

### "โทรแล้วสนใจ → จองตัวเลย" (14 ส.ค. 2569)

หลังถอดปุ่มจอง/เสนอ/ลงงานออกจาก drawer หน้า Matching (รอบแปด) **การจองฝั่ง iRecruit
ไม่มีปุ่มเหลือเลย** ทั้งที่ `CALL_RESULT_DESTINATION.confirmed` บอกผู้ใช้ว่า "เข้าเส้นจองตัว"
และชิปบนการ์ดพูดว่า "มีคนสนใจ N — กดจองตัวเลย" (`matchingCardAction.ts`) — คำสัญญาที่ไม่มีปลายทาง

* `src/lib/callResultBooking.ts` — **ตรรกะล้วนที่เดียว** · `bookingTargetFromPersonRef()`
  (คิว Lumos) · `bookingTargetFromHold()` (ล็อกโทร) · `bookingActionFor()`
  · เทสต์ `tests/api/callResultBooking.test.ts` (16 เคส · mutation 7/7)
* จุดใช้ 2 ที่: `src/pages/HomePage.tsx` (dialog รายละเอียดคน — **เฉพาะกล่อง "สนใจงาน"**)
  · `src/pages/matching/MyCallsPage.tsx` (แถวใน "เพิ่งบันทึกรอบนี้" ที่ผลเป็น `confirmed`)
* ทั้งสองที่ยิง `saveProposal()` เส้นเดียวกับปุ่มจองในหน้า Matching → ติดกติกาเดิมครบ
  (1 คนจองได้ใบเดียว · backend ตอบ 409 พร้อมบอกว่าติดใบไหน)

⚠️ **`bookingTargetFromPersonRef` ต้องตรงกับ `splitPersonRef()` ใน `api/_lib/callFollowup.ts` เป๊ะ**
(`card-` 5 ตัว · `ir-` 3 ตัว) — ตัดผิดความยาวแล้วได้ ref ที่ชี้ไปหาคนอื่นโดยไม่มี error
⚠️ **`application` (ใบสมัครที่ดึงเข้าถังโทร) จองไม่ได้** — `candidate_proposals.source`
รับแค่ `board`/`irecruit` และ ref ของใบสมัครเป็นคนละชุดกับ `card_id` ของบอร์ด
⚠️ **ห้ามส่ง `job_position` ไปเป็น `candidate_position`** — อันแรกเป็นตำแหน่งของ**ใบขอ**
ไม่ใช่ของผู้สมัคร · ใส่ไปจะได้ประวัติการจองที่บอกอาชีพผู้สมัครผิดโดยไม่มีใครทัก
⚠️ ล็อกโทรที่ API คืนมา **ไม่มีเบอร์** (กันเบอร์แผนกอื่นรั่ว) แถวจองจากถังโทรจึงไม่มีเบอร์
⚠️ invariant `disabled === (reason !== null)` เหมือน `lumosSendActions.ts` — มีเทสต์บังคับ
  · เหตุผลต้อง**ตรงกรณี**: Follow / ใบสมัคร / ไม่รู้ต้นทาง เป็นคนละข้อความ (เทสต์คุมทั้งสามทาง)

### ล้างคิวโทรค้างเป็นชุด (`scripts/cancel-stale-lumos-queue.mts` · 13 ส.ค. 2569)

เจ้าของเคาะ "ล้างทั้งหมด เริ่มใหม่" ก่อนเปิดใช้จริง — คิวค้าง 4,849 แถว = 140 คน
อายุ 8–30 วัน ที่ Lumos รับไปแล้วแต่เงียบตั้งแต่ 4 ส.ค.

```
npx tsx scripts/cancel-stale-lumos-queue.mts --dry     # ค่าเริ่มต้น ดูอย่างเดียว
npx tsx scripts/cancel-stale-lumos-queue.mts --apply   # ลงมือจริง
```

* ขอบเขต: `result is null and last_outcome is null and status <> 'cancelled'`
  — **แถวที่มีผลโทรจริงห้ามแตะ** (เป็นประวัติ) · มี `--older-than-days N` ถ้าอยากล้างเฉพาะของเก่า
* **ไม่ลบแถว** แค่ `status = 'cancelled'` (แพตเทิร์นเดียวกับ `cancelLumosQueueItem`)
  → `SERVE_ELIGIBLE` ไม่รับ `cancelled` จึงไม่ถูกเสิร์ฟอีก · ตัวเลขบนแผงหน้าหลัก
  (`waiting_call` / `delivered_waiting` / `stale_*` ใน `matching-flow-summary.ts`)
  กรองด้วย `status in ('pending','delivered')` อยู่แล้ว จึงตกไปเองทั้งชุด
* เขียนไฟล์สำรอง id + สถานะเดิมก่อนอัปเดตเสมอ (`lumos-queue-cancel-backup-<id>.json`
  ที่ root · **อยู่ใน .gitignore** เพราะมี `person_ref` ของผู้สมัครจริง)

⚠️ **ยกเลิกฝั่งเราไม่ได้เรียกสายคืนจาก Lumos** — แถวที่ `delivered` แล้วอยู่ในระบบเขา
ต้องขอให้ทีมเขาล้างฝั่งเขาด้วย ไม่งั้นเขากลับมาเดินคิวเก่าเมื่อไหร่สายยังออกได้
⚠️ **ตรวจ `followup_state` ก่อนล้างเสมอ** — แถวที่เป็น `retry_scheduled`/`needs_human`
ถูกนับบนแผงโดย**ไม่ดู status** ยกเลิกแล้วเลขจะค้างโชว์ทั้งที่ไม่มีใครโทรอีก
(รอบนี้วัดแล้วเป็น 0 ทุกแถวที่ล้าง จึงไม่เจอปัญหา — รอบหน้าอาจไม่ใช่)

### "เสนอทีละงาน" — หนึ่งเบอร์ = หนึ่งใบขอที่กำลังเสนอ

`TAKE_PENDING_SQL` ใน `lumosDispatch.ts` (export ไว้ให้เทสต์อ่าน) · เทสต์ที่
`tests/api/lumosServeOnePerPhone.test.ts` (13 เคส · mutation 6/6)

เดิมเสิร์ฟตาม `created_at` ล้วน ไม่มีเงื่อนไข "เบอร์นี้มีสายค้างอยู่แล้ว" — คนเดียว
อยู่ในผลแมทได้หลายใบมาก (ข้อมูลจริง card 1805 อยู่ใน 113 ใบขอ) จึงถูกโทรถล่ม
ตอนนี้กัน 2 ชั้นในคิวรีเดียว:

1. **สายกำลังเดิน** — เบอร์นี้มีแถวที่ส่งไปแล้วยังไม่มีผลกลับภายใน 30 นาที → ไม่เสิร์ฟใบอื่น
2. **คะแนน AI ก่อน แล้วค่อยใบที่มาก่อน** — ในบรรดาแถวที่ "ถึงคิว" ของเบอร์เดียวกัน
   เสิร์ฟแถวแรกตาม `(coalesce(match_rank, 2), created_at, id)` แถวเดียว
   (เดิมเรียง `(created_at, id)` ล้วน — ดูหัวข้อ "เรียงคิวตาม tier ของ AI" ข้างล่าง)
3. **สนใจใบไหนแล้ว บังใบอื่น** — ตอบ `confirmed` ไว้กับใบไหน ใบ**อื่น**ของคนคนนั้น
   หยุดเสนอจนพ้น `CONFIRMED_FOCUS_DAYS` (`src/lib/callFollowupPolicy.ts` · **7 วัน —
   ตัวเลขที่เสนอไว้ เจ้าของยังไม่เคาะ**) · ใบเดิมยังเดินต่อได้ (`k.job_ref <> c.job_ref`)

   ปลดได้ 3 ทาง: บันทึกผลใหม่ทับใบนั้น · ยกเลิกแถวนั้น · พ้นเพดานเวลา
   ⚠️ **เพดานเวลาห้ามถอด** — ระบบไม่มีสัญญาณ "ใบ A จบแล้ว" ที่เชื่อถือได้
   (การจองอยู่คนละตาราง · ใบที่เงียบหายไม่มีใครมาปิด) บังแบบไม่มีเพดาน =
   คนที่ตอบว่าสนใจแล้วดีลไม่จบจะหายออกจากระบบถาวรโดยไม่มีใครรู้
   ⚠️ อ่านผลด้วย `coalesce(k.last_outcome, k.result->>'outcome')` — กับดักเดิม
   ที่ทำให้นับหายเงียบ ๆ (ผลที่คนบันทึกเขียนแค่ `last_outcome`)
   ⚠️ ยังไม่ผูกกับ "คนถูกจองแล้ว" (`candidate_proposals`) — ถูกจองแล้วยังบังตามเวลา
   เหมือนเดิม ซึ่งเป็นทิศทางที่ปลอดภัยกว่า (ไม่เสนองานให้คนที่มีงานแล้ว)

⚠️ **ทั้งสองชั้นต้องข้ามช่อง** (reminder ↔ interview) — คนเดียวอยู่ได้ทั้งสองคิว
ใส่ `channel` ลงในตัวกันเมื่อไหร่ = โดนสองสายพร้อมกันจากคนละช่อง (อาการเดิมเป๊ะ)
⚠️ เงื่อนไข "ถึงคิว" ของแถวคู่แข่งต้องเป็นชุดเดียวกับแถวที่พิจารณา (`SERVE_ELIGIBLE`)
ไม่งั้นแถวที่ยังไม่ถึงเวลานัด/ครบเพดานส่งแล้วจะบังใบอื่นค้างถาวร
⚠️ เทียบเป็น row comparison `(rank(e), e.created_at, e.id) < (rank(c), c.created_at, c.id)` —
เทียบ `created_at` อย่างเดียวจะเสมอกันตอนเข้าคิวพร้อมกัน (ซึ่งเป็นเรื่องปกติของหน้านี้)
แล้วจะไม่มีใครถูกเสิร์ฟเลยหรือถูกเสิร์ฟทั้งคู่

วัดกับข้อมูลจริง 11 ส.ค. 2569 (อ่านอย่างเดียว): ช่อง reminder ถึงคิว **2,816 แถว
→ เสิร์ฟจริง 126 แถว = 126 คน** (เฉลี่ยคนละ ~22 ใบขอ) · คิวรี 19 ms (2 ชั้น) →
**101 ms (3 ชั้น)** ยังไม่ต้องมี index · ถ้าคิวโตจนช้าค่อยทำ expression index ของเบอร์

พิสูจน์ชั้นที่ 3 กับข้อมูลจริงโดยไม่เขียนฐาน: แถวที่ตอบ `confirmed` มี 3 แถว (2 คน)
แต่เก่ากว่า 7 วันจึงไม่บังใคร — ลองขยายหน้าต่างเป็น 10 ปีแล้วรันคิวรีเดิม
ได้ 125 (จาก 126) = บังจริง · สองคนนั้นมีใบขออื่นค้างในคิว **73 และ 84 ใบ** ต่อคน

### หน้ากล่องงาน/รายชื่อ/การติดต่อ/นัดหมาย — รอบสิบสาม (14 ส.ค. 2569)

เจ้าของส่งลิสต์ 9 ข้อ + โจทย์ "เก็บไปโทรเองหาไม่เจอ" — ทำครบแล้ว:

* **เก็บไปโทรเอง → แท็บการติดต่อ** — `MyCallsSection` ย้ายไป `RmWorkspace` แท็บ contact
  (Matching = ที่เก็บ · การติดต่อ = ที่ดู+โทร) · hint บอก 2 ส่วนทำงานคนละแบบ
  (① call hold ผูกเบอร์ ② claim บนใบสมัคร)
* **Lead → การติดต่อ** (แทนคลังสำรอง) — server `leadWhere='true'` ที่ default list
  (dialog กล่องงานยังซ่อน Lead) · client `isInRmTab`: kept = claimed_by_me **หรือ** is_lead
  · Lead+declined กลับ candidates · ปุ่ม "ดูคลังสำรอง" ถอดแล้ว (?lead=1 ยังใช้ได้)
* **dialog ติดต่อสำเร็จ/ไม่สำเร็จ** (migration 086 `application_contact_logs`) —
  `api/_lib/applicationContacts.ts` + `/api/application-contacts` (registry **78 route**)
  · `ApplicantContactDialog` เปิดจากปุ่ม view/rule · สำเร็จ→นัดได้ไหม→วัน/ที่/dropdown
  ใบขอเปิด (ค่าเริ่มต้น "ยังไม่ระบุ — หาล่วงหน้า") · ไม่สำเร็จ→เหตุผล master (1×C)
  ⚠️ server เคลียร์ฟิลด์ข้ามฝั่ง (ไม่สำเร็จห้ามมีนัดติดไป ฯลฯ — เทสต์ 7 เคส mutation 3/3)
  ⚠️ สถานะใบตาม "ขั้นที่คนทำ" (เจ้าของเคาะ): นัดได้=converted · ที่เหลือ=contacted
  ⚠️ reason_label/job_label เป็น **snapshot** — master ปิดใช้ได้/ใบขอปิดได้
* **วันนัดมี 2 แหล่ง** — call hold (085 คีย์เบอร์) + contact log (086 คีย์ใบ) ·
  job-applications GET รวมให้แล้ว (**log ชนะ** — เจาะจงใบ + มีสถานที่/ใบขอ)
* **แท็บนัดหมาย + PDF** — หัวสรุป "นัด N จาก M คน" + ปุ่ม window.print ·
  print CSS `:has(.rm-print-area)` ใน index.css โชว์เฉพาะตาราง (เบราว์เซอร์เก่าพิมพ์ทั้งหน้า)
  · คอลัมน์ "นัดที่ไหน" (สถานที่ · ใบขอ/หาล่วงหน้า) · คอลัมน์ "โทรล่าสุด" ในแท็บ contact
  (hold.heldAt ถ้าถืออยู่ · last_call_at ถ้ามีผล)
* **ปุ่มเลือกสถานะใน dialog ผู้สมัครถูกถอด** — สถานะมาจากขั้นที่คนทำ ไม่ใช่กดมั่ว
  · "เก็บไปติดต่อ" เหลือเฉพาะแท็บ "รายชื่อที่สนใจ" (เก็บหลังโทรแล้วสนใจ)
* **RmToolbar (ช่องทาง/ลิงก์/เหตุผล) ถอดจากหน้า RM** — เครื่องมือเหลือที่กล่องงานเท่านั้น
  · ReasonManagerDialog ตายตาม (เปิดได้จาก toolbar เดียว) ถอดด้วย
* **tab bar บอร์ดอยู่ position เดียวกันทุกแท็บ** — ย้ายเหนือ RecruitFunnelPanel
* ปุ่มการ์ดกล่องงาน: "สร้างลิงก์"→"Gen link" · 2 ปุ่มคนละสี (info/violet outline)

### ชุบชีวิตแถวที่ยกเลิก + แผง visual รอบสิบสอง (14 ส.ค. 2569)

**revive cancelled** — `insertQueueItems()` ใน `api/_lib/lumosDispatch.ts`
`on conflict do update ... where status='cancelled'` (ค่าคงที่ `REVIVE_CANCELLED_*`)
⚠️ unique `(channel, job_ref, person_ref)` เต็มตาราง (059) แถว cancelled กินสิทธิ์คู่
(คน, ใบ) อยู่ · `do nothing` เดิม = ส่งซ้ำคนเดิม+ใบเดิมได้ 0 แถวเงียบ ๆ · revive แถวยกเลิก
(reset result/delivery_count/attempt_count/followup_state) แถว active ยังกันซ้ำ ·
มีเส้น fallback ไม่มี match_rank (ฐานยังไม่รัน 084) · เทสต์ `lumosServeOnePerPhone` +2 เคส
⚠️ `listLumosCallStatusForJob` กรอง `status <> 'cancelled'` → UI เลิกนับแถวยกเลิกว่า "ส่งแล้ว"
⚠️ บั๊กคีย์ hold: `MatchingPage` line ~830 อ่าน `holdByRef[String(id)]` (candidateRef ดิบ)
ไม่ใช่ `boardPersonRef(id)` ('card-N') — map คีย์ด้วย candidateRef ดิบ

**ล้างประวัติทดลอง** — `scripts/wipe-call-history.mts` (--dry default · --apply)
ลบจริง 3 ตาราง (`lumos_dispatch_queue` · `candidate_call_holds` · `candidate_call_suppression`)
· backup ทุกคอลัมน์ก่อนลบ (`wipe-backup-*.json` gitignore) · **DELETE ไม่ TRUNCATE**
(id เดินต่อ ไม่งั้น dedupe_key ของ app_notifications ชน) · รันแล้ว 14 ส.ค. คิว 5,307→0

**ตัวกรองปีใบขอ** — `api/_lib/siamrajSqlServerRequests.ts` `OPEN_REQUEST_MIN_DATE`
(env `SIAMRAJ_OPEN_REQUEST_MIN_DATE` default 2024-01-01) · กรองที่ CTE `recent` จุดเดียว
⚠️ **ห้ามแตะ `BASE_SQL_BY_ID`** — เปิดใบเก่ารายใบต้องยังได้ · เทสต์ `siamrajOpenRequestMinDate`

**แผง AI โทร** — `src/components/matching/AiCallFlowPanel.tsx` (2 แถว AI+คน 8 ช่อง) ·
ความหมายช่อง `src/lib/aiCallFlowCells.ts` (เทสต์ 6) · backend `lumos-call-funnel` เพิ่ม
`queuedActive` (ไม่นับ cancelled) · `retryScheduledState` (followup_state) · `byAttempt.cancelled`
· `human` block (candidate_call_holds) · แทน `CallFunnelPanel` **เฉพาะหน้า Matching**
(หน้า Follow ยังใช้ CallFunnelPanel เดิม)

**ชิปกรอง** แทน "ขั้น 1 ฝั่งงาน" — `filterChips` ใน MatchingPage (ทั้งหมด/ด่วน/มีคนแนะนำ/
ไม่มี) · "มีคนแนะนำ" ตั้ง sort `green_desc` · sort ใหม่ใน `matchingListFilter.ts`
(`greenCandidateCount` · เรียงเขียวมากสุด) · matching-list response เพิ่ม `green` ต่อใบ

**หน้าหลัก** — `FollowTodayPanel` (วันนี้ส่งกี่คน + 3 รอบ snapshot: ส่ง/โทรติด/ไม่ติด/
ยกเลิก · ไม่มี "กำลังเดินทาง") แทน MyCallsSection · MyCallsSection ย้ายไปหน้า Matching

⚠️ **"ภาระงานโทรของทีม" ถูกตัด** — `CallTeamBoardPage.tsx` ลบทิ้ง · ปุ่มหัวหน้า (โอน/
เทกอง/คืน AI ทั้งกอง) ไม่มี UI เหลือ · API (`?team=1` · PATCH transfer · DELETE dump) ยังอยู่

### เรียงคิวตาม tier ของ AI (migration 084 · 14 ส.ค. 2569)

เจ้าของเคาะแล้วว่าใช้ **tier ของ AI** (เขียว/เหลือง/แดง) ไม่ใช่ % บนการ์ด
เหตุผล: tier คิดฝั่ง server อยู่แล้วทั้งเส้น auto และเส้นคนติ๊กเลือก (`getStoredBoardMatch`)
ส่วน % คิดฝั่งเบราว์เซอร์ (`scoreCandidatePriority`) ฝั่ง API ไม่มี

* `src/lib/matchRank.ts` — **ความหมายของลำดับอยู่ที่นี่ที่เดียว** (ใช้ทั้ง `src/` และ `api/`)
  `matchRankFromTier()` เขียว 1 · เหลือง 2 · แดง 3 · `MATCH_RANK_UNKNOWN = 2`
  · เทสต์ `tests/api/matchRank.test.ts` (6 เคส)
* `migrations/084_lumos_queue_match_rank.sql` — คอลัมน์ `match_rank smallint null`
  + index `(channel, match_rank, created_at, id) where result is null`
* `api/_lib/lumosDispatch.ts` — `insertQueueItems()` รับ `matchRank` ต่อแถว ·
  `buildTakePendingSql(withRank)` → `TAKE_PENDING_SQL` / `TAKE_PENDING_SQL_NO_RANK`
* `api/_handlers/lumos-dispatch.ts` — เส้นคนติ๊กเลือกหยิบ tier จากผลที่เก็บไว้
  (`stored.result.matches` → map `card_id → tier`) เพราะ pool สดไม่มี tier

⚠️ **`MATCH_RANK_UNKNOWN` = 2 (เท่าเหลือง) ไม่ใช่ท้ายแถว โดยตั้งใจ** — "ไม่มีคะแนน
จาก AI" ไม่ได้แปลว่า "คนไม่ดี" · คิวเก่าก่อน 084 · งานจากหน้า Follow (คนกรอกเอง) ·
คนที่เจ้าหน้าที่เลือกเองจากฝั่ง iRecruit ล้วนไม่มี tier — ดันไปท้ายแถวคือถ่วงงานด่วน
ทันทีที่เปิดใช้โดยไม่มีใครสั่ง · เสมอกันแล้วให้ `created_at` ตัดสินต่อ = พฤติกรรมเดิมเป๊ะ

⚠️ **ห้ามปล่อย `match_rank` ดิบเข้า row comparison** — คอลัมน์เป็น null ได้
row comparison ที่มี NULL ให้ผลเป็น **NULL ไม่ใช่ true** → แถวคู่แข่งไม่ถูกตัด
แล้วชั้นกัน "หนึ่งเบอร์ = หนึ่งใบขอ" หลุด **โดยไม่มี error อะไรเลย**
(เทสต์ regex จับ `match_rank` ที่ไม่ได้ห่อ `coalesce` ไว้แล้ว)

⚠️ **ฐานที่ยังไม่รัน 084 ต้องยังเดินได้ทั้งขาเข้าและขาออก** — ทั้ง `insertQueueItems()`
และ `takePendingLumosItems()` ดัก `42703` แล้วถอยไปคิวรีที่ไม่มีคอลัมน์นี้
(ค่าคงที่เท่ากันสองฝั่ง → เงื่อนไขยุบเหลือการเทียบ `(created_at, id)` แบบเดิมเป๊ะ)
คิวหยุดเดิน = Lumos ไม่ได้งานเลย ซึ่งแย่กว่าเรียงผิด · ถอยแล้ว `logError` ไว้ด้วย
ไม่งั้นเรียงผิดเงียบ ๆ โดยไม่มีใครรู้ว่าลืมรัน migration

⚠️ **ยังไม่ได้วัดผลการเรียงกับข้อมูลจริง** — คิวถูกล้างหมดเมื่อ 13 ส.ค. (ดูหัวข้อ
"ล้างคิวโทรค้าง") แถวที่เหลือทั้ง 5,307 เป็น `cancelled`/`completed`/`failed` และ
`match_rank` เป็น null ทั้งหมด · ตรวจได้แค่ว่าคอลัมน์+index มีจริงบนฐาน และคิวรี
ใหม่ยังคืน 0 แถวเท่าเดิม — **ของจริงต้องวัดซ้ำหลังมีคิวใหม่เข้ามา 18 ส.ค.**

⚠️ **ผลโทรใช้ศัพท์ชุดเดียวกับ Lumos outcome** (`confirmed` / `declined` /
`reschedule_requested` / `no_answer` / `wrong_person`) เพื่อให้ funnel นับ "ผลจากคน"
รวมกับ "ผลจาก AI" เป็นชุดเดียว — เพิ่มค่าใหม่ต้องเป็นค่าที่ Lumos ส่งกลับได้จริงด้วย

### "สนใจ" แยกนัดได้ / ยังนัดไม่ได้ + วันนัดสัมภาษณ์ (migration 085 · 14 ส.ค. 2569)

เจ้าของสั่ง: *"มันต้องมีให้เลือกอะว่าโทรแล้ว สนใจหรือไม่สนใจ แต่สนใจก็ยังมีสนใจแล้ว
นัดได้กับยังนัดไม่ได้อะ"*

* `src/lib/callAppointment.ts` — **ความหมายทั้งชุดอยู่ที่นี่ที่เดียว** (ใช้ทั้ง `src/` และ `api/`)
  `resolveAppointment()` เป็นด่านเดียวที่ตัดสินว่าผลโทรลงฐานหน้าตาแบบไหน
  · เทสต์ `tests/api/callAppointment.test.ts` (14 เคส · mutation 6/6)
* `migrations/085_call_hold_appointment.sql` — ผ่อน CHECK ของ `result_scope`
  เป็น 4 ค่า + คอลัมน์ `appointment_at` + index `(source, candidate_ref, appointment_at)`
* `api/_lib/candidateCallHolds.ts` — `recordCallResult()` คืน `{ok, hold, reason}` แล้ว
  (เดิมคืน `CallHold | null`) · `queryHolds()` = ตัวถอยคอลัมน์เมื่อยังไม่รัน 085
* `api/_lib/applicantCallOutcomes.ts` — `loadAppointmentByPhone()` (แท็บติดตามนัดหมายใช้)
* UI: `MyCallsPage.tsx` (ถังโทรของฉัน) · `CallHoldPanel.tsx` (แผงโทรในหน้า Matching)
  · `RmTable.tsx` คอลัมน์ "วันนัด" **เฉพาะแท็บ `appointments`**

⚠️ **ใช้ `result_scope` ตัวเดิม ไม่เพิ่ม outcome ใหม่** — ศัพท์ outcome ต้องเป็นค่าที่
Lumos ส่งกลับได้จริง (funnel นับผลของคนรวมกับของ AI ด้วยคีย์ชุดนั้น) · scope เป็นฟิลด์
ของเราเอง จึงขยายได้ · แพตเทิร์นเดียวกับ `declined` ที่แยก `job`/`all` มาก่อน

⚠️ **`AppointmentDecision` เป็น object แบน ไม่ใช่ discriminated union** — `tsconfig.app.json`
ตั้ง `strict: false` ฝั่ง `src/` จึง narrow union ด้วย `ok` ไม่เข้า (`decided.reason` ฟ้องว่า
ไม่มีพร็อพนี้ทั้งที่เช็ค `!decided.ok` มาแล้ว) · กับดักเดียวกับ `AcquireCallHoldResult`
· invariant: `ok === (reason === null)` มีเทสต์คุม

⚠️ **"นัดได้เลย" ที่ไม่มีวันนัด = ไม่บันทึกอะไรเลย** ไม่ใช่บันทึกแล้วเดาวันให้
ตรวจทั้งฝั่งฟอร์ม (ก่อนยิง) และฝั่ง API (ก่อนแตะฐาน) ด้วยฟังก์ชันตัวเดียวกัน
· ตรวจในเบราว์เซอร์แล้ว: กดบันทึกโดยไม่ใส่วัน → ขึ้นข้อความ **และไม่มี request ออกเลย**

⚠️ **ปี พ.ศ. หลุดเข้าฐานได้เงียบ ๆ ถ้าไม่กัน** — `2569-08-20` ถูกรูปแบบทุกประการ
แต่ห่างออกไป 543 ปี · `MAX_APPOINTMENT_YEARS_AHEAD = 2` ตัดทิ้งพร้อมบอกเหตุผล

⚠️ **`YYYY-MM-DD` ยึดเที่ยงวันไทย ไม่ใช่เที่ยงคืน** — เหลือกันชน 12 ชม. ทั้งสองทาง
วันที่ที่คนเห็นจึงไม่เลื่อนไปวันข้าง ๆ ตอนแปลงข้ามเขตเวลา · ฝั่งตารางก็ห้าม
`.slice(0,10)` ตรง ๆ (นั่นคือวันฝั่ง UTC) ต้อง `toLocaleDateString('en-CA', {timeZone:'Asia/Bangkok'})`

⚠️ **วันนัดผูกกับ "แถวผลโทร" ไม่ใช่ `candidate_interviews`** — ตารางนั้นผูกด้วย
`candidate_id` (ตาราง `candidates` มี **1 แถว** บนฐานจริง) ส่วนแถวในแท็บติดตามนัดหมาย
คือ **ใบสมัคร** (`public_job_applications`) ที่ **ไม่มีคอลัมน์ `candidate_id`** เลย
ต่อสองอันเข้าหากันไม่ได้จริง ๆ — แผนเดิมใน PLAN-NEXT ที่เขียนว่า "เพิ่ม
`GET /api/candidate-interviews?all=1`" จึงใช้ไม่ได้ ต่อไปก็ได้รายการที่จับคู่กับแถว
บนหน้าจอไม่ได้ · จับคู่ด้วย **เบอร์ E.164** แทน (กติกาเดียวกับล็อกโทร/ผลโทร)

⚠️ **ผลจาก AI ไม่มี scope** — Lumos ตอบแค่ `confirmed` ไม่รู้ว่านัดได้ไหม
`resolveAppointment` จึงคืน `null` **ไม่ใช่ `unscheduled`** · เดาให้เมื่อไหร่จะไปโผล่
ในรายงานว่า "โทรแล้วนัดไม่ได้" ทั้งที่ไม่มีใครถามคำถามนั้น (คนกดจองต่อจากกล่อง
"สนใจ" บนหน้าหลักได้อยู่แล้ว — ดูงานรอบ `e8988c0`)

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

⚠️ **(อัปเดต 11 ส.ค. 2569 รอบหก — `canSeeCallDesk` ไม่มีแล้ว)** หน้าเคยถูกปิดทั้งหน้า
(10 ส.ค.) แล้วเจ้าของกลับคำ: เปิดใหม่แบบ **ทุกคนเห็นถังตัวเอง** ไม่มี gate ระดับหน้าอีก
· ที่เหลือคือ `canSeeTeamBoard = hasPermission('supervisor')` ใน `MyCallsPage`
คุมเฉพาะบอร์ดทีม (สิทธิ์จริงอยู่ API: `?team=1` → 403) · เมนูอยู่ AppNavDrawer
กลุ่ม Matching ("โทรของฉัน") · ปุ่ม "รับไปตาม" ใน `CallFunnelPanel` รับแล้วเป็นลิงก์
ไปหน้านี้ · แหล่งงานเข้าถัง: ปุ่ม "เก็บไปโทรเอง" (MatchingPage) · "ดึงเข้าถังโทร"
(RmWorkspace มุมมองรายชื่อบนบอร์ด · source 'application') · "รับไปตาม" (Follow)

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

### นโยบายการโทร (migration 073) — ⚠️ **หน้าจอตั้งค่าถูกถอดออกแล้ว 10 ส.ค. 2569**

เจ้าของสั่ง "นโยบายการโทร เอาออก" — ถอด **หน้าจอ + ทางแก้ค่า** ทิ้งทั้งชุด:
`src/components/follow/CallPolicyPanel.tsx` · `src/lib/callFollowupPolicyApi.ts` ·
`api/_handlers/lumos-call-policy.ts` (+ route ใน registry) ·
`allowedCallWindow()`/`withAllowedCallWindow()` ใน `src/lib/callFollowupPolicy.ts`
(สองตัวหลังมีไว้แปลงมุมคนใช้ ↔ มุมนโยบายให้หน้าจอเท่านั้น — ถ้าจะเอาหน้าจอกลับมา
ดูของเดิมได้ที่ commit ก่อนหน้า)

⚠️ **ค่าที่อยู่ในตารางยังคุมการโทรจริงอยู่เหมือนเดิมทุกอย่าง** — เพดาน 3 ครั้ง ·
เว้น 24 ชม. · ห้ามโทร 20:00–08:00 ยังทำงานผ่าน `getCallFollowupPolicy()` ตามเดิม
ที่หายไปคือ "ทางแก้ค่าจากหน้าเว็บ" เท่านั้น · จะเปลี่ยนค่าต้องแก้ที่แถวใน
`app_call_followup_policy` ตรง ๆ หรือแก้ค่าเริ่มต้นใน `DEFAULT_CALL_FOLLOWUP_POLICY`
เทสต์ของที่เก็บยังอยู่ที่ `tests/api/callFollowupPolicyStore.test.ts` (7 เคส)

ประวัติเดิม (ไว้อ่านตอนจะเอากลับมา): เจ้าของเคยขอตั้งเองว่า "คนนึงจะโทรกี่ครั้ง
และโทรช่วงเวลากี่โมงบ้าง"

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

## "ทุกใบต้องเหมือนกัน" — โครงการ์ด/แถบปุ่มที่คงที่ (13 ส.ค. 2569 รอบเก้า)

เจ้าของสั่ง: *"ทุกใบก็ต้องเหมือนกันสิกันงง · Format ก็ทำให้มันเท่ากัน ไม่ใช่ข้อมูล
ไม่เท่ากันก็ขยับเอง คงมันไว้ให้ตรงกัน"* — หลักที่ใช้ตัดสินทุกจุด:
**ทุกแถวเป็น "ช่องที่จองไว้" ไม่ใช่ "ช่องที่งอกตามข้อมูล"**

* `src/lib/lumosStatCells.ts` — ช่องตัวเลขผลโทร **6 ช่องเสมอทุกกรณี**
  (`lumosFixedStatCells` คืน 6 ตัวแม้ `s` เป็น undefined) · ช่องพิเศษ
  (รออนุมัติ/ขอเลื่อน/ต้องคนตาม) ออกมาเป็นชิปผ่าน `lumosExtraStatChips` ·
  `lumosProgressChip` = ที่ไปของแถบ ติดต่อ/จอง/ลงงาน เดิม
  เทสต์ `tests/api/lumosStatCells.test.ts` (13 เคส) **บังคับว่าต้องคืน 6 ตัวเสมอ**
* `src/lib/lumosSendActions.ts` — สถานะ 4 ปุ่มส่งโทร · invariant
  `disabled === (reason !== null)` (จะปิดปุ่มต้องมีเหตุผลให้ผู้ใช้อ่านเสมอ)
  เทสต์ `tests/api/lumosSendActions.test.ts` (6 เคส)
* `src/lib/displayFallback.ts` — `EM_DASH` + `dashIfEmpty()`
* `src/lib/applicantDisplay.ts` — `applicantFactLine()` / `applicantAddressLine()`
* ผู้ใช้: `MatchingPage` (การ์ดใบขอ + drawer) · `LumosPanels` ·
  `JobApplicantsDialog` · `JobBoardView` · `RmTable`

⚠️ **จอง "ที่ยืน" ด้วย element จริงที่มองไม่เห็น ดีกว่า `min-h` ค่าคงที่**
วัดเจอว่า `min-h-[22px]` ที่เดาไว้ต่างจากชิปจริง 23px อยู่ 1px — ใช้ชิป/ปุ่มตัวเดียวกัน
`invisible w-0 overflow-hidden px-0` แล้วความสูงเดินตามเองเมื่อขนาดชิปเปลี่ยน
**spacer ต้องมี text content** ไม่งั้นไม่มี line-box (วัดได้ 6.5px แทน 23px)

⚠️ **`EM_DASH` ห้ามตั้งชื่อ `DASH`** — ชนกับ token พื้นผิว dashboard ใน `designTokens.ts`
⚠️ **`dashIfEmpty` ห้ามเป็น `v || EM_DASH`** — ฟิลด์ตัวเลขที่เป็น 0 คือคำตอบจริง
(ต่างจาก `applicantFactLine` ที่ อายุ/นน./สส. เป็น 0 = ข้อมูลเสีย โดยตั้งใจ · มีเทสต์ล็อกทั้งคู่)
⚠️ **ป้ายปุ่มที่ยาวไม่เท่ากันบีบ layout ข้าง ๆ** — "ดูคนของเรา (0)" กับ
"AI กำลังคิดที่หลังบ้าน…" ทำให้กล่องซ้ายกว้างคนละขนาด เลขในแถบไม่ตรงคอลัมน์ข้ามใบ
(วัดได้ 544.9–549.1px) · ล็อกความกว้างปุ่มแก้ได้
⚠️ **`truncate` ใน `<td>` ต้องมีกล่องกว้างแน่นอน** — `inline-flex` ใช้ไม่ได้ ต้อง `flex` + `max-w`
⚠️ **`beginSendFlow` รับ `boardIds` ได้** เพราะ "ส่งทั้งหมดที่แมท" เพิ่งเรียก setState
ใน tick เดียวกัน อ่านจาก state จะได้ค่าเก่าแล้วข้าม popup "แมทหลายงาน"

### แถบตัวเลขการโทร "ต่อใบขอ" (ข้างการ์ดในหน้า Matching)

* `api/_lib/lumosDispatch.ts` → `loadLumosJobCallSummaryMap()` — คิวรีเดียว group by `job_ref`
  · `api/_lib/callBatchStore.ts` → `countPendingApprovalByJob()` — ชุดที่ยังไม่ปล่อย (คนละตาราง)
* `src/components/matching/LumosPanels.tsx` → `LumosJobSummaryStats` (9 ช่อง)
  · `src/lib/matchingCardAction.ts` → ชิป "ทำต่อเลย" · `tests/api/lumosJobCallSummary.test.ts` (10 เคส)

ลำดับช่องตามที่งานเดินจริง: **รออนุมัติ → ส่ง → โทรแล้ว → เหลือ → โอเค / ไม่ไป / ไม่รับ /
ขอเลื่อน / ต้องคนตาม** · สามช่อง (รออนุมัติ · ขอเลื่อน · ต้องคนตาม) **โผล่เฉพาะตอนมีค่า**
ไม่งั้นแทบทุกใบจะได้แถบที่เป็น 0 อยู่ 3 ช่อง กวาดตาแล้วหาของจริงไม่เจอ

⚠️ **อ่าน outcome ด้วย `coalesce(last_outcome, result->>'outcome')`** — กับดักเดียวกับ funnel
หน้า Follow แต่ตรงนี้เคยตกหล่น: ผลที่ **คน** บันทึกเขียนแค่ `last_outcome` ไม่ได้เขียน `result`
และตอนตั้งโทรซ้ำก็ **ล้าง `result` ทิ้ง** → อ่าน `result` อย่างเดียวจะนับหายแบบเงียบ ๆ

⚠️ **จุดกรองใน `api/_handlers/matching-list.ts` ต้องเช็ค `pendingApproval` ด้วย**
เดิมเป็น `entry.sent > 0` อย่างเดียว ใบที่เพิ่งตั้งชุดรออนุมัติ (`sent` = 0) จะไม่ขึ้นแถบเลย
ทั้งที่มีคนรอให้กดอนุมัติ — และ `loadLumosJobCallSummaryMap()` ก็ต้อง**เติมแถวให้ใบที่มีแต่ชุด
ยังไม่เคยเข้าคิว** ด้วย (สองจุดนี้ต้องแก้คู่กันเสมอ ไม่งั้นเลขหายเหมือนเดิม)

⚠️ `job_id` ของชุด กับ `job_ref` ของคิว เป็นรหัสชุดเดียวกัน (`siamraj-sql:XXX`) — ตรวจกับฐานจริงแล้ว
ถ้าวันไหนสองฝั่งใช้รูปแบบต่างกัน เลข "รออนุมัติ" จะเงียบ ๆ เป็น 0 ทุกใบ

⚠️ อ่านตารางชุดล้มด้วยเหตุที่ไม่ใช่ 42P01 **ต้องโยนต่อ ห้ามกลืนเป็น 0** — 0 ที่แปลว่า
"เช็คไม่ได้" อันตรายกว่าไม่มีตัวเลข (มีเทสต์คุม + mutation test แล้ว 10/10)

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
  ⚠️ **ใช้ที่ `src/pages/follow/FollowPage.tsx` ที่เดียว** → `defaultSource="follow" lockSource`
  (เห็นแค่ของหน้าตัวเอง **ไม่มีปุ่มสลับต้นทาง**) · `lockSource` ต้องซ่อนทั้งปุ่มสลับ
  **และ** ข้อความ "กดปุ่มด้านบนเพื่อดูต้นทางอื่น" ไม่งั้นชี้ทางไปหาปุ่มที่ไม่มีอยู่
  · เคยเอาไปเสียบหน้าหลักแบบ `defaultSource="all"` (กดสลับได้) แล้วเจ้าของสั่งเอาออก
    ในวันเดียวกัน (10 ส.ค. 2569) — **ตอนนี้จึงไม่มีที่ไหนดูยอดโทรของ board/irecruit/all ได้**
    prop ยังรองรับอยู่ ถ้าจะเปิดที่ไหนใหม่แค่ส่ง prop
  · ถอดแถบเขียว "ยังไม่มีใครตกถังต้องคนตาม" ออกแล้ว (พูดซ้ำกับช่อง "ต้องคนตาม 0" ด้านบน)

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

## การ implement อย่างปลอดภัย / feature flag

แก้เอกสาร:

* .claude/skills/request-control-tower-advisor/references/06-safe-implementation-rules.md
* .cursor/rules/request-control-tower.mdc

Future code:

* คอนฟิก feature flag
* ตรรกะ routing/render ของแดชบอร์ด

## แพตเทิร์น prompt สำหรับ Cursor

แก้ที่:

* .claude/skills/request-control-tower-advisor/references/07-cursor-prompt-patterns.md

## ตัวเชื่อม skill ของโปรเจกต์ฝั่ง Codex

แก้ที่:

* .codex/skills/jarvis-request-control-tower/SKILL.md
* .codex/skills/jarvis-request-control-tower/references/01-project-overview.md
* .codex/skills/jarvis-request-control-tower/references/02-code-map.md
* .codex/skills/jarvis-request-control-tower/references/03-workflow-and-validation.md

กติกา:
ให้ `.claude/skills/request-control-tower-advisor/` เป็นแหล่งความจริงเดียวของโดเมน
skill ฝั่ง `.codex` สรุปโครง repo และชี้ทาง Codex มาที่ references ฝั่ง `.claude` ได้
แต่ห้ามสร้างกติกา metric ที่ขัดกันเอง

## เช็คลิสต์ Redteam / SWOT / pre-mortem

แก้ที่:

* .claude/skills/request-control-tower-advisor/references/08-redteam-premortem-checklist.md

## การแก้การแมป SQL

แก้เอกสารก่อน:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* api/_lib/siamrajRequestControlAdapter.ts
* api/_handlers/request-control-dashboard.ts

กติกา:
ถ้ามีไฟล์ภายในเพิ่มใหม่ภายหลัง ต้องอัปเดตแผนที่ฉบับนี้ด้วย

## โค้ดที่เกี่ยวข้องที่มีอยู่แล้ว (อยู่ใน repo แล้ว — ห้ามเขียนทับสุ่มสี่สุ่มห้า)

เส้นทางโค้ด Control Tower / analytics ที่มีอยู่ (อ่านก่อนทำงาน parallel layer):

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

## คำขอ Scrap & Content จากหน้า Matching

* `migrations/045_job_posting_requests.sql` — ตารางคำขอตัวแรก
* `migrations/050_job_posting_request_type.sql` — ตัวแยกประเภท Content/Scraping แบบเข้ากันได้ย้อนหลัง
* `api/_lib/jobPostingRequests.ts` — adapter ของคำขอ + การ validate
* `api/_handlers/matching-job-postings.ts` — API อ่าน/เขียน
* `src/lib/jobPostingRequestsApi.ts` — adapter เรียก API ฝั่งหน้าเว็บ
* `src/pages/matching/MatchingPage.tsx` — request-type selection at source
* `src/pages/matching/JobPostingsPage.tsx` — หน้าติดตามคำขอ
* `tests/api/jobPostingRequests.test.ts` — เทสต์ contract ของประเภท/สถานะคำขอ

## พยากรณ์ความต้องการ (ใบขอเข้าใหม่ตามประเภท — แทนที่ตาราง Life Cycle เมื่อ flag เปิด)

* `api/_handlers/request-control-forecast.ts` — API อ่านอย่างเดียว: รวมยอด 3 ปี + YTD รายเดือน × วงจรชีวิต (net = เข้าใหม่ − ยกเลิก) · cache ในหน่วยความจำรายปี
* `src/lib/dashboard/request-control/demandForecast.ts` — คำนวณพยากรณ์แบบ pure: เฉลี่ย/ต่ำสุด/สูงสุด รายเดือนรายกลุ่ม + expectedMore ของเดือนปัจจุบัน
* `src/lib/dashboard/request-control/demandForecastApi.ts` — adapter ดึงข้อมูลฝั่งหน้าเว็บ
* `src/components/dashboard/request-control/DemandForecastPanel.tsx` — แผงบนแดชบอร์ด
* `src/components/dashboard/analytics/DashboardChartSection.tsx` — สวิตช์ flag (VITE_REQUEST_CONTROL_FORECAST_ENABLED !== 'false' · ปิด flag = ตาราง Life Cycle เดิม)
* `tests/api/demandForecast.test.ts` — aggregation + forecast contract tests

## แบ่งหน้าลิสต์ Matching ฝั่ง server (zero-drift)

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

## ใบสมัครสาธารณะจากหน้า /apply

* `migrations/048_public_job_applications.sql` — ตารางใบสมัคร
* `migrations/049_public_job_applications_structured.sql` — ฟิลด์แบบมีโครงสร้าง (คำนำหน้า/ชื่อ/อายุ/เพศ/ที่อยู่)
* `api/_lib/publicApplications.ts` — การ validate + normalize เบอร์ไทย/อายุ
* `api/_handlers/public/apply.ts` — endpoint POST สาธารณะ (มี rate limit)
* `src/components/jobs/PublicApplyDialog.tsx` — dialog ฟอร์มใบสมัคร
* `src/components/jobs/JobBoardView.tsx` — ปุ่มสมัครงานบนบอร์ด /apply
* `tests/api/publicApply.test.ts` — เทสต์ contract ของการ validate

## งานสรรหา (RM) — 3 แท็บครอบใบสมัครจริง (11 ส.ค. 2569)

หน้า `/recruit/rm` เอาโครง 3 แท็บของระบบเดิม (iRecruit `recruit_register`) มาครอบ
**ตารางใบสมัครที่มีอยู่** (`public_job_applications`) — ไม่มีข้อมูลชุดใหม่
รายละเอียด + งานที่เหลือ: `docs/RM-HANDOFF.md`

* `src/lib/recruitRm.ts` — นิยามแท็บ (`RM_TAB_STATUSES`) · ตัวกรอง · `applicationJobLabel()`
* `src/lib/recruitRmMasters.ts` — ค่าคัดลอกจากระบบเดิม (เจาะจง 19 · ใบขับขี่ 6 · วุฒิ 8)
  + `normalizeRmPhone()` / `cleanRmLicenseTypes()` — **ใช้ทั้ง `src/` และ `api/`**
* `src/pages/recruit/RecruitRmPage.tsx` · `src/components/recruit-rm/*` (5 ไฟล์)
* `migrations/074_rm_link_and_manual_applicant.sql` — คอลัมน์ใหม่ของประกาศ + ใบสมัคร
* `tests/api/recruitRm.test.ts` · `tests/api/recruitRmMasters.test.ts`

⚠️ **กับดักที่ต้องรู้ก่อนแตะ**

1. **074 ยังไม่รันบนฐาน** — `LIST_COLUMNS_LEGACY` (`api/_handlers/job-applications.ts`)
   และ `POSTING_COLUMNS_LEGACY` (`api/_lib/recruitPostings.ts`) **ห้ามลบ**
   จนแน่ใจว่าทุก env รัน 074 · ฐาน local = production → select คอลัมน์ที่ยังไม่มี
   ทำให้**บอร์ดรับสมัครพังทั้งหน้า** (แพตเทิร์นเดียวกับ `JOB_SUMMARY_SQL_LEGACY`)
2. **POST `/api/job-applications`** = เจ้าหน้าที่คีย์ใบสมัครเอง · ลงตารางเดียวกับใบจากลิงก์
   · `created_by_name` แยกว่าใครคีย์ · ยังไม่ migrate → คืน **503 ไม่บันทึกแบบทิ้งฟิลด์**
3. **ใบที่คีย์เองไม่มี `job_id`** → คนที่ถูกล็อก BU มองไม่เห็นใบตัวเอง (กติกาเดิมของ GET)
   จึงกันให้เฉพาะคนที่เห็นทุก BU คีย์ได้
4. **จังหวัดของใบขอ**ไม่ใช่ฟิลด์เดี่ยว — ใช้ `inferProvinceFromAddress()`
   · **ตำแหน่งงาน** อยู่ที่ `staff_title_name` ไม่ใช่ `position`
5. **`RM_TOOLBAR_KEYS` คือแหล่งเดียวของแถบปุ่ม** — ใช้ทั้งบอร์ด (`RecruitBoardTools`)
   และหน้า RM (`RmToolbar`) · เจ้าของสั่งเอาปุ่ม "ตำแหน่งงาน" ออกแล้ว
6. **ปุ่ม "สร้างลิงก์" ที่ hero ต้องต่อท้าย "(ประกาศลอย)"** — การ์ดใบขอทุกใบมีปุ่ม
   "สร้างลิงก์" ของตัวเองอยู่แล้ว ชื่อซ้ำทำคนละอย่างคือปัญหาที่เจ้าของเคยทัก

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

## Master สถานะทำงานของใบขอ (Admin แก้ได้เอง)

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

## งานสรรหา (RM) — ช่องทาง · เหตุผล · แผงภาพรวม (11 ส.ค. 2569 รอบสี่)

### ช่องทางรับสมัคร — 4,388 ช่องในฐานจริง

* `migrations/075_recruit_channels_source.sql` — `source`/`source_id` + unique `(source, source_id)`
  · **ผ่อน** `recruit_channels_parent_name_idx` ให้คุมเฉพาะแถวที่คนคีย์เอง (`source is null`)
* `scripts/import-recruit-channels.mts` — upsert ตาม id ต้นทาง **ยกซ้ำได้** (พิสูจน์แล้ว 4,388 → 4,388)
  ย้อนกลับ: `delete from recruit_channels where source = 'irecruit'`
* `api/_lib/recruitPostings.ts` — `searchRecruitChannels()` · `listRecruitChannelRoots()`
  · `listRecruitChannelChildren()` · เพดาน `RECRUIT_CHANNEL_PAGE_MAX` = 200
* `src/components/shared/ChannelPicker.tsx` — ใช้ร่วมทั้งสร้างลิงก์และเพิ่มผู้สมัคร
* เทสต์ `tests/api/recruitChannelSearch.test.ts` (9 เคส · mutation 6/6)

⚠️ **ห้ามเรียก `listRecruitChannels()` (ทรีเต็ม) จากหน้าเว็บ** — วัดจริง **515 KB**
ต่อการเปิด dialog หนึ่งครั้ง · `?roots=1` = 4.5 KB (เล็กลง 115 เท่า)
⚠️ **ชื่อช่องทางซ้ำกันได้จริง** — พ่อชื่อ "Facebook Group" มี 2 แถว · ลูกชื่อซ้ำในพ่อเดียวกัน
53 คู่ · อย่าใช้ชื่อเป็นคีย์ ใช้ `source_id`
⚠️ **`source_id` ของลูกใส่ prefix `sub:`** — id พ่อ (12–98) กับ id ลูกทับช่วงกันจริง

### เหตุผล (ปุ่ม "เหตุผล")

* `migrations/076_recruit_reasons.sql` · `api/_lib/recruitReasons.ts`
  · `api/_handlers/recruit-reasons.ts` (`/api/recruit/reasons`)
* `src/lib/recruitReasons.ts` (จัดกลุ่ม) · `src/lib/recruitRmMasters.ts` (ป้ายไทยของรหัส)
* `src/components/recruit-rm/ReasonManagerDialog.tsx` — ใช้ทั้งบอร์ดและหน้า RM
* `scripts/import-recruit-reasons.mts` — เอาเฉพาะ `owner='RM'` (67 จาก 85)
* เทสต์ `tests/api/recruitReasons.test.ts` (10 เคส · mutation 6/6)

⚠️ **รหัสเก็บตามระบบเดิมเป๊ะ** `'1'/'2'/'3'` (ขั้นตอน) และ `'A'/'C'` (ผล) — ห้ามแปลงเป็น
คำอังกฤษ เหตุผลเดียวกับ `monix` ตัวเล็ก · มีเทสต์กัน
⚠️ **DELETE = ปิดการใช้งาน ไม่ลบทิ้ง** — เหตุผลถูกอ้างจากผลติดต่อย้อนหลัง

### แผงภาพรวมงานสรรหา (9 ตัวเลข)

* `src/lib/recruitFunnel.ts` — **pure ล้วน** · แมป "เหตุผล → ถัง" + ตัวหาร + `funnelPercent()`
* `api/_lib/recruitFunnelSql.ts` — คิวรี iRecruit (อ่านอย่างเดียว) · `api/_handlers/recruit-funnel.ts`
* `src/components/recruit-rm/RecruitFunnelPanel.tsx` — วางบนหน้า `/recruit/rm`
* เทสต์ `tests/api/recruitFunnel.test.ts` (21 เคส · mutation 11/11)

⚠️⚠️ **สองกับดักที่ทำให้เลข "ถูกแต่ตอบผิดคำถาม" — เจอบนหน้าจอตอนตรวจงาน:**

1. **นับแถว ≠ นับหัวคน** — ผลติดต่อ 117,158 แถว = 115,714 หัวคน · นัดหมาย 72,637 = 67,048
   ตารางผลทุกตัวมี `seq` (คนเดียวหลายรอบ) → ต้อง
   `ROW_NUMBER() PARTITION BY register_id ORDER BY seq DESC, id DESC` แล้วเอา `rn = 1`
   ไม่งั้นได้ "นัดสำเร็จ + นัดไม่สำเร็จ = 111.6%"
2. **ตัวหารเป็นทอด ๆ ไม่จริง** — `recruit_logs_call` (108,084 คน) **ไม่ครอบ**
   คนที่มีผลติดต่อ (115,714 คน) → ได้ "โทรไปแล้ว 304.7% ของกรอกมา"
   **ทุกช่องหารด้วย "กรอกมา" ช่องเดียว** ซึ่งเป็นประชากรเดียวที่ครอบทุกคนจริง

⚠️ **"กรอกมา" ต้องรวม Lead** — Lead ถูกตีตราทีหลัง (`lead_at` > `created_at` · 77% ของทั้งหมด)
ตัดออกจากตัวตั้งต้นแล้วขั้นถัดไปเกิน 100% · โชว์จำนวน Lead แยกไว้แทน
⚠️ **คู่สถานะต้องครอบทุกแถว** — ใช้ `<> 'A'` และ `NOT IN ('A','C')` ไม่ใช่ `= 'C'`/`= 'W'`
ข้อมูลจริงมีสถานะ `R` โผล่มา 2 แถวใน `recruit_follow_appointment`
⚠️ **การแบ่งถัง "ไม่รับสาย" / "ติดต่อไม่ได้" อยู่ที่ `recruitFunnel.ts` ไม่ใช่ใน SQL** —
เจ้าของแก้เกณฑ์ได้โดยไม่ต้องแตะคิวรี · มีเทสต์คุมว่าสามถังรวมกันเท่ายอดจริงเสมอ

## เลนสรรหา — "หาคนเพิ่ม + ส่ง AI โทร" ข้าม 3 แหล่ง (R2b · 16 ส.ค. 2569)

**นิยามถาวรที่เจ้าของสั่งให้จำ:** สรรหา = จัดการ **คนที่ยังไม่สมัคร** (Lumos โทรก่อน
แล้วคนตามเก็บใบสมัคร) · คัดสรร = จัดการ **คนที่สมัครแล้ว** (คนโทรก่อน หมดคนค่อยกดหาเพิ่ม)

| ไฟล์ | หน้าที่ |
|---|---|
| `api/_lib/recruitLanePool.ts` | **pure ล้วน** — รูปคนกลางของ 3 แหล่ง + mapper + ป้ายบอกแหล่ง + ตัดคนซ้ำข้ามแหล่ง |
| `api/_lib/soRecruitLeadsSql.ts` | กองใบ "สนใจ" ของฐานใหม่ที่ยังว่าง (pg) |
| `api/_lib/recruitLaneMatcher.ts` | โหลด 3 แหล่งพร้อมกัน → ตัดซ้ำ/ตัดคนได้ใบสมัครแล้ว → AI จัดอันดับ |
| `api/_handlers/matching-recruit-lane.ts` | `/api/matching/recruit-lane?jobId=..&send=1` (registry **82 route**) |
| `src/lib/recruitLaneApi.ts` | ตัวเรียก API + ข้อความสรุปทั้งหมด (pure) |
| `src/components/jobs/RecruitLaneDialog.tsx` | กล่องผลค้น — ชิป tier + **ชิปบอกแหล่งทุกคน** |
| `scripts/probe-recruit-lane-pool.mjs` | ตรวจกองกับฐานจริง อ่านอย่างเดียว ไม่แตะคิว |

แก้ของเดิม: `boardCandidatesSql.ts` (+`boardChecklistColumnId()` +`excludeInformed`) ·
`applicationRotationSql.ts` (+`phonesContactedAnyJob`) · `lumosDispatch.ts`
(+`buildRecruitLaneInterviewPayload` +`enqueueLumosInterviewForRecruitLane`) ·
`rbac.ts` (+resource `matching-recruit-lane`) · `JobBoardView.tsx` (ปุ่มบนการ์ด — lazy dialog)

เทสต์: `tests/api/recruitLanePool.test.ts` (12) · `tests/api/recruitLaneMatcher.test.ts` (20)
· `tests/api/recruitLaneDispatch.test.ts` (13) · `src/lib/recruitLaneApi.test.ts` (12)
mutation 3/3 (สลับลำดับแหล่งตอนตัดซ้ำ · ตัดข้อยกเว้น Checklist · ปล่อยเลขนอกช่วงจาก AI)

⚠️ **person_ref ต้องคง prefix เดิม** (`ir-` / `app-` / `card-`) — `splitPersonRef()` ใน
`callFollowup.ts` แปลงกลับเป็น source ตอนคนกด "รับไปตามต่อ" · ตั้ง prefix ใหม่ = ปุ่มนั้นพังเงียบ
⚠️ **AI ต้องอ้างคนด้วยเลขลำดับ ไม่ใช่ id ของฐาน** — id ข้ามฐานชนกันได้ (iRecruit id 1234
กับ card_id 1234 คนละคน) แล้ว join กลับผิดตัวเงียบ ๆ → โทรผิดคน
⚠️ **ตัดคนซ้ำข้ามแหล่งด้วยเบอร์** — คิวกันซ้ำที่ `person_ref` ช่วยไม่ได้ (คนละ ref)
ลำดับที่เก็บไว้: Checklist > ฐานใหม่ > iRecruit (ใกล้ได้ใบสมัครที่สุดชนะ)
⚠️ **ERP อ่านไม่ได้ = ไม่ตัดใครแล้วติดธง** (`board_check_unavailable`) — "เช็คไม่ได้"
ไม่เท่ากับ "ไม่มีใครบนบอร์ด" · ตัดมั่วแล้วกองหายทั้งกอง
⚠️ **แหล่งที่อ่านไม่ได้ต้องขึ้นคำเตือน ห้ามโชว์ 0** — 0 = ไม่มีคน คนละเรื่องกับฐานล่ม
⚠️ **ถัง Checklist ต้องตัดคน `is_inform='Y'`** — วัดจริง 16 ส.ค.: 1,102 คนในถัง
เป็นคนแจ้งเข้าแล้ว 512 เหลือกองจริง 590

วัดกับฐานจริง 16 ส.ค. (อ่านอย่างเดียว): iRecruit 800 (ชนเพดาน) · ฐานใหม่ 0 · Checklist 590
· ตัดซ้ำข้ามแหล่ง 37 · ตัดคนได้ใบสมัครแล้ว 11 → **กองสุดท้าย 1,342 คน** (โทรได้จริง 1,247)

## หน้า Follow — เลือกชื่อจากบอร์ด ERP แทนการคีย์เอง (F5b · 16 ส.ค. 2569)

เดิมหน้า Follow ต้องคีย์ชื่อ+เบอร์เอง — พิมพ์ผิด = โทรผิดคน · ปุ่มนี้เป็นทางลัด
**คีย์เองยังทำได้เหมือนเดิม** (ไม่ใช่ทางบังคับ)

| ไฟล์ | หน้าที่ |
|---|---|
| `api/_handlers/matching-board-candidates.ts` | โหมดใหม่ `?picker=1` — 6 ถัง (ไม่มี Checklist) · ตัด `is_inform='Y'` · เอาเฉพาะคนมีเบอร์ |
| `src/lib/boardPickerApi.ts` | โหลด/ค้น/ถอดคำนำหน้า — **pure ทั้งหมดยกเว้นตัวโหลด** |
| `src/components/follow/BoardPersonPicker.tsx` | กล่องเลือกชื่อ (ค้นฝั่ง client แพตเทิร์นหน้า "ผู้สมัคร") |
| `src/pages/follow/FollowPage.tsx` | ปุ่ม "เลือกชื่อจากบอร์ด" เหนือช่องชื่อ + ชิปบอกว่าเลือกมาจากถังไหน |

เทสต์: `src/lib/boardPickerApi.test.ts` (11) · `tests/api/boardPickerScope.test.ts` (7)
mutation 2/2 (สลับลำดับคำนำหน้าให้ "นาง" ชนะ "นางสาว" · เปลี่ยนค้นหลายคำจาก AND เป็น OR)

⚠️ **ถอดคำนำหน้าออกจากชื่อที่บอร์ดเก็บ** — บอร์ดเก็บ "นายสมชาย" ไว้ในช่อง `fname`
ถ้าไม่ถอด ฟอร์มจะได้ "นายนายสมชาย" · ลำดับตรวจต้อง **ยาวก่อนสั้น** ("นางสาว" ต้องชนะ "นาง"
ไม่งั้นได้ prefix "นาง" + ชื่อ "สาวมาลี")
⚠️ **`?picker=1` ต้องไม่ไปแตะโหมด `?people=1` เดิม** — หน้า "ผู้สมัคร" ยังต้องเห็นคน
ที่แจ้งเข้าแล้วครบเหมือนเดิม (มีเทสต์คุมทั้งสองฝั่ง)
⚠️ ค้นฝั่ง client ตัดผลไว้ที่ 100 แถว — ต้องมีตัวนับ "แสดง N จาก M" ไม่งั้นคนเข้าใจว่า
บอร์ดมีแค่ 100 คน

วัดบนหน้าจอจริง 16 ส.ค. (อ่านอย่างเดียว): 563 คนใน 6 ถัง (In process · Re Use · To do ·
Done · Drop · ไม่มีงาน) ทุกคนมีเบอร์ · ค้น "ขับรถ ชลบุรี" เหลือ 41 · กดแล้วชื่อ/เบอร์
ลงช่องถูกต้อง · ไม่มี request ที่ไม่ใช่ GET

## เก็บตกไฟล์รอบสิบสี่–สิบหก (14–16 ส.ค. 2569) — S1-S9 · A · R · F

รอบนั้นทำ 3 ก้อนใหญ่ (ระบบใบสมัคร S1-S9 · เส้นแบ่งสรรหา→คัดสรร A · ตารางโทร Follow F)
แต่ยังไม่ได้ลงแผนที่ไฟล์ — เก็บตกไว้ที่นี่

### Dashboard "ศูนย์คุมงานสรรหา" (S5 · 15 ส.ค.)

| ไฟล์ | หน้าที่ |
|---|---|
| `api/_lib/applicantOverviewSql.ts` | **นิยามตัวเลขที่เดียว** — ถังไม่ทับกัน + `bucketCondition()` ใช้ทั้งตัวนับและ drill-down |
| `api/_handlers/recruit-rm-overview.ts` | `/api/recruit-rm-overview` (+`?bucket=` drill-down) |
| `src/lib/recruitRmOverviewApi.ts` | ตัวเรียกฝั่งหน้าเว็บ |
| `src/components/recruit-rm/RecruitControlPanel.tsx` | แผงบนหน้ารายชื่อ · ทางถอย `?panel=classic` (RecruitFunnelPanel เดิม) |

⚠️ **หน่วยนับ = "ใบ" ไม่ใช่ "คน/เบอร์"** — กดกล่องแล้วต้องเจอแถวเท่ากันเป๊ะ
⚠️ **temporal guard** — ผลโทรบนเบอร์เดียวกันจากช่องอื่น (`card-`/`ir-`/`follow-`) นับเป็น
หลักฐานของใบเฉพาะเมื่อเวลาเหตุการณ์ **≥ เวลากรอกใบ** ไม่งั้นใบใหม่ของเบอร์เดิมเกิดมา
พร้อมสถานะ "โทรแล้ว" จากผลเมื่อ 3 เดือนก่อน
⚠️ หลักฐาน "โทรแล้ว" ใช้ stamp ที่เขียนครั้งเดียว (088) ห้ามใช้สถานะที่ reset ได้

### เส้นแบ่งสรรหา → คัดสรร (A · 16 ส.ค.)

* `api/_lib/applicationBoardLink.ts` — `loadBoardPhoneSet()` เบอร์คนบนบอร์ดทุกถัง (cache 60 วินาที)
  · ใบสนใจที่เบอร์อยู่ในเซ็ต = **ได้ใบสมัครแล้ว** (derived ตอนอ่าน ไม่ stamp)
* ⚠️ จับคู่ด้วย **เบอร์** = proxy (ฝั่งเราไม่มี citizen_id) ต้องติดธง "จับคู่ด้วยเบอร์" บนจอ
* ⚠️ ERP อ่านไม่ได้คืน **null** ไม่ใช่เซ็ตว่าง — ผู้เรียกต้องแยกสองเคส (ขีด+ธง vs 0)

### สวัสดิการที่ AI พูดได้ (benefits · 15 ส.ค.)

* `api/_lib/siamrajJobBenefits.ts` — ERP `st_request_p3_rate` × `wg2_ms_fee` → ประโยคพูด
  · เติมตอน **เสิร์ฟคิว** ไม่ใช่ตอนเข้าคิว (ใบขอแก้อัตราแล้วสายที่ยังไม่ออกได้ค่าใหม่)
* ⚠️ **whitelist เท่านั้น** — ตารางเดียวกันมีค่าปรับขาดงาน/มาสาย/เงินชดเชย ที่ห้ามพูด
* ⚠️ โอทีบอกตัวเลขเฉพาะ 1.5 เท่า (อัตราอื่นพูดรวม ๆ)

### ผลติดตามนัด (089) + ผลติดต่อ (086)

* `api/_lib/applicationAttendance.ts` (append-only · ผลล่าสุดต่อ (ใบ, วันนัด) ชนะ)
  · `api/_handlers/application-attendance.ts` · `src/lib/appointmentAttendance.ts` (ตรรกะล้วน)
* `api/_lib/applicationContacts.ts` · `api/_handlers/application-contacts.ts`
* ⚠️ **ไม่แตะ `status` ใบ** — สถานะมาจาก "ขั้นที่คนทำ" ไม่ใช่ผลติดตาม
* ⚠️ ค่าที่ยอมรับคุมที่ตรรกะฝั่ง TS ที่เดียว (ไม่ใส่ CHECK ที่ฐาน — บทเรียน 077/085
  CHECK หลุด sync กับ validator แล้ว 500)

### ตารางโทรตาม Follow (F1-F5 · migration 092)

* `follow_entries` + `group_id uuid` + `call_times text[]` (1 แถว = 1 คน × 1 วัน)
* `lumosDispatch.buildFollowReminderPayload()` หลายรอบ/วัน · `cancelFollowGroup()`
* ⚠️ **1 วัน = 1 plan** — Lumos steps หลายอันข้ามวันในแถวเดียวอันตราย
  (`bumpScheduledAtForward` ยุบ step ที่เลยเวลามากองพร้อมกัน + ผลกลับ match ด้วย
  `client_contact_id` ตัวเดียวจึงทับกัน)
* ⚠️ `next_attempt_at` = รอบแรกของวันนั้น — กันแถววันอนาคตถูกเสิร์ฟแล้ว bump มาโทรวันนี้
* ⚠️ ผลกลุ่ม: `no_answer`/`busy` → **ปิด ไม่ retry** (ตารางคือ retry อยู่แล้ว) ·
  `declined`/`wrong_person` → needs_human + ยกเลิกทั้งชุด

### ใบสมัคร → คิว AI (S8 · migration 090)

* `api/_handlers/application-dispatch.ts` · `lumosDispatch.buildApplicationInterviewPayload()`
  · person_ref = `app-<uuid>` · flag `APPLICATION_AUTO_DISPATCH_ENABLED` (auto ตอนกรอกเสร็จ)
* ⚠️ เส้นนี้ถูกเรียกจาก `/api/public/apply` ซึ่ง **ห้ามยิง ERP** — payload ใช้ snapshot บนใบ

## เลนคัดสรร — ป้าย "คนนี้มาจากไหน" (16 ส.ค. 2569)

เจ้าของสั่ง: *"ใบขอเข้ามาก็ยังหาคนให้เอง แต่แยกให้หน่อยว่าอันไหนมาจากการสมัครใหม่
อันไหนมาจาก AI หาให้"* — ระบบยังแมทให้อัตโนมัติเหมือนเดิม เพิ่มแค่ป้ายบอกที่มา

| ไฟล์ | หน้าที่ |
|---|---|
| `api/_lib/applicationOriginSql.ts` | นิพจน์ SQL ของที่มา (**ไม่มี param**) + ชนิด/ตัวตรวจค่า |
| `api/_handlers/job-applications.ts` | ต่อคอลัมน์ `origin` เข้า LIST_COLUMNS (ชั้นใหม่สุดเท่านั้น) |
| `src/lib/publicApplicationsApi.ts` | ป้าย/สี/คำอธิบาย + `countApplicationsByOrigin` · `filterApplicationsByOrigin` |
| `src/components/jobs/JobApplicantsDialog.tsx` | ชิปบนการ์ด + แถวกรอง "ทั้งหมด / สมัครใหม่ / AI หาให้ / เจ้าหน้าที่คีย์" |
| `src/components/recruit-rm/RmTable.tsx` | ชิปในคอลัมน์สถานะของตาราง RM |

3 ที่มา: `self_apply` (กรอกเอง) · `ai_found` (AI ไปหามาแล้วโทรก่อน) · `staff_added` (คีย์เอง)

⚠️ **ห้ามอ่านจากคอลัมน์ `source`** — default เป็น `'apply_page'` ทุกแถว (ทั้งใบที่คนกรอกเอง
และใบที่เจ้าหน้าที่คีย์) วัดจากฐานจริงแล้วแยกไม่ได้เลย
⚠️ **ต้องมี temporal guard** (`q.created_at <= a.created_at`) — ไม่งั้นคนที่สมัครเข้ามาเอง
แล้ววันหลัง AI ไปเจอเบอร์เดิมในฐาน จะโดนตีตราย้อนหลังว่า "AI หาให้"
⚠️ **นับเฉพาะ person_ref `ir-`/`card-`** — `app-` คือโทรหาคนที่สมัครมาแล้ว (ผลของการสมัคร
ไม่ใช่ต้นทาง) เอามานับ = ทุกคนกลายเป็น "AI หาให้" หมด
⚠️ **ไม่รู้ที่มา ≠ สมัครเอง** — ใบเก่า/schema เก่าส่ง `undefined` ต้องไม่ขึ้นชิป และมีช่อง
"ไม่รู้ที่มา" แยกในแถวกรอง
⚠️ ตัวเลขบนแถวกรองนับจากลิสต์เต็ม ไม่ใช่ลิสต์ที่กรองแล้ว (ไม่งั้นกดกรองแล้วกดกลับไม่ได้)

พิสูจน์ตรรกะบน Postgres จริงด้วยข้อมูลจำลองใน CTE (ไม่เขียนฐาน) ครบ 7 เคส: ir-/card- = AI หาให้
· app- = สมัครเอง · AI มาทีหลัง = สมัครเอง (temporal guard) · คนละใบขอ = สมัครเอง
· created_by_name = เจ้าหน้าที่คีย์

### 🔴 อัตราจ่าย ≠ อัตราเบิก (เจ้าของย้ำ 16 ส.ค.)

`st_request_p3_rate` มีสองคอลัมน์: **`payment_rate` = อัตราจ่าย (จ่ายพนักงาน)** ที่ใช้ได้
กับ **`draw_rate` = อัตราเบิก (เบิกลูกค้า)** ที่ห้ามแตะ · วัดจากฐาน 16 ส.ค. 309,977 แถว:
เบิกสูงกว่าจ่าย 154,362 · เท่ากัน 15,442 · **เบิกต่ำกว่าจ่าย 140,173** = คนละเลขจริง ๆ
หยิบผิด = บอกเลขผิดให้ผู้สมัคร + เผยราคาขายให้คนนอก · `siamrajJobBenefits.ts` ใช้
`payment_rate` ถูกอยู่แล้ว และมีเทสต์กัน `draw_rate` หลุดเข้าคิวรี

## หน้าสมัครสาธารณะโชว์สวัสดิการ/โอที (16 ส.ค. 2569)

เจ้าของเคาะ: *"หน้าสาธารณะโชว์ OT ได้"* + *"โชว์อัตราจ่ายนะไม่ใช่อัตราเบิก"*
+ เลือกระดับรายละเอียด **"เหมือนที่ AI พูด"** (โอทีบอกเลขเฉพาะ 1.5 เท่า · ที่เหลือบอกแค่ชื่อ)

| ไฟล์ | หน้าที่ |
|---|---|
| `api/_lib/siamrajJobBenefits.ts` | `fetchJobBenefitRates()` (คิวรีร่วม) → `fetchJobBenefitLines()` ประโยคให้ AI พูด · `fetchJobBenefitChips()` ชิปให้หน้าสาธารณะ (**error-safe**) · `speakableBenefitChips()` pure |
| `api/_handlers/public/jobs.ts` | `withBenefits()` เติมชิปให้ทั้งชุด — คิวรีเดียว (วัดจริง 200 ใบ = 236 ms) |
| `src/types/index.ts` | `JobRequest.benefits?: string[]` |
| `src/components/jobs/JobBoardView.tsx` | แถวชิปใต้เงินเดือน/วันที่ในการ์ด (ใช้ทั้ง /apply และบอร์ดเจ้าหน้าที่) |

⚠️ **ชิปกับประโยคต้องมาจากกติกาชุดเดียวกัน** — whitelist ตัวเดียว · โอทีบอกเลขเฉพาะ 1.5 เท่า
มีเทสต์ **parity** ล็อกว่า "มีชิป ⟺ มีประโยค" · สองจอพูดคนละเลข = เรื่องใหญ่กว่าจอไหนสวย
⚠️ **error-safe บังคับ** — `/api/public/jobs` เป็นเส้นที่คนจริงกำลังจะสมัคร ERP ล่มต้องได้
ประกาศครบเหมือนเดิม แค่ไม่มีชิป (ห้าม throw)
⚠️ ไม่มีข้อมูล = **ไม่ขึ้นแถวชิป** ห้ามขึ้นว่า "ไม่มีสวัสดิการ"

### รายได้ต่อเดือนบนประกาศงาน (เจ้าของนิยาม 16 ส.ค.: "เงินเดือน + รายได้มั่นคง")

`monthlyGuaranteedIncome()` ใน `siamrajJobBenefits.ts` (pure) → `monthly_income` +
`monthly_income_base` + `monthly_income_items` บน `/api/public/jobs`

**รายได้มั่นคง = ได้ทุกเดือนไม่ขึ้นกับเงื่อนไข** (whitelist): ค่าครองชีพ · ค่าโทรศัพท์ ·
ค่าเดินทาง/ค่ารถ/TAXI/พาหนะ · ค่าตำแหน่ง · ค่าภาษา · ค่าทักษะ/ความสามารถพิเศษ ·
ค่าอาหาร/คูปองอาหาร · ค่าเช่าบ้าน
**จงใจไม่นับ**: เบี้ยขยัน (มีเงื่อนไขขาด/สาย/ลา) · เบี้ยเลี้ยงค้างคืน/ไม่ค้างคืน · ค่าห้องพัก ·
ค่ากะ · ค่าทำงานนักขัตฤกษ์ · ค่าแทนงาน · โอทีทุกเรต · เงินชดเชยวันลา (ปกส) ·
รางวัลพิเศษ/Incentive/คอมมิชชั่น (หน่วย `T`)

⚠️ **แถว "เงินเดือน" หน่วย `D` = เงินก้อนเดียวกับค่าแรงหลัก** (16,000/30 = 533.33)
วัดจากฐาน 180 ใบมีทั้งคู่ — บวกทั้งสอง = นับเงินเดือนสองรอบ · ค่าแรงหลักเอาจาก
`is_wage='Y'` แถวเดียวเท่านั้น
⚠️ **แถวในกลุ่มเดียวกันหลายแถวให้เอาก้อนมากสุด ไม่บวกกัน** — เช่น "ค่ารถ/TAXI" กับ
"ค่ารถ/TAXI (อัตรา 1)" คือเรตเดียวที่ตั้งไว้หลายแบบให้ไซต์เลือก
⚠️ **หน่วยที่แปลงเป็นรายเดือนไม่ได้ (`H` ต่อชั่วโมง · `T` ต่อครั้ง) = ไม่นับ ไม่เดา**
⚠️ **ไม่ทับ `total_income`** — ฟิลด์เดิมมีคนใช้ทั้งระบบ (AI แมท · เทียบเงินเดือนที่ผู้สมัครขอ
· prompt ของ Lumos) เปลี่ยนความหมายกลางทาง = พังเงียบหลายจุด

🔴 **บั๊กเดิมที่เจอตอนทำ**: `total_income` ของใบที่จ่ายเป็น**รายวัน** (`is_wage='Y'` หน่วย `D`)
ถูกโชว์เป็นตัวเลขดิบบนประกาศ — วัดจริง **20 จาก 200 ใบ** เช่น OPL6908006 โชว์ "฿500"
ทั้งที่เป็นค่าแรง 500 บาท/วัน = 18,200/เดือน · ยอดใหม่แก้ให้แล้ว (คูณ 30 ตามหน่วย)

### โครงตารางอัตราของใบขอ (วัดจริง 16 ส.ค. — ใบ LAO6908007 มี 12 แถว)

`st_request_p3_rate` 1 ใบขอ = **หลายแถว** แต่ละแถวคนละหน่วย และมีฝั่งหักปนอยู่

| ตัวชี้ | ความหมาย |
|---|---|
| `is_wage='Y'` | ค่าแรงหลัก **แถวเดียว** — คือเลขที่โชว์เป็น `total_income` (ไม่ได้บวกอะไร) |
| `wg2_ms_fee.what_side='2'` | **ฝั่งหัก** — มาสาย · ค่าปรับขาดงาน · ภาษี · กองทุนสำรองเลี้ยงชีพ · ค่าเครื่องแบบ · ค่าความเสียหาย (72 รายการใน master) |
| `fee_unit_code_1` | หน่วย: `M` ต่อเดือน · `D` ต่อวัน · `H` ต่อชั่วโมง |

⚠️ **`total_income` ไม่ใช่ยอดรวม** — เป็น `payment_rate` ของแถว `is_wage='Y'` แถวเดียว
(`siamrajSqlServerRequests.ts` เลือกด้วย ROW_NUMBER) ป้ายบนจอจึงต้องไม่เขียนว่า "รายได้รวม"
⚠️ **บวกทุกแถวไม่ได้แม้ตัดฝั่งหักออกแล้ว** — ใบ LAO6908007: แถว 1 เงินเดือน 16,000 (`M`)
กับแถว 2 เงินเดือน 533.33 (`D`) คือ **เงินก้อนเดียวกันเขียนสองหน่วย** (16000/30) บวกกัน = นับซ้ำ
· แถว 3-5 เป็นอัตราชดเชยวันลา ไม่ใช่รายได้เพิ่ม · โอทีเป็นต่อชั่วโมง ขึ้นกับชั่วโมงที่ทำจริง
→ "รายได้รวมต่อเดือน" ต้องให้เจ้าของนิยามสมมติฐานก่อน (กี่วัน/กี่ชั่วโมงโอที) ไม่ใช่ SUM ตรง ๆ
⚠️ **กันฝั่งหัก 2 ชั้น** — SQL ตัด `what_side='2'` + whitelist ชื่อ · ชั้นเดียวไม่พอเพราะ
whitelist กันได้แค่ชื่อที่รู้จัก ส่วน `what_side` กันของใหม่ที่ใครเพิ่มเข้า master วันหลัง

วัดบนหน้าจอจริง 16 ส.ค.: `/api/public/jobs` 200/200 ใบมีชิป · ไม่มีรายการต้องห้ามหลุด
(ค่าปรับ/มาสาย/ชดเชย/เงินเดือน) แม้แต่ตัวเดียว · ชิปบน /apply เรนเดอร์จริง 23px
· ฟิลด์ค่าปรับของใบขอ (`penalty_per_day`) ยังไม่หลุดออก public เหมือนเดิม

## เลนคัดสรรวิ่งขนาน — ชวนคนที่เคยตอบ "ไม่สนใจ" กลับมา (16 ส.ค. 2569)

เจ้าของสั่ง: *"งานคัดสรรทำเป็นแบบคู่ขนานเลย มีใบขอมาก็ยังไปเข้าคิวหาคนที่มีเหมือนเดิม
แต่ไปหาจากกล่องคนที่ไม่สนใจงานนะ ... อันที่ AI หามาก็โทรไปเลย"*

| ไฟล์ | หน้าที่ |
|---|---|
| `api/_lib/declinedApplicantsSql.ts` | กองคนที่ผลโทรล่าสุด = `declined` (รวมผลจาก AI + คนโทรเอง) |
| `api/_lib/selectionRecallMatcher.ts` | จัดอันดับด้วย AI — ใช้ prescore/prompt ร่วมกับเลนสรรหา แต่กองคนละกอง |
| `api/_handlers/matching-selection-recall.ts` | `/api/matching/selection-recall?jobId=..&send=1` (registry **83**) |
| `api/_lib/lumosDispatch.ts` | `buildRecallInterviewPayload` + `enqueueLumosInterviewForRecall` |
| `api/_lib/matchPrecomputeWorker.ts` | `runSelectionRecall()` — ยิงต่อท้ายตอน precompute ของใบขอนั้นเสร็จ |
| `src/lib/lumosDispatchMode.ts` | trigger ใหม่ `selection_recall` (ค่าเริ่มต้น **manual**) |

⚠️ **คนกลุ่มนี้อยู่เลนคัดสรร ไม่ใช่สรรหา** — เขามีใบสมัครแล้ว ไม่ต้องเก็บใบใหม่
`RECRUIT_LANE_SOURCES` จำกัดกองของเลนสรรหาไว้ 3 แหล่ง และมีเทสต์ว่า
`recruitLaneMatcher` **ห้าม import** กองนี้เด็ดขาด
⚠️ 🔴 **ตัดคนที่ปฏิเสธใบขอใบนี้เองที่คิวรี** (`coalesce(l.job_id,'') <> $1`) — ไม่ใช่หวังพึ่ง
cooldown 30 วัน ซึ่งพ้นเดือนแล้วจะปล่อยผ่านทันที แล้วโทรถามงานเดิมที่เขาปฏิเสธไปแล้ว
⚠️ **ผลโทรต้องรวมสองทาง** (คิว AI + ถังที่คนรับไปโทร) — เอาทางเดียวกองหายครึ่ง
⚠️ **auto ต้องผ่าน `isAutoDispatchEnabled('selection_recall')` เท่านั้น** · worker กลืน error
เสมอ (เส้นนี้เป็นของแถม ห้ามทำให้ precompute ของบอร์ดล้ม) · มีเทสต์คุมลำดับ
⚠️ payload ของเส้นนี้ **ต้องอ้างว่าเขาเคยสมัครไว้** ไม่ใช่ประโยคแนะนำตัวของเลนสรรหา
(ไม่งั้นเขางงว่าไปเอาเบอร์มาจากไหน ทั้งที่กรอกให้เราเอง)

### ตัวเลขที่มาบนใบขอ

`/api/job-applications?counts=1` เพิ่ม `countsByOrigin` → การ์ดใบขอโชว์
"ผู้สมัคร N คน (AI หามา a · สมัครใหม่ b)" · นิยามเดียวกับชิปบนรายชื่อ
(`applicationOriginSql`) · **ไม่รู้ที่มา = ไม่ส่งคีย์มาเลย** ไม่ใช่ส่งศูนย์

## กันเสนอซ้ำใบที่เคยปฏิเสธ — ถาวร (16 ส.ค. 2569)

เจ้าของสั่ง: *"จะไม่เอาคนที่ลงงานแล้วและเคยปฏิเสธงานนั้นๆ มา match แล้วส่งให้ Lumos โทร"*

* `applicationRotationSql.ts` — `buildDeclinedThisJobSql()` + `phonesDeclinedThisJob()`
  (**ไม่มีหน้าต่างเวลา** · outcome `declined` เท่านั้น · รวมคิว AI + ถังคนโทรเอง)
* `lumosDispatch.ts` — ด่านอยู่ที่ **`insertQueueItems` คอขวดเดียว** จึงครอบทุกทางเข้า
  (auto / คนติ๊กเลือก / เส้นชวนกลับ / หาคนเพิ่ม) · เหตุผลรายงาน: "เคยปฏิเสธงานนี้ไปแล้ว — ไม่เสนอซ้ำ"

⚠️ **ยกเว้น `job_ref='follow'`** — ตารางโทรตามคนละเรื่องกับการเสนองาน ปฏิเสธหัวข้อหนึ่ง
ไม่ได้แปลว่าห้ามตามเรื่องอื่นตลอดไป
⚠️ **ถาวรจริง ห้ามมี now()/interval/cutoff ในคิวรี** — mutation ที่แอบใส่ 30 วันกลับเข้าไป
เคยรอดเทสต์รอบแรก (เช็คแค่ timestamptz/$3) → เทสต์ตอนนี้กันทุกรูปของหน้าต่างเวลา
⚠️ คนที่ถูกคัดเพราะปฏิเสธ ต้องไม่ถูกนับซ้ำเป็น "เคยส่งแล้ว" (duplicated)
⚠️ อ่านเซ็ตไม่ได้ = ไม่กรอง (ตารางเดียวกับคิวเอง — พังจริง insert ก็พังอยู่ดี) ต่างจาก
รายการพักเบอร์ที่อ่านไม่ได้ต้องหยุดส่ง

พิสูจน์บน Postgres จริงด้วย CTE จำลอง 6 เคส: ปฏิเสธใบนี้ (ทั้งคีย์ phone/recipient_phone
ทั้งจาก holds) = กัน · ปฏิเสธใบอื่น / ไม่รับสาย / ตอบตกลง = ไม่กัน

## หน้าการติดต่อแยกสองเลน (16 ส.ค. 2569)

เจ้าของสั่ง: *"แยกนะ งานสรรหามีหน้าการติดต่อแล้ว งานคัดสรรก็ให้มีหน้าการติดต่อ
ของเขาเอง ไม่ปนกัน"*

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/callLane.ts` | **pure** — `holdLane(source)`: irecruit → สรรหา · board/application → คัดสรร |
| `src/pages/matching/SelectionContactPage.tsx` | หน้าใหม่ `/matching/contact` = การติดต่อของ**คัดสรร** |
| `src/pages/matching/MyCallsPage.tsx` | `MyCallsSection` รับ prop `lane` (กรองที่จุดโหลดจุดเดียว) |
| `src/components/recruit-rm/RmWorkspace.tsx` | แท็บการติดต่อบนบอร์ด → `lane="recruit"` (ของ**สรรหา**) |
| `AppNavDrawer` | เมนูลูกใหม่ในกลุ่ม Matching: "การติดต่อ (คัดสรร)" |

⚠️ **แยกด้วยชนิดคน (`source` ของล็อก) ไม่ใช่คนที่กดเก็บ** — ระบบยังไม่รู้ว่าใครทีมไหน
(A4 พักไว้) · irecruit = ยังไม่สมัคร = สรรหา · board/application = สมัครแล้ว = คัดสรร
⚠️ สองเลนรวมกันต้องครบทุกแถวเสมอ (มีเทสต์คุม) — จัดเลนผิดข้าง = งานโผล่หน้าคนละทีม
แล้วไม่มีใครโทร เพราะทั้งสองหน้าคิดว่า "ไม่ใช่ของฉัน"
⚠️ ยอด "วันนี้" ในแผนผังปลายทางยังเป็นยอดรวมของคน (สถิติส่วนตัว) — จะแยกต่อเลน
ต้องแยกที่ server (tally นับจากผลที่บันทึกแล้ว ไม่มี source ติดมา)

เทสต์ `src/lib/callLane.test.ts` (6) · mutation 1/1 (สลับเลน → ล้ม 3 เคส)
ตรวจบนจอจริงด้วย stub GET: หน้าคัดสรรเห็นเฉพาะ board+application · แท็บบนบอร์ด
เห็นเฉพาะ irecruit · รวมกันครบ 3 แถว

## หน่วยงาน 2 มุมมอง + ใบขอ 4 แท็บ (16 ส.ค. 2569 เย็น)

เจ้าของสั่ง: *"ใน menu หน่วยงาน เอาหน้า matching ไปรวม แต่แยกหน้าเป็น หน่วยงาน กับ
จับคู่กับงาน · เมื่อกดเข้าไปที่ใบงานจะเจอรายละเอียดงาน มีหน้าผู้สมัคร และหน้า AI Match
และหน้าการติดต่อ"*

| ไฟล์ | หน้าที่ |
|---|---|
| `src/components/jobs/UnitSectionTabs.tsx` | 2 มุมมองบนสุด — หน่วยงาน (`/jobs/list`) · จับคู่กับงาน (`/matching/match`) |
| `src/components/jobs/UnitRequestTabs.tsx` | 4 แท็บของใบขอ — รายละเอียดงาน / ผู้สมัคร / AI Match / การติดต่อ |
| `src/pages/jobs/UnitRequestTabPage.tsx` | เนื้อของ 3 แท็บหลัง (`/jobs/siamraj/:id/{applicants,ai-match,contact}`) |
| `src/lib/unitMatchingView.ts` | pure — แบ่งกลุ่มตามที่มา / ยอด / สถานะท้ายแถว (กู้กลับจาก ba2f31d) |

⚠️ **ไม่ย้าย route ของหน้า Matching** — มีลิงก์เข้าจากปุ่มบนการ์ด เมนูเดิม และลิงก์ที่คน
แชร์กันไว้เต็มไปหมด · `UnitSectionTabs` เป็น "ทางเข้าคู่กัน" ไม่ใช่การย้ายไฟล์
⚠️ **ผู้สมัคร ≠ AI Match** — ผู้สมัครคือคนที่มีใบสมัครจริงกับใบขอนี้ · AI Match คือคนที่
AI แนะนำซึ่งยังไม่ใช่ใบสมัคร · เอาปนกันแล้วยอด "ผู้สมัคร" เฟ้อทันที
⚠️ **แท็บ AI Match ไม่ส่งเข้าคิวโทร** (`send: false`) — เป็นหน้าดู ไม่ใช่ปุ่มยิงสาย
การส่งจริงยังอยู่ที่ปุ่มบนการ์ดในกล่องงานที่เดียว
⚠️ เคย revert รอบแรก (ba2f31d → 226945a) เพราะแยกแค่ 2 แท็บแล้วเจ้าของงง —
รอบนี้ 4 แท็บตามที่สั่งชัด

### แก้เลนของหน้าการติดต่อ (แก้ของเช้าวันเดียวกัน)

`callLane.holdLane()` เดิมจัด `application` เป็น **คัดสรร** — ผิดนิยาม เจ้าของย้ำเย็นนั้นว่า
ใบจากหน้าสาธารณะคือ**งานสรรหา** (Lumos โทรถามสนใจ/ไม่สนใจ) · "สมัครแล้ว" ของคัดสรร
คือ **ชื่อขึ้นถัง To do บนบอร์ด** เท่านั้น → ตอนนี้ `board` = คัดสรร · ที่เหลือ = สรรหา

## เมนู — เรียงใหม่ · ถอดของที่ย้ายแล้ว · แอดมินจัดเอง (16 ส.ค. 2569 เย็น)

เจ้าของสั่ง: *"เรียง menu เป็น หน้าหลัก หน่วยงาน บอร์ดรับสมัคร Follow แล้วก็ตามด้วยที่เหลือ
แล้วก็เพิ่มให้ฉันปรับแก้ ย้ายเอง เปลี่ยนชื่อเองได้ด้วย"* + *"ย้ายแล้วอันนั้นก็หายไปด้วย"*

| ไฟล์ | หน้าที่ |
|---|---|
| `bottom-nav/dockNavConfig.tsx` | ลำดับตั้งต้นใหม่ (หน้าหลัก → หน่วยงาน → [บอร์ด] → Follow → ที่เหลือ) |
| `src/lib/navPreferences.ts` | **pure** — apply / move / rename / hide / normalize |
| `src/lib/navPreferencesApi.ts` · `navPreferencesEvent.ts` | โหลด/บันทึก + สัญญาณให้เมนูรีเฟรชทันที |
| `api/_handlers/app-nav-preferences.ts` | GET ทุกคน · PUT เฉพาะ admin (registry **84**) |
| `migrations/093_app_nav_preferences.sql` | แถวเดียว `id='default'` payload jsonb (แพตเทิร์นเดียวกับ 069/073) |
| `src/pages/settings/NavMenuTab.tsx` | แท็บ "จัดเมนู" ในหน้าตั้งค่า |

**ถอดออกจากเมนูแล้ว (route ยังอยู่ ลิงก์เก่าไม่พัง):** จับคู่กับงาน → แท็บในหน้าหน่วยงาน ·
การติดต่อ (คัดสรร) → แท็บในใบขอ · Pre-Check → ปุ่มท้ายแถบตัวกรองในกล่องงาน

⚠️ **เก็บเป็น override รายเมนู ไม่ใช่ลิสต์ทั้งก้อน** — เพิ่มเมนูใหม่ในโค้ดวันหลังจะโผล่เอง
โดยไม่ต้องกลับมาแก้ค่าที่แอดมินตั้งไว้ (เก็บทั้งก้อน = เมนูใหม่หายเงียบ) · มีเทสต์คุม
⚠️ **"ซ่อน" ไม่ใช่การตัดสิทธิ์** — route ยังเข้าได้ด้วยลิงก์ตรง สิทธิ์จริงอยู่ที่ roleFunctionGrants
⚠️ อ่านค่าไม่ได้/ยังไม่รัน 093 = ใช้เมนูตั้งต้น **ห้าม throw** (เมนูพังทั้งแอปเพราะค่าเสริม)
⚠️ หน้าตั้งค่าต้องโชว์ "เมนูที่ซ่อนอยู่" เสมอ ไม่งั้นซ่อนแล้วหาทางเอากลับไม่เจอ

หมายเหตุความจริงจาก mutation test: ตัว tiebreaker ใน `applyNavPreferences` กับการเขียน
`order` ให้ทุกตัวใน `moveNavItem` เป็นการเขียนเจตนาให้ชัด — ถอดออกแล้วเทสต์ยังผ่าน
(เพราะ `Array.sort` ของ JS stable อยู่แล้ว) เทสต์จึงคุม "ผลลัพธ์" ไม่ได้พิสูจน์ว่าจำเป็น

## ขั้นในกระบวนการจ้าง + เช็คลิสต์เตรียมเข้างาน (094 · ข้อ 5–7 · 16 ส.ค. 2569)

| ไฟล์ | หน้าที่ |
|---|---|
| `migrations/094_selection_progress.sql` | `selection_status` text + `prep_checklist` jsonb บนใบสมัคร |
| `src/lib/selectionProgress.ts` | **pure** — 6 ขั้น + 5 ช่องติ๊ก + normalize/toggle/progress |
| `src/lib/followPrefill.ts` | ส่งชื่อ/เบอร์ไปหน้า Follow ผ่าน query (ข้อ 7) |
| `api/_handlers/job-applications.ts` | `patchSelectionProgress` — action แยกจาก patchStatus |
| `src/components/recruit-rm/SelectionProgressControls.tsx` | dropdown + ช่องติ๊ก (บันทึกทันทีที่กด) |

6 ขั้น: รอนายพิจารณา · รอนัดวันสัมภาษณ์ · รอผลสัมภาษณ์ · รอเริ่มงาน · ช่วงประเมิน · รอแจ้งเข้า
5 ช่องติ๊ก: ลงแผนแจ้งเข้า · ผลคดี · ผลตรวจสุขภาพ · เบิกเสื้อ · แจ้งประกัน

⚠️ 🔴 **`selection_status` คนละตัวกับ `status`** (new/contacted/converted/rejected)
ตัวหลังคือ "ขั้นที่คนทำกับใบ" ที่ dashboard/แท็บ RM/ตัวนับทั้งระบบใช้อยู่ · ตัวใหม่คือ
"ขั้นของคนในกระบวนการจ้าง" · เอาไปทับกันเมื่อไหร่ตัวเลขทุกหน้าเพี้ยนพร้อมกัน (มีเทสต์คุม
ว่าค่าสองชุดไม่ทับกัน)
⚠️ เช็คลิสต์เป็น jsonb ไม่ใช่ 5 คอลัมน์ — เจ้าของเติมรายการเรื่อย ๆ · **ไม่เก็บ `false`**
(คีย์ที่ไม่มี = ยังไม่ติ๊ก อยู่แล้ว · เก็บ false ทำให้ "ไม่เคยแตะ" กับ "ติ๊กแล้วเอาออก" แยกไม่ออก)
⚠️ ติ๊ก "ลงแผนแจ้งเข้า" แล้วพาไป `/follow?pf_name=…` — **เอาติ๊กออกไม่พาไปไหน**
(ไม่งั้นกดพลาดแล้วเด้งออกจากหน้าที่ทำอยู่) · Follow อ่านค่าแล้วล้าง query ทิ้งทันที

### 🔴 บั๊กที่เจอระหว่างทาง — alias `a` ของชุดคอลัมน์

เพิ่มคอลัมน์ derived `origin` (อ้าง `a.job_id`) เข้า `LIST_COLUMNS` เมื่อ commit a1a93eb
แต่คิวรีอื่นที่ใช้ `{{cols}}` ชุดเดียวกัน **ไม่ได้ตั้ง alias** → `missing FROM-clause
entry for table "a"` แล้ว **ทั้ง endpoint ตาย 500** ไม่ใช่แค่คอลัมน์นั้นหาย
· เส้นที่พังพร้อมกัน: claim / คืน / เก็บ Lead / แก้เบอร์ / เปลี่ยนสถานะ
· แก้: ทุก `select {{cols}} from ${tbl} a` และ `update ${tbl} a … returning {{cols}}`
· เทสต์กันซ้ำ: `tests/api/applicationColumnsAlias.test.ts` (mutation 2/2)

## บทพูดของ AI 3 ชุด — สัมภาษณ์เบื้องต้น / เสนองาน / Follow (16 ส.ค. 2569 รอบยี่สิบเอ็ด)

เจ้าของสั่ง: *"ต้องการสคริปการสัมภาษณ์แบ่งเป็น 2 part — 1. สัมภาษณ์เบื้องต้นคือการสรรหา
2. การเสนองานสำหรับคนที่สมัครไปแล้ว และสุดท้าย การ Follow ลองดูจากของ Lumos แล้วทำให้ดีขึ้น"*

| ไฟล์ | หน้าที่ |
|---|---|
| `api/_lib/lumosCallScript.templates.ts` | 🔴 **ไฟล์ที่เจ้าของแก้เอง** — ข้อความบททั้ง 3 ชุด ไม่มีโค้ดปน |
| `api/_lib/lumosCallScript.ts` | **pure** — กฎการประกอบ (เติมตัวแปร · ทิ้งบรรทัดที่ไม่มีข้อมูล · คุมเพดาน) |
| `api/_lib/lumosDispatch.ts` | ตัวประกอบ payload ทั้ง 5 เส้นเรียกบทจากไฟล์ข้างบน (เลิกเขียนคำถามในตัวเอง) |
| `api/_lib/lumosJobBrief.ts` | `trimPart` ตัดเศษวรรคตอนที่ห้อยท้ายก่อนเติม "…" |
| `tests/api/lumosCallScript.test.ts` | บททั้ง 3 (mutation 8/8) |
| `tests/api/lumosServeExtraInfo.test.ts` | การเติมรายได้/สวัสดิการตอนเสิร์ฟ ทั้งสองช่อง |

**บทไหนใช้กับใคร** — แบ่งตาม "เขาเคยติดต่อเรามาก่อนไหม" ไม่ใช่ตามเลนสรรหา/คัดสรร:

| เส้น | ref | บท |
|---|---|---|
| `buildInterviewPayload` (iRecruit) · `buildRecruitLaneInterviewPayload` (R2b) | `ir-` / `card-` / `app-` | **Part 1** สัมภาษณ์เบื้องต้น |
| `buildApplicationInterviewPayload` (ใบสมัครหน้าสาธารณะ) | `app-` | **Part 2** เสนองาน |
| `buildRecallInterviewPayload` (กองเคยปฏิเสธ) | ทุกแบบ | **Part 2** + ถาม "ยังหางานอยู่ไหม" |
| `buildReminderPayload` (คนของเราบนบอร์ด) | `card-` | **Part 2 เวอร์ชันข้อความ** (`buildOfferMessage`) |
| `buildFollowReminderPayload` | `follow-` | **Part 3** Follow |

**ที่เปลี่ยนจากของเดิม:**
* **แนะนำตัวทุกสาย** (`CALLER_ORG = 'สยามราชธานี'`) — เดิมไม่บอกเลยว่าใครโทรมา
* **ถามเหตุผลตอนปฏิเสธพร้อมอ่านช้อยส์ 5 ข้อ** (`DECLINE_REASON_CHOICES`) = **ML ขั้น 1 ฝั่ง AI โทร**
  ⚠️ ฝั่งคนโทรเอง (ข้อ 4) ต้องใช้ **ชุดเดียวกันนี้** ไม่งั้นสองทางเก็บคนละหมวด รวมกันไม่ได้
* **ปิดสายด้วยขั้นถัดไป** — Part 1 บอกว่าเจ้าหน้าที่จะติดต่อเก็บใบสมัคร · Part 2 ปิดด้วยการนัด
* Part 2 **ไม่ถามค่าแรงที่คาดหวัง/ประสบการณ์ซ้ำ** (เห็นเงื่อนไข + มีโปรไฟล์แล้ว)
* Follow: แนะนำตัว + เรียกชื่อ + "รบกวนยืนยันกลับ" + เบอร์อ่านเป็นกลุ่ม + กันพูดซ้ำเมื่อโน้ตซ้ำหัวเรื่อง

### 🔴 รายได้ย้ายไปเติมตอนเสิร์ฟ — อย่าเอากลับไปไว้ตอนประกอบ payload

`total_income` = `payment_rate` ดิบ **ไม่มีหน่วย** · วัดจากฐาน 16 ส.ค. 2569: แถวค่าแรงหลัก
16,264 แถว = รายเดือน 13,646 · **รายวัน 2,608** · รายชั่วโมง 5
→ ของเดิมพูด "รายได้ 500 บาท" ให้งานที่จ่าย 500 **ต่อวัน** = ผิด 30 เท่า
(บั๊กเดียวกับที่แก้บนหน้าสาธารณะไปแล้ว แต่ยังค้างอยู่ในบทที่ AI พูด)

ตอนนี้ `takePendingLumosItems` ยิง `fetchJobBenefitRates` **รอบเดียว** แล้วประกอบ
`buildExtraInfoSentence` (รายได้ + สวัสดิการ) เติม **ทั้งสองช่อง**:
* interview = คำถามเพิ่ม 1 ข้อ · reminder = ต่อท้าย `message` ทุก step
* สูตรรายได้ = `monthlyGuaranteedIncome` **ตัวเดียวกับหน้าประกาศงานสาธารณะ**
* ⚠️ **idempotent ด้วย marker `EXTRA_INFO_PREFIX`** — Lumos เสิร์ฟซ้ำได้ถึง 5 รอบ
  เติมทุกรอบ = AI พูดรายได้ห้ารอบในสายเดียว
* ⚠️ เพดาน 15 ข้อ — เต็มแล้วไม่เติม (payload ที่ schema ไม่ผ่าน = Lumos ปัดทิ้งทั้งรายการ)
* ⚠️ ERP ล่ม = **ไม่พูดเรื่องเงินเลย** ไม่ใช่ถอยไปใช้เลขดิบ ("ไม่พูด" ปลอดภัยกว่า "พูดเลขไม่รู้หน่วย")
* แถว Follow (`job_ref = 'follow'`) ไม่มีเลขที่ใบขอ → ไม่มีรายได้โผล่ในบทติดตาม

### ไฟล์บทพูดที่เจ้าของแก้เอง (`lumosCallScript.templates.ts`)

เจ้าของเคาะ 16 ส.ค. 2569: *"ขอเป็นไฟล์ที่แก้ไขได้ที"* → เลือกแบบ **template ที่ระบบอ่านจริง**
(แก้คำในไฟล์ commit แล้วมีผลทันที ไม่ต้องแตะโค้ด)

กฎการประกอบอยู่ที่ `lumosCallScript.ts` 3 ข้อ:
1. เติมค่าลงตัวแปร `{แบบนี้}` — ลิสต์ชื่อที่ใช้ได้อยู่ที่ `KNOWN_PLACEHOLDERS`
2. **ตัวแปรไหนไม่มีค่า = ทิ้งทั้งบรรทัด** · ค่าว่าง `''` = เก็บบรรทัด (ตัวแปรธง เช่น `{ต้องมีรถ}`)
3. เพดาน `MAX_QUESTIONS = 14` (schema 15 · เผื่อ 1 ให้ประโยครายได้ที่เติมตอนเสิร์ฟ)
   · ลบคำถามจนหมด → ถอยไป `คำถามสำรอง` (สายห้ามเงียบ)

⚠️ **ด่านกันเจ้าของแก้พลาด — อยู่ในเทสต์ทั้งหมด (mutation 6/6)**
* พิมพ์ชื่อตัวแปรผิด (`{ตำแน่ง}`) → คำถามข้อนั้นจะหายเงียบ ๆ ไม่มี error
  → เทสต์สแกนไฟล์เทียบกับ `KNOWN_PLACEHOLDERS`
* พิมพ์เลขรายได้ลงไปเอง → เทสต์จับ (ต้องใช้ `{รายได้ต่อเดือน}` เท่านั้น)
* คำฝั่งหักหลุดเข้าบท (ค่าปรับ · มาสาย · ขาดงาน · ภาษี · ประกันสังคม) → เทสต์จับ
* แก้คำว่า `แจ้งเพิ่มเติมครับ` (marker กันพูดซ้ำ) → เทสต์จับ
* ลบชื่อผู้แนะนำตัว / ลบคำถามหมดทั้งบท → เทสต์จับ

⚠️ **บทใหม่มีผลเฉพาะสายที่เข้าคิวหลังแก้** — payload ถูกประกอบตอนเข้าคิวแล้วเก็บใน
`lumos_dispatch_queue.payload` แถวที่รออยู่ยังใช้บทเดิม (ยกเว้นประโยครายได้ซึ่งเติมตอนเสิร์ฟ)

### รอบ 17 ส.ค. 2569 — เติมของที่ขาดของสองเลน (migration 095)

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/lumosInterviewOutcome.ts` | **pure · ใหม่** — แปลศัพท์ผลช่องสัมภาษณ์ (`completed`→`confirmed`) |
| `src/lib/followOutcome.ts` | **pure · ใหม่** — ผลปิดงาน Follow 5 ค่า (parity กับ CHECK ใน 095) |
| `src/components/follow/FollowCompleteControls.tsx` | ปุ่มเสร็จสิ้น + เหตุอื่น (ยกเลิกงาน/ไม่ไปเริ่มงาน/ลา/อื่น ๆ) |
| `src/components/matching/SelectionRecallButton.tsx` | ปุ่ม "หาคนจากกองไม่สนใจ" — ทางเข้าจากหน้าจอของ `/api/matching/selection-recall` |
| `migrations/095_call_stamp_and_follow_outcome.sql` | `dialed_first_at/last_at/dial_count` บนใบสมัคร + `completed_at/outcome_code/outcome_note` บน follow |

**จุดที่ต้องระวังรอบนี้**

* 🔴 **`dialed_last_at` ≠ `last_call_at`** — อันแรกคือ "เจ้าหน้าที่กดโทร" (095 คอลัมน์จริง)
  อันหลังคือ "ผลโทรล่าสุดของเบอร์" ที่ handler แนบทีหลังจากคิว AI + ถังคนโทร
  ตั้งชื่อชนกันเมื่อไหร่ = ตัวเลขสองความหมายปนกันทั้งหน้า (เกือบพลาดตอนตั้งชื่อคอลัมน์)
* 🔴 **`completed_at` ≠ `cancelled_at`** บน follow — ยกเลิก = ตัดสายทิ้งก่อนถึงวัน ·
  ปิดงาน = ตามจนจบแล้วสรุปว่าจบแบบไหน · ยุบรวม = สถิติต้นเหตุแยกไม่ออก
* `dialed_first_at` เขียนครั้งเดียวด้วย coalesce — **ห้ามมี reset ที่ไหนล้าง** (กติกาเดียวกับ 088)
* คอลัมน์ dial เพิ่มใน `LIST_COLUMNS` ชุดเดียว (ชุด fallback ไม่มี) — แพตเทิร์นเดียวกับ 094
* แท็บ "คำขอโพสต์งานใหม่" บนบอร์ด = `JobPostingsPage embedded` ตัวเดิม ไม่ได้ก๊อปโค้ด ·
  route `/matching/job-postings` ยังอยู่เป็นทางถอย · ถอดออกจากเมนูแล้ว (กติกา "ย้ายแล้วต้องหาย")
* ปุ่มบนการ์ดกล่องงานเหลือปุ่มเดียว **"หาผู้สมัครเพิ่ม"** (ค้น 3 แหล่ง + ส่ง AI ทันที) —
  ปุ่มเดิมที่พาไปหน้า Matching ค้นแต่ iRecruit ถูกถอด (ของใหม่ครอบอยู่แล้ว)

### รอบ 17 ส.ค. 2569 (ต่อ) — แท็บ "ปิดแล้ว" + AI Match อัตโนมัติ

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/ClosedRequestsPanel.tsx` | แท็บ "ปิดแล้ว" — ใบขอที่ปิดในช่วง 30/90/180/365 วัน |
| `src/lib/closedRequestRange.ts` | **pure · ใหม่** — ช่วงวันที่ (คิดเป็นเวลาไทย) |
| `src/lib/boardMatchApi.ts` | **ใหม่** — ตัวดึงผลแมทคนของเราต่อใบขอ (แหล่งเดียวกับหน้าจับคู่งาน) |
| `src/lib/boardCandidateTypes.ts` | ย้าย `BoardMatchResult` / `BoardMatchResponse` ออกจาก MatchingPage มาไว้ที่นี่ |
| `src/pages/jobs/UnitRequestTabPage.tsx` | แท็บ AI Match โหลดผลเองตอนเปิด + วนเช็คทุก 15 วิระหว่าง worker คิด |

**กับดักที่เจอจริงรอบนี้**

* 🔴 **id ของใบขอมีสองรูป** — route ใช้เลขที่เปล่า (`OPL6908052`) แต่หน้าจับคู่งาน
  ส่ง id เต็ม (`siamraj-sql:OPL6908052`) · `board_match_results` เก็บโดยคีย์ตามสตริง
  ที่ส่งไป ส่งคนละรูป = **คนละช่องเก็บ** สองหน้าเห็นคนละผลทั้งที่เป็นใบเดียวกัน
  → แท็บต้องรอ `job` โหลดแล้วใช้ `job.id` เสมอ ห้ามใช้ id จาก URL ตรง ๆ
  (เจอตอนตรวจ: มีแถว `OPL6908052` โผล่ข้าง `siamraj-sql:OPL6908052` — ลบคืนแล้ว)
* แท็บ "ปิดแล้ว" **ไม่ได้ย้ายข้อมูล** — ใบปิดหลุดจากกล่องงานเองอยู่แล้ว (กล่องงานถามหา
  เฉพาะใบที่ยังเปิด) แท็บนี้แค่เป็นที่ที่ใบพวกนั้นไปโผล่ · ERP เป็นเจ้าของสถานะ เราไม่เขียนกลับ
* นิยาม "ปิด" ใช้ชุดเดียวกับ KPI ปิดใบขอบน Dashboard — เลขสองหน้าจึงตรงกัน

### รอบ 17 ส.ค. 2569 (ต่อ) — แก้ข้อมูลประกาศจากกล่องงาน + ทำความสะอาดหน้าสาธารณะ

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/extraBenefits.ts` | 🔴 **ไฟล์ที่เจ้าของแก้เอง** — รายการสวัสดิการที่ติ๊กได้ |
| `src/lib/publicJobVisibility.ts` | **pure · ใหม่** — ใบสถานะไหนซ่อนจากหน้าสาธารณะ |
| `src/components/jobs/EditPublicJobFieldsDialog.tsx` | กล่องแก้ จังหวัด/อำเภอ/ตำบล · รายได้รวม · สวัสดิการ |
| `api/_lib/siamrajUnitNotes.ts` | เพิ่ม override: province/district/subdistrict · total_income · benefits |
| `api/_handlers/public/jobs.ts` | กรองใบที่ได้คนแล้ว + ทับค่าที่แก้เอง |

**กับดักรอบนี้**

* 🔴 **`withBenefits()` ทำงานบนก้อนที่ map แล้ว** — ไม่มี `field_overrides` ติดมาด้วย
  (toPublicJob หยิบเฉพาะฟิลด์ที่ระบุชื่อ) รายได้ที่แก้เองจึงไม่ขึ้นถ้าไม่พกผ่าน
  `manual_income` แล้วลบทิ้งก่อนตอบ · **ห้ามเปลี่ยน toPublicJob เป็น spread** เด็ดขาด
  ไม่งั้นโน้ตภายใน (`list_note`) หลุดออกหน้าสาธารณะ
* 🔴 **การ์ดประกาศโชว์ `monthly_income` ไม่ใช่ `total_income`** — ทับแค่ตัวหลัง
  = แก้แล้วเหมือนไม่ได้แก้ในใบส่วนใหญ่
* ซ่อนจากหน้าสาธารณะ = **รอเริ่มงาน + รอแจ้งเข้า** (เจ้าของเคาะ) · ใบที่ยังไม่ตั้งสถานะ
  ถือว่ายังหาคนอยู่ → โชว์ · ค่าที่ไม่รู้จักก็โชว์ (ห้ามเดาว่าซ่อน ไม่งั้นประกาศหายเกือบหมด)
* `key` ใน `extraBenefits.ts` ห้ามแก้หลังใช้จริง — ใบที่ติ๊กไว้เก็บเป็น key

### รอบ 17 ส.ค. 2569 (ต่อ) — ใบขอล่วงหน้าเป็นใบขอเต็มใบ

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/siamrajSqlServerPrequests.ts` | **ใหม่** — อ่าน `st_prequest_*` แล้ว map เป็นรูปเดียวกับใบขอจริง |
| `api/_lib/siamrajUnitRequests.ts` | รวมใบล่วงหน้าเข้ากองเดียวกับใบจริง + เปิดใบเดียวด้วย id ใหม่ |
| `src/components/jobs/JobBoardView.tsx` | ป้าย "ใบขอล่วงหน้า" บนการ์ด + ปุ่ม "รายละเอียด" ฝั่งเจ้าหน้าที่ |

**กับดักของใบขอล่วงหน้า (ตรวจกับ ERP จริง)**

* 🔴 **id ต้องขึ้นต้น `siamraj-pre:`** — เลขที่ใบของสองระบบซ้ำกันได้ (รูป BU+ปีเดือน+running)
  ปนกันเมื่อไหร่ = ผลแมท/ใบสมัคร/คิวโทรผูกผิดใบ · `isSiamrajJob` + `siamrajExternalId`
  ต้องรู้จัก prefix นี้ ไม่งั้นลิงก์เปิดใบพาไป `/jobs/<id>` ซึ่งไม่มีหน้า
* 🔴 **หน่วยของค่าแรง** (`fee_unit_code_1`) ต้องดึงมาด้วย — วัดจริง 31 ใบ: รายเดือน 30 ·
  **รายวัน 1** (CRM6907001 = 15,000/วัน) โชว์ตรง ๆ = ผิด 30 เท่า
* 🔴 **`draw_rate` (อัตราเบิก) ไม่ select เลย** — วัดแล้วต่างจากอัตราจ่ายจริง (จ่าย 15,000 เบิก 23,000)
* อัตรามี **11–24 แถวต่อใบ** — list ใช้แถวค่าแรงหลัก · ถ้าจะทำสวัสดิการ/รายได้ต่อเดือน
  ต้องดึงทั้งชุดแล้วกรอง `what_side <> '2'` เหมือนใบขอจริง (ยังไม่ได้ทำ)
* `st_prequest_p2` มีแถวเดียวต่อใบ (31/31) แต่ ROW_NUMBER ต้องเรียงด้วยค่าจริง ไม่ใช่ `prequest_no`
* ใบล่วงหน้าล้ม **ห้ามลากใบจริงล้มด้วย** — `Promise.all` + `.catch(() => [])`

### รอบ 17 ส.ค. 2569 (ต่อ) — 🔴 ปิดใบขอล่วงหน้าไม่ให้ออกหน้าสาธารณะ

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/publicJobVisibility.ts` | **pure · เพิ่มด่านใหม่** — `isPrequestJob` · `isPublicPrequestEnabled` · `isPublicVisibleByPrequest` |
| `api/_handlers/public/jobs.ts` | กรองใบล่วงหน้าออกทั้ง**หน้ารวม**และ**เปิดด้วย id** (ลิงก์เก่าต้อง 404 ด้วย) |
| `tests/api/publicJobVisibility.test.ts` | เทสต์ด่านใหม่ 6 ข้อ · mutation test ผ่าน 4/4 |

**ทำไมต้องปิด (วัดจากฐานจริง 17 ส.ค.)**

* ใบล่วงหน้ามี **31 ใบ · 25 ใบเกิดวันที่ 24 ก.ค. วันเดียว** จากคนบันทึก 10 กว่าคน
  = **วันที่คนซ้อมใช้ฟีเจอร์ใน ERP ไม่ใช่ใบขอจริง** ชื่อหน่วยงานเป็น `ช่วยหนูด้วย` ·
  `หนูติดอยู่ในลิฟท์` · `so test` · `อะ 10 20 30 40` · `สยาม สยาม สยาม`
* **หลุดออกหน้าประกาศไปแล้ว 18 ใบ** (ยิง `/api/public/jobs` จริงแล้วนับได้) — มีทั้งใบที่
  ไม่มีชื่อหน่วยงานเลย (`—`) และใบที่เอาชื่อลูกค้าจริง (`SCB ไทยพาณิชย์`) ไปใส่ในใบซ้อม
* หลังปิด: 184 → **166 ประกาศ** · ใบล่วงหน้าเหลือ 0 · ลิงก์ตรงของใบซ้อม = 404 ·
  ใบขอปกติ**เลขที่เดียวกัน** (`siamraj-sql:LAO6907002`) ยังเปิดได้ 200

**เปิดกลับยังไง** — env `PUBLIC_PREQUEST_JOBS_ENABLED=true` (ไม่ต้องแก้โค้ด ไม่ต้อง restart
เพราะอ่าน env ทุกครั้ง) แต่**ยังไม่ควรเปิดจนกว่าจะเสร็จสองข้อ**:
1. ต่อ `fetchBenefitRatesByJobId` เข้า `withBenefits()` — ไม่งั้นค่าแรง**รายวัน**โชว์เป็นก้อนเดียว
2. แก้คีย์ให้เป็น id เต็มทุกจุด — เลขที่ใบล่วงหน้าซ้ำกับใบขอปกติ **23 ใบ** (คนละบริษัท)

**⚠️ ปิดเฉพาะหน้าสาธารณะ** — หลังบ้าน (บอร์ด/กล่องงาน/หน้าใบขอ) ยังเห็นใบล่วงหน้าครบเหมือนเดิม

### รอบ 17 ส.ค. 2569 (ต่อ) — 🔴 ทางสำรอง "เลขท้าย" เด้งข้ามบริษัท

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/siamrajRequestNo.ts` | **ด่านใหม่** `digitsOnlyRowMatchesLookup` — แถวที่ได้จากทางสำรองต้องเป็นเลขล้วน + prefix ที่เติมให้ตอนแสดงผลต้องตรงกับที่ผู้ใช้กด |
| `api/_lib/siamrajSqlServerRequests.ts` | `getSiamrajSqlServerUnitRequestById` เปลี่ยน `LIKE '%'+@digits` → `= @digits` แล้วกรองซ้ำด้วยด่านใหม่ |
| `tests/api/siamrajRequestNo.test.ts` | เทสต์ด่านใหม่ 6 ข้อ · mutation test ผ่าน 4/4 |

**อาการที่เจ้าของเจอ:** กด `OPL6907002` (ฮอนด้า อาร์แอนด์ดี · BU **LBD**) แล้วหน้าจอขึ้น
ใบ `LAO6907002` (ทาทา สตีล · BU **LBA**) — "LAO มาปน LBD"

**ทำไม (ไล่กับฐานจริงครบทุกสเต็ป)**

1. ใบนี้ `is_inform_all='Y'` = แจ้งเข้าครบแล้ว
2. `BASE_SQL_BY_ID` แปะ WHERE ตัวเดียวกับตอนดึงลิสต์ (เฉพาะใบที่ยังต้องหาคน) → **หาแบบตรงตัวไม่เจอ**
3. ตกทางสำรอง `LIKE '%6907002'` → เลขชุดนี้มี **9 ใบ ข้าม 4 BU**
4. เหลือใบที่ยังเปิด 2 ใบ: `LAO6907002` (LBA) · `SQ6907002` (LBD)
5. `prefixSimilarity` ไล่ตัวอักษร: `OPL` เทียบ `LAO` = **1 แต้ม** (ตัว `o` พ้องกัน) ·
   `OPL` เทียบ `SQ` = 0 แต้ม → **LAO ชนะ** ได้ใบทาทา สตีลมาโชว์เงียบ ๆ

**ขนาดปัญหา (ใบปี 2569 · 1,517 ใบ):** ใบที่ปิดแล้ว 1,257 ใบ → ในนั้น **250 ใบมีใบเปิด
เลขท้ายซ้ำ = เด้งผิดแน่นอน** → **234 ใบเด้งข้าม BU** (คนละลูกค้า)

**A/B กับฐานจริง (จำลองคิวรีเก่าเทียบใหม่)**

| กด | โค้ดเดิมคืน | โค้ดใหม่คืน |
|---|---|---|
| `OPL6907002` | LAO6907002 · **ทาทา สตีล** [LBA] | ไม่พบใบขอ |
| `LBD6907001` | SQ6907001 · **สยามราชธานี** [LBD] | ไม่พบใบขอ |
| `CRO6903001` | LBM6903001 · **สมิติเวช** [LBD] | ไม่พบใบขอ |
| `DSO6901008` | LAM6901008 · **ซาบิก ไทยแลนด์** [LBA] | ไม่พบใบขอ |

**กติกาที่ห้ามลืม**

* 🔴 **เลขนำหน้าใบขอ = รหัสแผนกที่ยื่นขอ** (`st_request_head.department_code` — ตรง
  **1,517/1,517 ใบ**) ส่วน **BU ที่หน้าจอจัดกลุ่ม = `ms_site.department_code`** คนละตัวกัน
  (OPL/LBM/SQ/PEO → LBD · LAO/LAM → LBA · DSO → DS · LMO → LM)
  แต่ละแผนกเดินเลขรันของตัวเอง → **ตัดเลขนำหน้าทิ้งเมื่อไหร่ = ถามผิดใบทันที**
* ทางสำรองยังต้องมีอยู่ เพราะ ERP บางแถวเก็บ `request_no` เป็น**เลขล้วน** (ตรวจแล้วมี 2 แถว
  ทั้งคู่ปิดแล้ว) แล้วเราเติม prefix ให้ตอนแสดงผลจาก `site_code` → กดเลขที่เห็นบนจอจะหาไม่เจอ
* prefix ที่เติมให้ต้องมาจาก **`site_code` ก่อน `department_code`** — ด่านต้องใช้กติกา
  เดียวกับจอเป๊ะ ไม่งั้นเทียบคนละเลข
* **ยังไม่ได้ทำ:** เปิดดู "ใบที่ปิดแล้ว" รายใบ — ตอนนี้ตอบ "ไม่พบใบขอ" (ดีกว่าโชว์ใบผิด แต่ยัง
  ไม่ใช่ปลายทาง) · ทำได้ต้องมีคิวรี by-id ที่ไม่มีด่าน open **และ** ระวัง `mapSqlServerRow`
  ที่ hardcode `status:'open'` ไว้ — ปลดด่านเฉย ๆ = **ใบที่ปิดแล้วหลุดออกหน้าสาธารณะ**

### รอบ 17 ส.ค. 2569 (ต่อ) — ลิสต์ UI 8 ข้อจากเจ้าของ

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/JobBoardView.tsx` | กดกล่อง = เปิดรายละเอียดใบงาน · ถอดปุ่ม "รายละเอียด" · ปุ่ม "ดูรายชื่อ" · สัญชาตินายบนการ์ด · กล่องลอยทรงเดียวกับการ์ดใบขอ |
| `src/components/jobs/JobApplicantsDialog.tsx` | เหลือ 2 รายชื่อ ("รายชื่อทั้งหมด" · "คนที่สนใจ") ถอดแถวชิปกรองที่มา |
| `src/components/recruit-rm/RmTable.tsx` | คอลัมน์ชุดใหม่ + ถอดคอลัมน์สถานะ |
| `src/components/recruit-rm/RmWorkspace.tsx` | ถอดแผงตัวกรองด้านข้าง (ลบ `RmFilterSidebar.tsx`) |
| `src/components/recruit-rm/RecruitControlPanel.tsx` | จัดกล่องเป็น 5 ขั้นของเส้นทางคน + แถบสัดส่วนเทียบยอดเข้ามา |
| `src/lib/recruitRm.ts` | **pure ใหม่** `applicationUnitLabel` · `applicationAddressLabel` · `daysSinceApplied` |
| `src/pages/dashboard/SupervisorDashboard.tsx` | drill-down "ปิดแล้ว" ดึงชุดใบปิดจริง + บอกเมื่อลิสต์ได้ไม่ครบ |
| `src/components/dashboard/analytics/DashboardShell.tsx` | `onKpiClick` ส่ง `expectedRequests` (ยอดใบขอบนการ์ด) ไปด้วย |
| `api/_handlers/public/jobs.ts` | ส่ง `boss_nationality` ออกหน้าสาธารณะ |

**กับดักที่เจอรอบนี้**

* 🔴 **ถอด `<th>` ต้องถอด `<td>` ด้วยเสมอ** — เอาหัวคอลัมน์ "สถานะ" ออกอย่างเดียว
  ทุกแถวเลื่อนไปหนึ่งช่อง ข้อมูลไปโผล่ใต้หัวคอลัมน์ผิด (นับ th/td ให้ตรงกันก่อน commit)
* 🔴 **drill-down "ปิดแล้ว" เดิมกรองจากกองใบที่ยังเปิดอยู่** — ใบที่ปิดสนิทไม่เคยอยู่ในกองนั้น
  ตั้งแต่แรก (feed กล่องงานถามหาเฉพาะใบที่ยังต้องหาคน) วัดจริง: กดแล้วได้ **23 ใบ**
  ขณะที่การ์ดบอก **3,698 ใบ** · แก้เป็นดึงจาก `siamrajSqlServerClosed` (ชุดเดียวกับแท็บ
  "ปิดแล้ว" ของบอร์ด) แล้วรวมกับใบที่ยังเปิดและหาได้บางส่วน ตัดซ้ำด้วย id → **1,571 ใบ**
* 🔴 **ยังลิสต์ได้ไม่ครบและต้องบอกให้รู้** — เลขบนการ์ดมาจาก `sumCohortStockByRequestDate`
  (ยอดรวมรายเดือนฝั่ง ERP) ซึ่ง**นับใบที่อยู่นอก feed ของกล่องงานด้วย** ปิดช่องว่างนี้ไม่ได้
  ถ้าไม่มี endpoint ใหม่ที่ลิสต์ใบระดับ cohort → หัวกล่องบอกตรง ๆ ว่า "เลขบนการ์ดคือ N ใบ
  ส่วนที่เกินเป็นใบนอกกล่องงาน ยังดึงรายชื่อไม่ได้" **ห้ามปล่อยให้ต่างกันเงียบ ๆ**
* `flex h-full flex-col` บนการ์ด + `flex-1` บน CardContent + `mt-auto` บน CardFooter
  คือชุดที่ทำให้กล่องสูงเท่ากันทั้งแถวและแถบล่างปักระดับเดียวกัน — กล่องลอยเดิมไม่มี
* แถบสัดส่วนใช้ `tone.dot` (สีพื้น) ไม่ใช่ `tone.bar` ซึ่งเป็นคลาส `border-t`

### รอบ 17 ส.ค. 2569 (ต่อ) — หน้า Follow แก้ไขได้ + หน่วยงาน + เลือกวันส่ง

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/096_follow_unit_and_edit.sql` | **ใหม่** — `unit_name` · `site_code` · `updated_at/by/by_name` บน `follow_entries` |
| `api/_handlers/follow.ts` | หน่วยงาน/รหัสไซต์ เข้า GET/POST · `parseFollowEditInput` + `updateFollow` (PATCH `action:'update'`) · GET คืน `call_attempt` |
| `api/_lib/lumosDispatch.ts` | **ใหม่** `refreshFollowReminderPayload` — แก้รายการแล้วแก้บทพูดในคิวตาม |
| `src/lib/callOutcomeBuckets.ts` | **pure · ใหม่** — ถังผลโทร/รอบ ใช้ร่วมทั้ง funnel (SQL) และหน้าเว็บ |
| `src/components/follow/FollowEditDialog.tsx` | **ใหม่** — กล่องแก้ไขรายการติดตาม |
| `src/pages/follow/FollowPage.tsx` | ช่องเลือกหน่วยงานจากใบขอ · ชิปเลือกวันที่จะส่ง · ปุ่มแก้ไข · โชว์เจ้าของข้อมูล |
| `src/components/home/FollowTodayPanel.tsx` | แถบสัดส่วนต่อรอบ + กดดูรายชื่อในรอบนั้น |
| `src/components/jobs/JobBoardView.tsx` | ย้ายปุ่ม "แก้ข้อมูลประกาศ" ขึ้นมุมขวาบนของหัวการ์ด |

**กติกาที่ห้ามละเมิด**

* 🔴 **เจ้าของข้อมูล = คนที่กรอกครั้งแรก แก้ไม่ได้** — `created_by`/`created_by_name`
  ห้ามถูกทับตอนแก้ไข (คนแก้ลงที่ `updated_by_name` แยก) · ทับเมื่อไหร่ = ประวัติว่าใคร
  ลงงานนี้หายเงียบ ๆ · เทสต์คุมทั้งฝั่ง parse และฝั่ง SQL
* 🔴 **แก้รายการแล้วต้องแก้ payload ในคิวด้วย** — payload สร้างตอน**เข้าคิว** ไม่ใช่ตอนเสิร์ฟ
  ไม่แก้ = AI ไปพูดชื่อ/เรื่อง/เบอร์ติดต่อกลับ**ชุดเก่า** ขณะที่หน้าจอโชว์ชุดใหม่ (พังเงียบสนิท)
  · ได้ผลเฉพาะแถว `status='pending'` → คืนจำนวนที่แก้ได้จริงมาบอกคนใช้
  **`queue_refreshed = 0` ต้องขึ้นข้อความว่าสายที่ออกไปแล้วใช้ข้อมูลเดิม**
* 🔴 **PATCH เดิม (ไม่มี `action`) = ปิดงาน ห้ามเปลี่ยนความหมาย** — แยกด้วย `action:'update'`
  เพราะของเก่ามีคนใช้อยู่
* **`group_id`/`call_times` แก้ทีละแถวไม่ได้** — กำหนดรูปตารางทั้งชุด แก้แถวเดียว = ชุดเพี้ยน
* **หน่วยงานเก็บเป็นข้อความ ไม่ใช่ FK** — ใบขออยู่คนละฐาน และเลขที่ใบซ้ำกันได้
  (ใบขอปกติ vs ล่วงหน้า 23 ใบ · เลขท้ายชนข้าม BU 234 ใบ) · ต้องการแค่ snapshot ตอนกรอก
* **ช่วงวันเป็นตัวกางปฏิทิน ไม่ใช่คำสั่งส่งทุกวัน** — ส่งเฉพาะวันที่ติ๊ก (ข้ามเสาร์อาทิตย์ได้)
* 🔴 **ยอดบนแผงหน้าหลักกับรายชื่อใน popup มาคนละเส้น** (funnel นับในฐาน · รายชื่อจาก
  ตารางรายการติดตาม) → นับได้ไม่เท่ากันต้องขึ้นข้อความในกล่อง ห้ามเงียบ ·
  เงื่อนไขแบ่งถังอยู่ที่ `callOutcomeBuckets.ts` ที่เดียว ทั้ง SQL และหน้าเว็บใช้ตัวเดียวกัน
* `unitRequestCardTitle` คืน **เลขที่ใบ** ส่วน `jobBoardCardTitle` คืน **ชื่อหน่วยงาน** —
  ตัวเลือกหน่วยงานต้องใช้ตัวหลัง ไม่งั้น dropdown เป็นเลขที่ใบล้วนอ่านไม่ออก

### รอบ 17 ส.ค. 2569 (เย็น) — เปิดใบขอล่วงหน้าขึ้นสาธารณะ + บอกสถานะบนกล่องงาน

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/siamrajJobBenefits.ts` | `parseJobRef` · `fetchPrequestBenefitRates` · `fetchBenefitRatesByJobId` · `fetchJobBenefitChipsById` · `fetchMonthlyIncomesById` (ตัวเดิมที่คีย์ด้วยเลขที่ใบ = deprecated) |
| `api/_handlers/public/jobs.ts` | `withBenefits()` คีย์ด้วย **id เต็ม** แทนเลขที่ใบ |
| `src/lib/publicJobVisibility.ts` | ค่าเริ่มต้นของใบล่วงหน้าเปลี่ยนเป็น **เปิด** |
| `src/components/jobs/JobBoardView.tsx` | ชิปสถานะงานบนการ์ด + ป้าย "ไม่ขึ้นประกาศ" |

**เจ้าของเคาะเย็น 17 ส.ค.**

* *"ใบขอล่วงหน้าเอาขึ้นไปเลย ถ้าไม่เอาแล้วก็คงปิดไปเอง"* → ค่าเริ่มต้น = เปิด ·
  ปิดฉุกเฉินด้วย env `PUBLIC_PREQUEST_JOBS_ENABLED=false` (ต้องเขียนคำว่าปิดชัด ๆ
  คำสะกดเพี้ยนตีความว่าเปิด — กันประกาศหายทั้งกองเพราะพิมพ์ผิด)
* *"ถ้าบอกมีคนรอเริ่มงานแล้วไม่ขึ้น งั้นต่อไปหน้ากล่องงานช่วยบอกสถานะด้วยจะได้รู้"*
  → ชิปสถานะงานบนการ์ด ฝั่งเจ้าหน้าที่ · สถานะที่ทำให้ไม่ขึ้นประกาศติดป้าย
  **"ไม่ขึ้นประกาศ"** สีเหลือง + ไอคอนตาปิด พร้อม tooltip บอกวิธีเอากลับ

**🔴 ที่ต้องรู้: ระหว่างวันเดียวกัน ใบล่วงหน้า 30 จาก 31 ใบถูกปิดที่ ERP** (`status` A→C)
เหลือใบเดียวที่ยังเปิด (`LBM6908001` อีซูซุมอเตอร์) — ใบซ้อมชุด 24 ก.ค. หายจากต้นทางหมด
`listSiamrajSqlServerPrequests` กรอง `status='A'` อยู่แล้ว ใบที่ปิดจึงไม่มีทางขึ้นประกาศ

**กับดักของอัตราค่าจ้างใบล่วงหน้า (ตรวจกับ ERP จริง)**

* อัตราของสองระบบอยู่**คนละตาราง** (`st_request_p3_rate` vs `st_prequest_p3_rate`)
  และคอลัมน์อัตราคนละชื่อ (`payment_rate` vs **`fee_rate`** — ตาราง prequest ไม่มี
  `payment_rate` เลย) · `draw_rate` (อัตราเบิก) มีอยู่แต่**ห้าม select** เหมือนกัน
* 🔴 **คีย์ต้องเป็น id เต็มเสมอ** — `LBM6907002` เป็นทั้งใบล่วงหน้าของแคททาเลอร์
  และใบขอปกติของ รพ.เปาโล · คีย์ด้วยเลขเปล่าคือมีโอกาสเอาอัตราของอีกบริษัทมาโชว์
* หน่วยของค่าแรงหลักต้องอ่านจาก `fee_unit_code_1` — วัดจริง `CRM6907001` ใส่
  "เงินเดือน 15,000" แต่หน่วยเป็น **D (รายวัน)** = ข้อมูลขัดกันเองในใบซ้อม (ปิดไปแล้ว)

### รอบ 17 ส.ค. 2569 (เย็น ต่อ) — ทีม online เป็นผู้รับผิดชอบบทบาทที่ 4

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/097_online_assignee.sql` | **ใหม่** — ผ่อน CHECK role + `online_name` บน `siamraj_unit_assignments` |
| `api/_handlers/job-staff.ts` | roster รับ role `online` (รายชื่อ + picker excluded) |
| `api/_lib/siamrajUnitAssignments.ts` · `api/_handlers/siamraj-unit-assignments.ts` | อ่าน/เขียน `online_name` |
| `src/lib/jobStaffRemote.ts` · `src/lib/jobStaffNames.ts` | `onlines` + `buildOnlineNameOptions` |
| `src/pages/settings/JobStaffRosterTab.tsx` · `AdminSettings.tsx` | กลุ่ม "ทีม Online" + เปลี่ยนป้ายแท็บ |

**🔴 กับดักซ้ำรอบที่สาม: CHECK constraint ของ `role`**
`job_staff_roster.role` / `job_staff_picker_excluded.role` มี CHECK ระบุค่าตายตัว
เพิ่มบทบาทใหม่โดยไม่ drop+สร้าง CHECK ใหม่ = insert ตกเงียบ/500 โดยหน้าจอไม่บอกอะไร
(migration 035 เคยเจอตอนเพิ่ม OPL · 097 เจอซ้ำตอนเพิ่ม online)

⚠️ ตอนตรวจเจอ constraint **ชื่อเดียวกันสองชุด** — ของเก่าอยู่ schema `car_stamp`
(คนละแอปที่ใช้ฐานร่วมกัน) ไม่ใช่ของ `jarvis_rm` · เวลาเช็ค constraint ต้องกรอง schema เสมอ
ไม่งั้นอ่านผิดตัวแล้วไปแก้ของแอปอื่น

**กติกา:** ไม่ส่งช่องไหนมาใน upsert = **คงค่าเดิม** — ยืนยันกับของจริงแล้วว่าอัปเดต
`online_name` อย่างเดียวไม่ล้างสรรหา/คัดสรร/OPL ที่มีอยู่ (หมิว/น้ำหวาน/สมปอง อยู่ครบ)

### รอบ 17 ส.ค. 2569 (เย็น ต่อ) — น้ำหนักเรียงผู้สมัครตั้งได้ต่อใบขอ

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_handlers/match-priority-weights.ts` | `?request_no=` → อ่าน/เขียน/ลบน้ำหนักของใบนั้น · GET คืน `config` + `defaultConfig` + `overridden` |
| `src/lib/matchPriorityWeightsApi.ts` | `fetchMatchPriorityState` · `saveMatchPriorityConfig(config, requestNo)` · `resetMatchPriorityConfig` |
| `src/pages/settings/MatchPriorityWeightsTab.tsx` | รับ prop `requestNo` — ไม่ส่ง = แก้ค่ากลาง (เดิม) · ส่ง = แก้ของใบนั้น + ปุ่มกลับไปใช้ค่ากลาง |
| `src/pages/matching/MatchingPage.tsx` | โหลดน้ำหนักตามใบที่เปิด + ปุ่ม "น้ำหนักของใบนี้" + ป้ายบอกว่าเรียงด้วยชุดไหน |

**ไม่ต้องสร้างตารางใหม่** — `app_match_priority_weights.id` เป็น primary key อยู่แล้ว
ใช้ `id = 'default'` เป็นค่ากลาง และ `id = <id เต็มของใบขอ>` เป็นชั้น override

**กติกา**

* 🔴 คีย์ของใบต้องเป็น **id เต็ม** (`siamraj-sql:` / `siamraj-pre:`) — เลขที่ใบซ้ำกันได้ 23 ใบ
  คีย์ด้วยเลขเปล่า = ใบสองใบใช้น้ำหนักก้อนเดียวกัน
* 🔴 **ลบแถว `'default'` ไม่ได้** (API ตอบ 400) — ลบแล้วทุกใบร่วงไปใช้ค่า hardcode พร้อมกัน
* `overridden` มาจาก "มีแถวของใบไหม" **ไม่ใช่เทียบค่ากับค่ากลาง** — ตั้งเท่ากันก็ยังนับว่าตั้งเอง
  (ไม่งั้นกดบันทึกค่าเดิมแล้วป้ายไม่ขึ้น คนงงว่าบันทึกติดหรือไม่)
* หน้า Matching ต้องยิงโหลดใหม่ทุกครั้งที่เปลี่ยนใบขอ — ห้าม cache ข้ามใบ

### รอบ 17 ส.ค. 2569 (ค่ำ) — ย้ายใบสมัครอัตโนมัติเมื่อใบขอถูกปิด + โลโก้หัวบอร์ด

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/098_application_auto_move.sql` | **ใหม่** — `moved_from_job_id` · `moved_at` · `moved_reason` |
| `src/lib/applicationAutoMove.ts` | **pure · ใหม่** — ตัดสินใจว่าย้ายได้ไหม/ไปใบไหน (เทสต์ 19 ข้อ · mutation 9/9) |
| `api/_lib/applicationAutoMoveRunner.ts` | **ใหม่** — หยิบข้อมูลป้อนตัวตัดสิน + เขียนผล (ไม่มีเงื่อนไขซ้ำ) |
| `api/_handlers/application-auto-move.ts` | **ใหม่ · route 85** — GET = ลองดู (dry run) · POST = ย้ายจริง |
| `src/components/jobs/PublicApplyDialog.tsx` | 🔴 แก้ `job_title` + prefill ให้เป็น **ตำแหน่ง** ไม่ใช่ชื่อหน่วยงาน |
| `src/components/jobs/JobBoardView.tsx` | หัวบอร์ดสาธารณะเป็นโลโก้แทนข้อความ (คง `<h1>` sr-only ไว้) |

**เกณฑ์ที่เจ้าของเคาะ (ห้ามผ่อนเอง)**
> ย้ายไปใบที่ **ยังเปิด + ตำแหน่งเดียวกัน + จังหวัดเดียวกัน** เท่านั้น (อำเภอตรงกันขึ้นก่อน)

**ด่านกันย้ายเกินสิทธิ์** — ไม่ย้ายเมื่อ: ขึ้นบอร์ดแล้ว · มีนัดแล้ว · สถานะไม่ใช่ `new` ·
เคยถูกย้ายแล้ว · ไม่ผูกใบขอ · ไม่รู้ตำแหน่ง/จังหวัด · ใบที่เคยปฏิเสธ · ใบเดิมของตัวเอง

**กับดัก**

* 🔴 **`on_board` / `appointment_at` ไม่ใช่คอลัมน์** — เป็น derived ตอนอ่าน
  (`on_board` จับคู่เบอร์กับบอร์ด ERP · นัดมาจากผลโทร/ผลติดต่อ) · runner ต้องเรียก
  `loadBoardPhoneSet()` เอง · **ERP อ่านไม่ได้ = ไม่ย้ายทั้งรอบ** (null = เช็คไม่ได้ ≠ ไม่มีใคร)
* 🔴 **`sameText('','')` ต้องเป็น false** — "ไม่รู้ ≠ ตรงกัน" ไม่งั้นใบที่ข้อมูลว่างแมทกับทุกใบ
* 🔴 **ไม่ทับ `job_id` ทิ้ง** — เก็บใบเดิมที่ `moved_from_job_id` · `where moved_at is null`
  ใน UPDATE กันสองรอบวิ่งพร้อมกันแล้วย้ายซ้อน
* 🔴 **ข้อมูลจริงพังมาก่อน**: `job_title` และ prefill ของ `position_interest` ถูกใส่ด้วย
  `jobBoardCardTitle()` ซึ่งคืน**ชื่อหน่วยงาน** → ใบสมัครเก็บชื่อบริษัทไว้ในช่องตำแหน่ง
  ทำให้ (ก) คอลัมน์ "ตำแหน่ง — หน่วยงาน" โชว์ซ้ำสองรอบ (ข) ตัวย้ายเทียบตำแหน่งไม่เจอสักใบ
  · แก้ที่ต้นทางแล้ว **แถวเก่า 2 ใบยังเป็นค่าเดิม** (ไม่ backfill เงียบ ๆ)

**หัวบอร์ดสาธารณะ** — ใช้ `/so-logo.png` · `onError` ถอยไป `/so-work-logo.png`
ไฟล์ใหม่ยังไม่ถูกวาง จึงยังโชว์โลโก้เดิมไปก่อน (ไม่เป็นรูปแตกบนหน้าที่คนนอกเห็น)

### รอบ 18 ส.ค. 2569 — หน้า Follow: แผง 3 รอบ + ปฏิทิน · บอร์ดเรียงใบเก่าก่อน

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/followCallCalendar.ts` | **pure · ใหม่** — ยอดโทรต่อวัน + กริดเดือน (เทสต์ 11 ข้อ · mutation 6/6) |
| `src/components/follow/FollowCallRoundsPanel.tsx` | **ใหม่** — 3 แถว = 3 รอบ · กดกล่องเห็นชื่อ+รายละเอียด · ปฏิทินรายเดือน |
| `src/pages/follow/FollowPage.tsx` | สลับจาก `CallFunnelPanel` เป็นแผงใหม่ · ถอดชิปกรอง 5 ตัว |
| `src/components/jobs/JobBoardView.tsx` | เรียงใบที่ผ่านมานานสุดขึ้นก่อน (กล่องงาน + สาธารณะ) |

**เจ้าของสั่ง 18 ส.ค.**
> *"เปลี่ยนเอา ทั้งหมด รอโทร กำลังโทร โทรสำเร็จ ไม่สำเร็จ ไปใส่แทนแบ่งเป็น 3 แถว
> เพื่อให้รู้ว่าโทร 3 รอบ แต่ละกล่องกดแล้วต้องแสดงชื่อพร้อมรายละเอียดของแต่ละคน
> มี calendar ให้หน่อยเพื่อจะได้รู้ว่าแต่ละวันโทรกี่คน"*

**กติกา**

* 🔴 **นับวันตามปฏิทินกรุงเทพเสมอ** — สายที่ตั้งไว้ตี 1 ไทยยังเป็น "เมื่อวาน" ที่ UTC
  ตัดวันฝั่ง UTC = ยอดเพี้ยนทั้งเดือน (กับดักเดียวกับคอลัมน์ "ผ่านมาแล้ว")
* 🔴 **แยก "ตั้งไว้จะโทร" (`scheduled_at`) กับ "โทรแล้ว" (`called_at`) คนละถัง** ·
  ผลกลับอาจคนละวันกับที่ตั้งไว้ → นับคนละวัน · ยุบเป็นเลขเดียว = อ่านไม่ออกว่าเกิดจริงหรือยัง
* 🔴 **สายที่ยกเลิกไม่นับเป็น "จะโทร"** — ไม่งั้นยอดวันนั้นโป่งด้วยสายที่ตายแล้ว
* 🔴 **ยอด (funnel นับในฐาน) กับรายชื่อ (ตารางรายการติดตาม) คนละเส้น** — ไม่เท่ากัน
  ต้องขึ้นข้อความบอกในกล่อง ห้ามเงียบ · ถังแบ่งด้วย `callOutcomeBuckets.ts` ที่เดียว
* `CallFunnelPanel` ใช้ที่หน้า Follow **ที่เดียว** — เปลี่ยนได้ไม่กระทบ Matching
  (หน้านั้นใช้ `AiCallFlowPanel` คนละตัว)
* ชิปกรอง 5 ตัวถูกถอด แต่ **state `filter` ยังอยู่** (ค้างที่ 'all') — เอาชิปกลับมา
  แค่คืน block เดิม ไม่ต้องรื้ออย่างอื่น

**บอร์ดเรียงใหม่** — `compareJobsByAgeDaysDesc` (ตัวเดียวกับหน้ารายการใบขอ) เป็นคีย์หลัก
"ใบที่มีคนกรอกขึ้นก่อน" (คำสั่ง 13 ส.ค.) ลดเป็นตัวตัดสินรองเมื่ออายุเท่ากัน

### รอบ 18 ส.ค. 2569 (บ่าย) — การ์ด เข้ามา/ปิดได้/ยกเลิก/คงเหลือ กดแล้วเห็นรายใบเสมอ

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/dashboard/cohortDrillDown.ts` | **pure · ใหม่** — แตก `throughputRecords` เป็นรายใบตามถังที่กด (เทสต์ 10 ข้อ · mutation 7/7) |
| `src/lib/dashboard/dashboardDetailDialog.ts` | เพิ่ม `cohortRowToDashboardDetailItem` — แถว drill-down ของ 4 การ์ด |
| `src/lib/dashboard/throughput.ts` | `ThroughputRecord` เพิ่ม `jobId` / `requestNoDisplay` / `unitName` / `siteCode` (fallback ฝั่ง jobs เติมให้ด้วย) |
| `api/_lib/siamrajSqlServerThroughput.ts` | SQL เพิ่ม `site_code` / `site_name` / `customer_name` + ส่ง id เต็ม `siamraj-sql:` กับเลขที่แบบโชว์ |
| `src/lib/siamrajUnitRequestsApi.ts` | type ฝั่ง client ตามให้ตรง |
| `src/pages/dashboard/SupervisorDashboard.tsx` | `openCohortDrillList` — 4 การ์ดเปิดลิสต์จากชุดเดียวกับเลขบนการ์ด |

**เจ้าของสั่ง 18 ส.ค.**
> *"หน้า Dashboard ตรง เข้ามา ปิดได้ ยกเลิก คงเหลือ กดเข้าไปต้องมีใบขอบอกด้วยสิ่
> ต่อให้ดูเป็นรายเดือน ทั้งปี ก็ต้องขึ้น"*

**ทำไมต้องมีตัวใหม่** — เลขบนการ์ดนับจาก `throughputRecords` (ERP ทุกใบที่กรอกในช่วง
รวมใบที่ปิด/ยกเลิกแล้ว) แต่ลิสต์เดิมกรองจาก**กองใบเปิดในกล่องงาน** คนละกอง
วัดจริง: 「เข้ามา」การ์ด 7,548·5,602 กดได้ 340·289 · 「ยกเลิก」1,686 ใบ กดแล้ว**ว่างเปล่า**
· 「ปิดแล้ว」เคยต้องยิง ERP แยกแล้วขึ้นหมายเหตุ "ลิสต์ได้ไม่ครบ" (3,699 vs 1,571)
ตอนนี้ทั้งเลขและรายการมาจาก records ชุดเดียวกัน → เท่ากันเป๊ะทุกโหมด (วัดแล้ว:
ทั้งหมด 7,548·5,602=5,602 แถว · เดือนนี้ 105·96 · ทั้งปี 2569 1,743·1,518)

**กับดัก**

* 🔴 **คีย์จัดกลุ่มคือเลขที่ใบดิบเต็ม ๆ** ห้าม slice/ตัดนำหน้า (เลขท้ายซ้ำข้าม BU 9 ใบ/เลข)
  · เปิดใบใช้ `jobId` (`siamraj-sql:<เลขดิบ>`) — แถวที่ไม่รู้ id เต็มไม่ผูก onClick เลย
* 🔴 **ช่วงของ drill ต้องเท่าช่วงของการ์ด**: `period ?? trendMeta` (ตัวเดียวกับ
  `periodFrom/periodTo` ใน buildDashboardData) และ records ต้องผ่าน
  `filterThroughputByDepartment` เหมือนกัน ไม่งั้นเลขกับรายการหลุดจากกันอีก
* 🔴 **คงเหลือโหมด "ทั้งหมด" ไม่ใช่ cohort** — การ์ดนับจากใบเปิดจริง จึงยังใช้เส้นเดิม
  (`filterJobsForRemainingKpi`) · cohort drill ใช้กับคงเหลือเฉพาะโหมดมีงวด
* อัตราที่ไม่มีเลขที่ใบยังนับบนการ์ด — drill คืน `positionsWithoutRequestNo`
  แล้วหัวกล่องเขียนบอก ห้ามหายเงียบ
* throughput ยังโหลดไม่มา (`records.length === 0`) = ถอยไปเส้นเดิม ไม่เปิดกล่องว่าง

### รอบ 18 ส.ค. 2569 (บ่าย-2) — เปิดหน้ารายละเอียดใบที่ปิดแล้วได้ + Follow ปฏิทินขวาบน/popup

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/siamrajSqlServerRequests.ts` | `getSiamrajSqlServerUnitRequestById` รับ `includeClosed` — ไม่เจอในกองใบเปิดค่อยหาแบบไม่กรอง (`BASE_SQL_BY_ID_ANY`) · `mapSqlServerRow` ตีสถานะจากแถวจริงด้วย `isOpenStaffingRow` แทน hardcode `'open'` |
| `api/_lib/siamrajUnitRequests.ts` | ส่งต่อ `options.includeClosed` |
| `api/_handlers/siamraj-unit-requests.ts` | เส้น `?id=` (หน้ารายละเอียด) ส่ง `includeClosed: true` |
| `src/components/follow/FollowCallRoundsPanel.tsx` | ปฏิทินเป็น **Popover มุมขวาบน** ข้างปุ่มรีเฟรช · กดกล่องถัง/กดวันแล้วรายชื่อขึ้นเป็น **Dialog popup** (เลิกกางใต้แผง) — state `openBox`/`openDay`/`calendarOpen` แบบกางแถวถูกแทนด้วย `peopleDialog` ก้อนเดียว |

**ทำไม includeClosed** — drill-down 4 การ์ดลิสต์ใบที่ปิด/ยกเลิกแล้วด้วย แต่การค้นรายใบ
เดิมผ่าน CTE ที่กรอง `openStaffingRequestWhere` → กดใบปิดจาก popup แล้ว **404**
(วัดจริง: `LMO6901001`) · แก้แล้วใบเปิดยังตอบ `open` เหมือนเดิม ใบปิดตอบ `closed`

**กับดัก**

* 🔴 `includeClosed` ใช้ได้เฉพาะหน้ารายละเอียด — **เส้น AI โทร (`callBatchDispatcher`)
  กับ matching พึ่ง "null = ใบไม่เปิดแล้ว" เป็นด่านกันโทรผิดใบ** ห้ามส่ง option นี้
* 🔴 `mapSqlServerRow` เลิก hardcode `status: 'open'` แล้ว — ใครเพิ่มคอลัมน์ SELECT
  ที่กระทบ `isOpenStaffingRow` (status/is_stop/stop_no/is_inform_all/inform) ต้องเช็คทั้งสองทาง
* popup รายชื่อของ Follow ใช้ `entries` ชุดเดียวทั้งเลขและชื่อ — กติกาเดิม ห้ามแยกเส้น

### รอบ 18 ส.ค. 2569 (บ่าย-3) — หน้า Follow: คำนำหน้า · picker หน่วยงาน · wizard 3 ขั้น · Visual Control

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/boardUnitPicker.ts` | **pure · ใหม่** — ยุบใบขอเปิดเป็นรายหน่วยงาน + ค้น (เทสต์ 11 ข้อ · mutation 7/7) |
| `src/lib/followWizard.ts` | **pure · ใหม่** — ด่านตรวจ 3 ขั้นของฟอร์มเพิ่ม (เทสต์ 15 ข้อ · mutation 7/7) |
| `src/lib/followRoundVisual.ts` | **pure · ใหม่** — สี/สัญญาณ Visual Control ของแผงการโทร (เทสต์ 12 ข้อ · mutation 7/7) |
| `src/components/follow/BoardUnitPicker.tsx` | **ใหม่** — dialog เลือกหน่วยงานจากบอร์ด (คู่แฝดของ `BoardPersonPicker`) |
| `src/lib/boardPickerApi.ts` | `splitPickerName` เดาคำนำหน้าจาก `sex_code` · `pickerDisplayName` โชว์คำนำหน้าด้วย |
| `api/_handlers/matching-board-candidates.ts` | โหมด picker ส่ง `sex_code` เพิ่ม |
| `src/pages/follow/FollowPage.tsx` | ฟอร์มเพิ่มเป็น 3 ขั้น (คน → หน่วยงาน → เวลา) + ปุ่มเลือกหน่วยงานจากบอร์ด |
| `src/components/follow/FollowCallRoundsPanel.tsx` | แท็บ "การโทรครั้งที่ 1/2/3" กดแล้ว visual เปลี่ยนตาม + กล่องมีสีพื้นบอกว่าควรทำอะไร |

**เจ้าของสั่ง 18 ส.ค. (บ่าย)**
> *"เลือกจากบอร์ด มันไม่มีคำนำหน้าหรอ"* · *"หน่วยงานก็ทำเหมือนปุ่มเลือกชื่อจากบอร์ด"* ·
> *"การโทรของงาน Follow ทำเป็น Visual Control แบ่งสีให้ชัด เห็นสีแล้วรู้เลยว่าควรทำอะไร"* ·
> *"ทำเป็นแบบช่องแบ่งกด การโทรครั้งที่1 2 3 กดแล้ว visual เปลี่ยนตาม"* ·
> *"เลือกชื่อจากบอร์ดแล้ว กด next ไปเลือกหน่วยงาน จากนั้นกด next แล้วตั้งเวลา"*

**กับดัก**

* 🔴 **iRecruit ไม่มีคอลัมน์คำนำหน้า** — วัดจริง: `fname` มีคำนำหน้าติดมาแค่ **17/49,524 คน**
  จึงต้องเดาจาก `sex_code` (M→นาย · F→นางสาว) · ผู้หญิงอาจเป็น "นาง" ฟอร์มต้องแก้ได้เสมอ
  · **คำนำหน้าที่ติดมากับชื่อชนะเพศเสมอ** ไม่งั้นทับของจริง
* 🔴 **คีย์หน่วยงานคือ `site_code`** ไม่ใช่เลขที่ใบขอ (เลขที่ใบซ้ำกันได้) · ใบที่ไม่มีรหัสไซต์ตกไป
  · งาน Follow เก็บหน่วยงานเป็น **snapshot ข้อความ** ไม่ใช่ FK — ห้ามเปลี่ยนเป็น FK
* 🔴 **ขั้นที่ 2 (หน่วยงาน) ข้ามได้เสมอ** — งาน Follow บางเรื่องไม่ผูกหน่วยงาน ห้ามใส่ด่านบังคับ
* 🔴 **ด่านตรวจอยู่ที่ `followWizard.ts` ที่เดียว** ทั้งปุ่มถัดไปและตอนกดบันทึก
  · กดบันทึกแล้วไม่ผ่านต้อง**เด้งกลับไปขั้นนั้น** (`firstIncompleteStep`) ไม่ใช่ error ลอย ๆ
* 🔴 **เลข 0 ห้ามติดสีร้อน** — ทุกช่องที่นับได้ 0 ตกเป็นเทา ไม่งั้นคนไล่ดูของที่ไม่มีจริง
  · ลำดับความเร่งด่วนของสัญญาณรอบ: แดง(ไม่ไป) > เหลือง(โทรไม่ติด) > น้ำเงิน(กำลังโทร) >
  เทา(รอโทร) > เขียว(ไม่มีค้าง) · `all = 0` ชนะทุกอย่าง
* ช่อง 7 ถังยัง **ซ้อนกันได้** (สองแกน) เหมือนเดิม — บวกไม่เท่า "ทั้งหมด" ไม่ใช่บั๊ก

### รอบ 18 ส.ค. 2569 (บ่าย-4) — Follow: กันบันทึกก่อนถึงขั้นตั้งเวลา + ถอด dropdown หน่วยงาน

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/follow/FollowPage.tsx` | `submit()` เพิ่มด่าน `step !== 3 = ห้ามบันทึก` (Enter กลายเป็นปุ่มถัดไป) · ช่องหน่วยงานจาก `<select>` เป็น `<input>` ข้อความ |

**เจ้าของแจ้ง 18 ส.ค.**
> *"พอเลือกหน่วยงานแล้วจะกดไปตั้งเวลามันบันทึกเองเลย"* · *"พอเลือกหน่วยงานแล้วให้ชื่อมาอยู่ในช่องหน่วยงาน เอา Dropdown ออก"*

**🔴 กับดักที่ทำให้พัง (ต้องรู้ก่อนเพิ่มขั้นตอนในฟอร์มอื่น)**

ฟอร์ม HTML **ยิง submit เองเมื่อกด Enter ในช่องใด ๆ** — รวมตอนเลือก `<select>` ด้วยคีย์บอร์ด
และขั้น "ตั้งเวลา" **ผ่านด่านตั้งแต่ยังไม่แตะ** เพราะค่าเริ่มต้นของเวลาคือ "ตอนนี้"
(`nowForInput()`) → `firstIncompleteStep` เห็นว่าครบทุกขั้นแล้วเลยบันทึกทันทีตั้งแต่ยืนอยู่ขั้น 2
**ยืนยันด้วยการยิงจริง**: ดัก `POST /api/follow` แล้ว `form.requestSubmit()` ตอนอยู่ขั้น 2
→ ก่อนแก้ยิง 1 ครั้ง · หลังแก้ 0 ครั้ง และเด้งไปขั้น 3 แทน · กดปุ่มบันทึกที่ขั้น 3 ยังยิงปกติ

* 🔴 **ด่านต้องเช็ค "อยู่ขั้นไหน" ไม่ใช่ "ข้อมูลครบหรือยัง"** — ขั้นที่มีค่า default อยู่แล้ว
  จะทำให้ด่านแบบเช็คความครบใช้ไม่ได้เลย
* ช่องหน่วยงานเป็น input แล้ว **พิมพ์เองได้** — พิมพ์เองเมื่อไหร่ `site_code` ถูกล้างทันที
  (รหัสไซต์มาจากการ "เลือกจากบอร์ด" เท่านั้น ไม่งั้นได้ชื่อหน่วยงานหนึ่งกับรหัสของอีกที่)

### รอบ 18 ส.ค. 2569 (เย็น) — Dashboard: ป้ายล่วงหน้า/ฉุกเฉิน · กราฟเร่งด่วน · ถอด Life Cycle

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/requestLeadKind.ts` | **pure · ใหม่** — กฎเดียวของ ล่วงหน้า/ฉุกเฉิน/ย้อนหลัง (เทสต์ 9 ข้อ) ใช้ร่วมทั้งหน้าเว็บและ API |
| `src/lib/dashboard/leadKindBreakdown.ts` | **pure · ใหม่** — แยกยอด ทั้งหมด/ฉุกเฉิน/ล่วงหน้า + ด่านเทียบกับการ์ด (เทสต์ 10 ข้อ · mutation 6/6) |
| `src/components/dashboard/analytics/DashboardLeadKindChart.tsx` | **ใหม่** — กราฟแท่งใต้การ์ด KPI กดแท่งเพื่อดูรายใบ |
| `src/lib/jobUrgency.ts` | เลิกเขียนเส้นแบ่ง `< 7` เอง → เรียก `requestLeadKindFromDays` |
| `api/_lib/siamrajSqlServerThroughput.ts` | ส่ง `requiredDate` + `leadKind` มากับทุกแถว |
| `src/lib/dashboard/cohortDrillDown.ts` | แถว drill-down มี `leadKind` / `requiredDate` |
| `src/lib/dashboard/dashboardDetailDialog.ts` | บรรทัดรองขึ้น **ล่วงหน้า/ฉุกเฉิน** เป็นคำแรก + วันที่ต้องการ |
| `src/components/dashboard/analytics/DashboardChartSection.tsx` | **ถอด** `DashboardLifecycleBoard` + `DashboardLifecycleMonthlyPanel` |
| `src/pages/dashboard/SupervisorDashboard.tsx` | `cohortScope` memo (แหล่งเดียวของ การ์ด/กราฟ/drill) + `handleLeadKindClick` |

**เจ้าของสั่ง 18 ส.ค. (เย็น)**
> *"กดดูแล้วโชว์หน่วยงาน บอกหน่อยว่าเป็นงานล่วงหน้า หรือ ฉุกเฉิน"* ·
> *"Life Cycle ตามประเภทใบขอ เอาออก"* ·
> *"เพิ่มกราฟให้หน่อยเพื่อดูว่าทั้งหมดเท่าไหร่ ฉุกเฉิน ล่วงหน้าเท่าไหร่"* ·
> *"ข้อมูลต้องเปลี่ยนตาม Filter"* · *"เช็คด้วยว่าข้อมูลตรง ถูกต้องไหม"*

**ตรวจกับ ERP แล้ว (18 ส.ค.)** — ยิง SQL ตรงเข้า `st_request_head` ด้วยกฎเดียวกัน
ช่วง 2024-05-01 → 2026-08-31: ย้อนหลัง 4,967/3,320 · ฉุกเฉิน 1,332/1,179 · ล่วงหน้า 1,253/1,107
รวม **7,552 อัตรา · 5,606 ใบ** — ตรงกับทั้งกราฟและการ์ด「เข้ามา」ทุกตัวเลข
เปลี่ยนเป็นเดือนนี้ได้ 109/100 · กรอง BU=LBD ได้ 75/74 ตรงกับการ์ดทั้งคู่

**กับดัก**

* 🔴 **เส้นแบ่ง 7 วันต้องอยู่ที่ `requestLeadKind.ts` ที่เดียว** — ก่อนหน้านี้ `jobUrgency.ts`
  เขียนเอง ถ้าฝั่ง API เขียนซ้ำอีกชุดจะเพี้ยนกันโดยไม่มีใครรู้
* 🔴 **ไม่รู้วันใดวันหนึ่ง = ล่วงหน้า ห้ามเดาเป็นฉุกเฉิน** — ใบที่ ERP กรอกวันไม่ครบ
  จะไปโป่งอยู่ในถังฉุกเฉินทั้งกอง (ตรงกับพฤติกรรมเดิมของ `computeJobUrgency`)
* 🔴 **กราฟ/การ์ด/drill ต้องใช้ `cohortScope` ตัวเดียวกัน** — ช่วงวันและตัวกรอง BU
  ถ้าคำนวณแยกกันสามที่ จะมีวันหนึ่งที่เลขไม่ตรงกันแบบเงียบ ๆ
  · `leadKindMismatchNote` เทียบกับการ์ดทุกครั้ง ไม่ตรงเมื่อไหร่ขึ้นข้อความบนกราฟทันที
* Life Cycle สองแผงถูกถอด **แต่ไฟล์ component ยังอยู่** เป็นทางถอย · `data.lifecycleBoard`
  ยังถูกคิดใน `buildDashboardData` และมีเทสต์คุม (แพตเทิร์นเดียวกับ `priorityWorkQueue`)
* ⚠️ เจอระหว่างตรวจ: **401 ทั้งหน้าแล้วทุกการ์ดเป็น 0** = cookie หมดอายุ (~30 นาที)
  ไม่ใช่โค้ดพัง — re-auth ก่อนไล่โค้ดเสมอ

### รอบ 18 ส.ค. 2569 (เย็น-2) — Follow: บันทึกเฉพาะกดปุ่ม ไม่ใช่ Enter

เจ้าของย้ำ flow ที่ต้องการ: **1 เพิ่มชื่อ → 2 กดถัดไป → 3 เพิ่มหน่วยงาน → 4 กดถัดไป →
5 เพิ่มวัน/เวลา → 6 กดบันทึก** · "หลังจากกดบันทึกถึงค่อยส่งให้ Lumos"

* `src/pages/follow/FollowPage.tsx` — เพิ่ม `onKeyDown` ที่ `<form>` กัน **Enter ไม่ให้ submit**
  (ยกเว้น textarea) · บันทึกเกิดเฉพาะกดปุ่ม "บันทึก + ส่ง AI โทร" เท่านั้น
* 🔴 เดิมกันแค่ "ยังไม่ถึงขั้น 3 ห้ามบันทึก" แต่ **พอถึงขั้น 3 แล้ว Enter ในช่องเวลายัง
  บันทึกเองก่อนกดปุ่ม** — เจ้าของนับว่าเป็น "บันทึกเอง" เพราะข้อ 6 คือกดปุ่ม
  วัดจริง: Enter ทุกขั้น posts=0 · กดปุ่มบันทึก posts=1 · ปุ่มถัดไปยังเดินขั้นปกติ
* การส่ง Lumos อยู่ใน POST handler หลัง `createFollowEntry` สำเร็จ + เฉพาะโหมด auto
  (`follow.ts:276`) — "กดบันทึกถึงค่อยส่ง" เป็นจริงอยู่แล้วโดยโครงสร้าง

### รอบ 18 ส.ค. 2569 (เย็น-3) — Follow: ปิดทุกทางที่ "บันทึกเอง" + ลบข้อมูลทดสอบ

เจ้าของโดนซ้ำแม้แก้สองรอบแล้ว (*"กด next ปุ๊บ มันบันทึกแล้วส่งไปเอง"*) — เข้าคิวโทรจริง
4 ครั้ง (auto เปิดแล้ว) โชคดียกเลิกทัน `delivery_count=0` ทุกแถว ไม่มีสายหลุด

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/follow/FollowPage.tsx` | ฟอร์ม `onSubmit={preventDefault}` **ไม่รับ submit เลย** — บันทึกผูกกับ onClick ของปุ่มบันทึกที่เดียว · `goToStep()` จับเวลาเข้าขั้น 3 แบบ synchronous · ด่านคลิกซ้อน 800ms |
| `src/lib/followWizard.ts` | `FOLLOW_SUBMIT_GUARD_MS` + `isSubmitTooSoonAfterStep3` (เทสต์คุมขอบ) |

**ต้นเหตุตัวที่สาม (หลัง implicit-submit และ Enter): คลิกซ้อนตำแหน่งปุ่ม**
กด "ถัดไป" ที่ขั้น 2 แล้วปุ่ม "บันทึก + ส่ง AI โทร" มาเรนเดอร์บริเวณเดิมทันที —
คลิกที่สองของคนกดเร็วตกบนบันทึกพอดี (ทับหรือไม่ขึ้นกับความสูงเนื้อหา/จอมือถือ)

**กับดักที่เจอระหว่างแก้ — สำคัญกับการเทสต์ครั้งหน้า**

* 🔴 **จับเวลาเข้าขั้นต้องทำตอนคลิก (ใน goToStep) ไม่ใช่ใน useEffect** — effect วิ่งหลัง paint
  คลิกซ้อนที่เร็วกว่าเฟรมแรกเห็น ref เป็นค่าเก่า ด่านเวลาไม่ทำงาน
* 🔴 **เทสต์จับเวลาในเบราว์เซอร์ที่ pane ถูกซ่อน เชื่อ setTimeout ไม่ได้** — โดน throttle
  `await 60ms` จริง ๆ ผ่านไป 4.4 วิ ทำให้เทสรอบแรก "พิสูจน์ผิด" ว่าด่านพัง
  ใช้ `performance.now()` วัด gap จริงเสมอ · วัดแล้ว: คลิกซ้อน 16ms → ถูกกัน ·
  คลิกหลัง 900ms → บันทึกปกติ
* 🔴 ตรวจ bundle บน prod: หน้าเป็น **lazy chunk แยก** (`assets/FollowPage-*.js`) —
  grep หา marker ใน `index-*.js` อย่างเดียวจะสรุปผิดว่าโค้ดเก่า
* ข้อมูลทดสอบทั้งหมดถูกลบแล้ว (8 entries + 6 แถวคิว · สำรองไว้ที่ scratchpad ก่อนลบ)

### รอบ 18 ส.ค. 2569 (เย็น-4) — Follow: เพิ่มรอบจากกล่องแก้ไข + สีกล่องชัดขึ้น

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/followExtraRounds.ts` | **pure · ใหม่** — แปลงช่องเวลาเป็นรอบใหม่ + กันซ้ำ + เตือนเวลาอดีต (เทสต์ 14 · mutation 7/7) |
| `src/components/follow/FollowEditDialog.tsx` | บล็อก "รอบโทรของคนนี้" — โชว์รอบที่มีอยู่ · เพิ่มได้ถึง 5 รอบ · ปุ่มบอกจำนวนที่จะเพิ่ม |
| `src/pages/follow/FollowPage.tsx` | ส่ง `siblings` (จับคู่ด้วย **เบอร์ + เรื่อง**) ให้กล่องแก้ไขรู้ว่ามีรอบอะไรอยู่แล้ว |
| `src/lib/followRoundVisual.ts` | `bucketVisual` คืน `muted` แทนการเปลี่ยนเป็นเทา · `roundSignal` รอบว่างคืน `text: ''` |
| `src/components/follow/FollowCallRoundsPanel.tsx` | ช่องมีจุดสี + ป้ายสีประจำช่อง · ช่องว่างจางลงแทนที่จะเทา · ไม่เรนเดอร์แถบสัญญาณเมื่อรอบว่าง |

**เจ้าของสั่ง 18 ส.ค. (เย็น)**
> *"ตรงแก้ไข เพิ่มรอบ ปรับเวลาอะไรต่างๆ ได้ด้วย เผื่อบางทีต้องโทร 2 รอบ แต่ดันเผลอตั้งไปรอบเดียว"* ·
> *"ยังไม่มีใครอยู่รอบนี้ เอาออก"* · *"ตรง ทั้งหมด รอโทร กำลังโทร ฯลฯ ทำเป็น Visual แบบแบ่งสีให้หน่อย"*

**กับดัก**

* 🔴 **หนึ่งรอบ = หนึ่งรายการ** — คิวโทรผูกกับรายการ 1:1 "เพิ่มรอบ" จึงต้อง `createFollowEntry`
  ใหม่ที่ลอกคน/เรื่อง/หน่วยงานมา · ห้ามแก้ให้รายการเดียวถือหลายเวลา (พังทั้งแผงรอบและการนับผล)
* 🔴 **สร้างรอบใหม่หลัง PATCH สำเร็จเท่านั้น** — แก้ล้มแล้วยังสร้างต่อ = รอบใหม่ใช้ข้อมูลเก่า
  · ยิงทีละรอบ ล้มกลางทางต้องบอกว่าสำเร็จไปกี่รอบ (คนกดซ้ำแล้วได้รอบซ้อน)
* 🔴 **เทียบเวลาซ้ำระดับนาที** — `datetime-local` บางเบราว์เซอร์ส่งวินาทีมาด้วย ไม่ตัดทิ้งก่อน
  = เวลาเดียวกันเล็ดลอดเป็นสองสาย
* 🔴 **กลับคำเรื่อง "0 = เทา"** — เดิม (เย็น-1) ทำให้ช่องว่างเป็นเทาทั้งหมด พอข้อมูลน้อย
  ทั้งแถบเทาจนแยกไม่ออกว่าช่องไหนคืออะไร → เปลี่ยนเป็น **คงสีประจำช่องเสมอ แต่ `muted`**
  (จุด/ป้าย/เลข จางลง · พื้นไม่ติดสี · ไม่ขึ้นกรอบหนา) — ยังกันของเดิมคือกล่องว่างไม่เด่นเท่ากล่องที่มีของ
* `siblings` จับคู่ด้วยเบอร์+เรื่อง ไม่ใช่เบอร์อย่างเดียว — คนเดียวถูกตามหลายเรื่องพร้อมกันได้
* ข้อมูลทดสอบถูกลบหมดแล้ว (สำรองที่ scratchpad) · ไม่มีสายหลุดถึง Lumos (`delivery_count=0` ทุกแถว)

### รอบ 18 ส.ค. 2569 (เย็น-5) — Dashboard: กราฟ+การ์ดตามตัวกรองเจ้าหน้าที่

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/dashboard/throughputScope.ts` | **pure · ใหม่** — กรอง throughput ด้วยรายการเลขที่ใบ + กรองตามเจ้าหน้าที่ (เทสต์ 19 · mutation 6/6) |
| `api/_lib/siamrajUnitAssignments.ts` | `listAllUnitAssignees()` — ผู้รับผิดชอบทุกใบ (รวมใบปิด) |
| `api/_handlers/siamraj-unit-assignments.ts` | `GET ?all=1` (read-only) — **ไม่เพิ่ม route ใหม่ ยังคง 85** |
| `src/lib/siamrajUnitRequestsApi.ts` | `fetchAllUnitAssignees()` |
| `src/pages/dashboard/SupervisorDashboard.tsx` | `cohortScope` กรองครบทุกตัวกรอง · การ์ด KPI ใช้ชุดเดียวกับกราฟ |

**เจ้าของสั่ง 18 ส.ค.**
> *"เลือกเจ้าหน้าสรรหาชื่อ คิว ในเดือนนั้นมีเข้ามาเท่าไหร่ ก็เปลี่ยนตาม 25 ฉุกเฉิน/ย้อนหลัง ฉุกเฉิน ล่วงหน้า เท่าไหร่"*

**กับดัก**

* 🔴 **throughput ไม่มีข้อมูลผู้รับผิดชอบ** (มาจาก ERP · assignment อยู่ PostgreSQL)
  → กรองที่ record ตรง ๆ ไม่ได้ ต้องกรองด้วยรายการเลขที่ใบ
* 🔴 **ห้ามสร้างรายการเลขที่ใบจาก feed อย่างเดียว** — feed มีแต่**ใบที่ยังเปิด**
  วัดจริง: "คิว" ดูแล **116 ใบ** แต่เปิดอยู่ **51** → กรองจาก feed ขาดไป 65 ใบ
  ต้องอ่านตาราง `siamraj_unit_assignments` ทั้งตาราง (`?all=1`)
* 🔴 **การ์ด KPI ต้องใช้ `cohortScope.records` ชุดเดียวกับกราฟ** — เดิมกรองแค่ BU
  ทำให้เลือก "คิว" แล้วกราฟ 54 แต่การ์ด「เข้ามา」ค้าง 7,552 (สองเลขบนจอเดียวกันขัดกันเอง)
* 🔴 **`cohortScope` ต้องประกาศก่อน `data` useMemo** — ไม่งั้น TDZ ตอน build
* "ยังไม่ถูก Assign" ตอบจากตาราง assignment ไม่ได้ (ใบที่ไม่มีแถว = ไม่ถูกมอบหมาย
  แต่เราไม่รู้ว่ามีใบอะไรบ้าง) → ถอยไปใช้ชุดจาก jobs
* ใบที่ถูกตัดออกต้องรายงานจำนวนบนกราฟ ห้ามหายเงียบ

### รอบ 18 ส.ค. 2569 (เย็น-6) — 🔴 ด่านสิทธิ์บอกผิดสาเหตุ: ใบที่ปิดแล้ว = "แผนกอื่น"

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/requestScopeMessage.ts` | **pure · ใหม่** — ข้อความแยกเหตุผล (เทสต์ 6 · mutation 4/4) |
| `api/_lib/siamrajUnitRequests.ts` | `checkSiamrajRequestScope()` คืนเหตุผล · `isSiamrajRequestInScope` เรียกต่อ |
| `api/_handlers/siamraj-unit-assignments.ts` | ใช้ตัวใหม่ทั้ง GET/POST · ถอด `OUT_OF_SCOPE` ทิ้ง |

**เคสจริงที่เจ้าของเจอ (18 ส.ค.)**
> *"คนที่เป็น Supervisor มันขึ้นว่าไม่มีสิทธิเข้าถึงแผนกอื่น ทั้งที่มันก็แผนกนั้นนะ"* ·
> *"เปิด OPL นะ OPL6901006 คนที่เปิดคือ samtiphap"*

ตรวจแล้ว: `samtipap.p` = supervisor **LBD** · ใบ `OPL6901006` → ไซต์ `67LBDL0208` = **LBD**
**ตรงกันเป๊ะ** แต่ใบเปิดมาตั้งแต่ 6 ม.ค. 2569 และ**ปิดไปแล้ว**

**ต้นเหตุ** — `isSiamrajRequestInScope` เรียก `getSiamrajUnitRequestById(id, scope)`
**โดยไม่ส่ง `includeClosed`** → ใบที่ปิด/ยกเลิกแล้วหาไม่เจอ → คืน `null` →
ด่านตีความว่า "อยู่นอกแผนก" แล้วเด้ง 403 พร้อมข้อความผิดสาเหตุ

**กับดักที่ต้องจำ**

* 🔴 **"หาไม่เจอ" ไม่เท่ากับ "ไม่มีสิทธิ์"** — ด่านที่ยุบสองเรื่องเป็นข้อความเดียว
  ทำให้ไล่ปัญหาผิดจุดหลายรอบ (สงสัย role → สงสัย token → สงสัย BU กว่าจะเจอว่าเป็นใบปิด)
* 🔴 **ต้องอ่านใบแบบ *ไม่ผูก scope* ก่อน แล้วค่อยเทียบ BU เอง** — อ่านแบบผูก scope
  จะได้ `null` เหมือนกันทั้ง "ไม่มีใบ" และ "มีแต่คนละ BU" แยกไม่ออก
* ข้อความ `other_bu` ต้องบอก **BU ของใบ + BU ของผู้ใช้ + เตือนว่าเลขนำหน้าไม่ใช่ BU**
  (OPL/LBM/SQ/PEO → LBD · LAO/LAM → LBA · DSO → DS · LMO → LM)
* ⚠️ **role ฝังอยู่ใน token อายุ 30 นาที** (`AUTH_TOKEN_TTL_SECONDS`) — เปลี่ยน role
  ในฐานแล้วยังไม่มีผลจนกว่าคนนั้นจะ logout/login ใหม่ (ตรวจแล้วว่าไม่ใช่ต้นเหตุเคสนี้
  แต่เป็นกับดักถัดไปที่จะเจอ)

**ยืนยันหลังแก้ (ยิงจริงในบทบาท supervisor LBD)**

| ใบ | ผล |
|---|---|
| `OPL6901006` (ปิดแล้ว · LBD) | อ่าน 200 · **บันทึก 200** ✓ |
| `LAO6907002` (LBA) | 403 "ใบนี้อยู่ BU LBA แต่บัญชีคุณอยู่ BU LBD · เลขนำหน้าใบ (LAO) คือรหัสแผนกที่ยื่นขอ ไม่ใช่ BU" |
| เลขมั่ว | 404 "ไม่พบใบขอนี้ในระบบ" |

### รอบ 18 ส.ค. 2569 (ค่ำ) — Follow: popup เตือนลงซ้ำ + ปฏิทินกรองรายละเอียด

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/followDuplicateGuard.ts` | **pure · ใหม่** — ซ้ำ = เบอร์เดิม (เทียบเลข 9 ตัวท้าย) + เวลาเดิมระดับนาที กับรายการที่ยังไม่ยกเลิก (เทสต์ 10 · mutation 5/5) |
| `src/pages/follow/FollowPage.tsx` | เช็คซ้ำก่อนยิงทั้งสองโหมด (เวลาเอง/ตาราง) · popup `role=alertdialog` มีปุ่ม "บันทึกเฉพาะที่ไม่ซ้ำ (N)" — **จงใจไม่มีปุ่มบันทึกซ้ำทั้งหมด** · โหมดตารางถูกหุ้มเป็น `runSchedule()` / โหมดเวลาเป็น `runTimes()` |
| `src/components/follow/FollowCallRoundsPanel.tsx` | คลิกวันบนปฏิทิน = **เลือกวัน** (ไม่ใช่เปิด popup แล้ว) → แท็บ/กล่อง/รายชื่อกรองเป็นของวันนั้น · ชิป "เฉพาะวันที่ X" กดล้างได้ · กดวันเดิมซ้ำ = ยกเลิกเลือก |

**กับดัก**

* 🔴 **เทียบเบอร์ตรง ๆ ไม่มีวันเจอ** — ฟอร์มกรอก `08x` ฐานเก็บ `+668x` ต้องเทียบเลข 9 ตัวท้าย (`phoneKey`)
* 🔴 รายการ**ยกเลิกแล้วไม่นับซ้ำ** (ยกเลิกเพื่อตั้งใหม่) แต่**ปิดงานแล้วยังนับ** (โทรไปแล้วจริง)
* โหมดตารางเช็คซ้ำจาก "รอบแรกของแต่ละวัน" เพราะแถวจริง = 1 แถว/วัน ที่เวลา rounds[0]
* ฐานตอนนี้มี**ข้อมูลจริงของผู้ใช้แล้ว** (17 รายการ active) — เทสต์เขียนต้องใช้ prefix `__test__` และลบเฉพาะ id ตัวเอง **ห้ามลบกวาด**

### 🔴 งานที่เจ้าของสั่งแล้วยังไม่ได้ทำ (สั่งค่ำ 18 ส.ค. — ทำต่อรอบหน้า)

1. **FollowEditDialog: ช่องหน่วยงานยังเป็น dropdown** — ต้องเปลี่ยนเป็นปุ่ม "เลือกหน่วยงานจากบอร์ด" + ช่องข้อความ แบบเดียวกับฟอร์มเพิ่ม (`BoardUnitPicker` มีอยู่แล้ว ใช้ซ้ำได้)
2. **ช่องเบอร์เจ้าหน้าที่ → dropdown ชื่อ+เบอร์** ทั้งฟอร์มเพิ่ม (ขั้น 2) และกล่องแก้ไข
3. **ปุ่มเพิ่มชื่อ/เบอร์เจ้าหน้าที่ — เฉพาะ supervisor ขึ้นไป** · ต้องมีที่เก็บใหม่
   (migration 099 เช่น `follow_staff_contacts`: name, phone · GET ทุกคน / POST supervisor+)
4. **ลิสต์หน้า Follow จัดกลุ่มรายคน + สรุป** — เจ้าของบอกว่าคนเดียวหลายรอบแตกหลายแถว "งงตาย"
   ต้องการการ์ดเดียวต่อคน สรุป: โทรวันไหนกี่โมง (รอบถัดไป) · หน่วยงานไหน · ใครคีย์ ·
   ติดตามวันไหนบ้าง (ทุกรอบ+สถานะ) · วันนี้เป็นการติดตามครั้งที่เท่าไหร่
   ⚠️ "เริ่มงานวันไหน" **ไม่มีฟิลด์เก็บ** — อยู่ในข้อความ topic/note ที่คนพิมพ์เอง
   ถ้าจะโชว์จริงต้องเพิ่มฟิลด์วันเริ่มงานในฟอร์ม (ถามเจ้าของก่อน)
   · จับกลุ่มใช้ `phoneKey` + topic (แพตเทิร์นเดียวกับ `siblings` ของกล่องแก้ไข)
5. **Lumos ไม่โผล่หน้าแจ้งเตือน** — ฝั่งเราส่งครบ เขาดึงแล้วไม่ขึ้น · เสนอแก้ 3 จุด:
   ตัด `::` ในรหัสอ้างอิง (ตัวรับผลต้องรองรับสองรูปแบบ!) · เวลาเป็น `+07:00` · ล่วงหน้า 10 นาที
   หรือให้ทีม Lumos เช็ค log ก่อน (`client_contact_id` = `follow::4a888663-…` 18 ส.ค. 11:58)

### รอบ 18 ส.ค. 2569 (ค่ำ-2) — เคลียร์งานค้าง 5 ข้อ + log กล่องงาน + 🔴 กดใบขอเปิดผิดบริษัท

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/follow/FollowEditDialog.tsx` | หน่วยงานเป็นปุ่ม `BoardUnitPicker` + ช่องข้อความ (ถอด `<select>` ทิ้ง) · เบอร์เจ้าหน้าที่ใช้ `StaffContactField` |
| `src/components/follow/StaffContactField.tsx` | **ใหม่** — dropdown ชื่อ+เบอร์เจ้าหน้าที่ · ปุ่มเพิ่มเฉพาะ supervisor+ · ถอยเป็นช่องพิมพ์เองเมื่อโหลดไม่ได้ |
| `src/lib/followStaffContactsApi.ts` | **ใหม่** — เส้นอ่าน/เพิ่มรายชื่อ + `matchStaffContact` (เทียบตรงตัว **ไม่ใช้ phoneKey**) |
| `api/_lib/followStaffContacts.ts` · `api/_handlers/follow-staff-contacts.ts` | **ใหม่** — GET ทุกคน / POST supervisor+ (`route 86`) |
| `migrations/099_follow_staff_contacts.sql` | **ใหม่** — `follow_staff_contacts` (name, phone) · unique = ชื่อ+เลขในเบอร์ · ⚠️ **ยังไม่ได้รันบนฐาน** |
| `src/lib/followGrouping.ts` | **ใหม่ · pure** — ยุบลิสต์เป็นการ์ดต่อคน (เบอร์ 9 ตัวท้าย + เรื่อง) · รอบถัดไป · วันนี้ครั้งที่เท่าไหร่ (เทสต์ 10) |
| `src/pages/follow/FollowPage.tsx` | ลิสต์เป็นการ์ดต่อคน (หัวการ์ดสรุป · ข้างในทุกรอบ+ปุ่มเดิมครบ) · ช่องเจ้าหน้าที่ใช้ `StaffContactField` |
| `api/_lib/lumosDispatch.ts` | `bangkokIso()` **ใหม่** · `client_contact_id` = `follow-<id>` (**ไม่มี `::`**) · เวลาเสิร์ฟเป็น `+07:00` · เผื่อล่วงหน้า **10 นาที** (เดิม 2) |
| `src/lib/unitEditLog.ts` | **ใหม่ · pure** — แปลง audit เป็น "ใครแก้อะไร" (เทสต์ 15) |
| `api/_handlers/siamraj-unit-history.ts` | **ใหม่** — `GET /api/siamraj/unit-history?request_no=` อ่าน audit แบบผูก scope BU (`route 87`) |
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | บล็อก "ประวัติการแก้ไข — ใครแก้อะไรไป" · ช่องรหัสไซต์ไม่ fallback ไปชื่อบริษัท |
| `src/lib/jobNavigation.ts` | 🔴 URL ของ **ใบขอล่วงหน้า** พก `siamraj-pre:` ไปด้วย (เทสต์ 4) |

**เจ้าของสั่ง 18 ส.ค. (ค่ำ)**
> *"เพิ่ม log การแก้ไขไว้ด้วยนะหน้ากล่องงานว่าใครแก้อะไรไป"* ·
> *"ชื่อหน่วยงานคือ อีซูซุ แต่พอกดเข้าไปดันขึ้น บริษัท ชับป์ ไลฟ์ฯ ... ลองตรวจให้หมดเลยว่ามีอันไหนที่เพี้ยนแบบนี้"*

**🔴 กดใบขอแล้วเปิดผิดบริษัท — ต้นเหตุและขอบเขตที่วัดจริง**

* ต้นเหตุ: `unitRequestPath()` ใช้ `externalId` = **เลขที่ใบเปล่า ๆ ไม่มี prefix**
  ส่วนตัวอ่านแยกใบล่วงหน้า/ใบปกติ **จาก prefix เท่านั้น** (`isPrequestId`)
  → URL พาเลขเปล่าไป = ไปอ่านตารางใบขอปกติ แล้วเจออีกใบเลขเดียวกันคนละบริษัท
* วัดจริง: ไล่ทั้ง 289 ใบบนหน้าหน่วยงาน เทียบ "ชื่อในลิสต์ vs ชื่อที่ได้จากคีย์ที่ URL ใช้"
  → **เพี้ยนใบเดียว** คือ `LBM6908001` (ล่วงหน้า = อีซูซุมอเตอร์ · ปกติ = ชับบ์ ไลฟ์ ไซต์ `69LBDL0232`)
* ยืนยันหลังแก้ (คลิกจากลิสต์จริง): URL → `/jobs/siamraj/siamraj-pre%3ALBM6908001` ขึ้น **อีซูซุ** ·
  เลขเปล่า `/jobs/siamraj/LBM6908001` ยังขึ้น **ชับบ์ ไลฟ์** ถูกต้องทั้งสองทาง
* ⚠️ **ใบขอปกติยังใช้เลขเปล่าใน URL เหมือนเดิม** — ลิงก์เก่าที่คนบันทึกไว้ต้องไม่พัง

**กับดักอื่นที่เจอรอบนี้**

* 🔴 **`persons` เป็น array ของคน ไม่ใช่ map ของช่อง** — เผลอนับเป็น "1 ช่อง" ขึ้นจอ
  ต้องโชว์ชื่อ (หรือ "N คน") · และ **สถานะทำงานต้องแปลไทย** ไม่ปล่อย `waiting_inform` ขึ้นจอ
* 🔴 **`/api/audit-logs` เป็น admin-only** — จะให้ staff ดูประวัติต้องเส้นใหม่ที่จำกัดทีละใบ
  + ผ่านด่าน BU เดียวกับใบขอ (ใช้ `checkSiamrajRequestScope` ตัวเดียวกัน บอกเหตุผลจริง)
* audit ของ **หมายเหตุเก็บแค่ after** (ไม่มี before) → บอกไม่ได้ว่าช่องไหนถูกแตะ
  โชว์เป็น "ค่าหลังแก้" ตามจริง ห้ามเดา · ส่วนผู้รับผิดชอบ/สถานะทำงานมีทั้งคู่ diff ได้
* ⚠️ **`UNIT_REQUEST_WORK_STATUS_LABELS is not defined` ที่เจอใน console เป็น HMR artifact**
  (โผล่ตอน vite hot-update ไฟล์ที่ mount อยู่) — โหลดสดไม่มี error · `unitRequestWorkStatus.ts`
  ไม่ import อะไรเลย ไม่มี cycle · **อย่าไปแก้ตามอาการ** ให้ทดสอบด้วย hard reload ก่อนเสมอ
* ฐานมี **ข้อมูลจริง 65 แถว → 13 การ์ด** (จับกลุ่มถูก) · สองการ์ดชื่อซ้ำเป็น **คนละเบอร์จริง** ไม่ใช่บั๊ก
* ไม่ได้สร้าง/ลบข้อมูล Follow ใด ๆ ระหว่างตรวจ (เปิดฟอร์มแล้วกดยกเลิก)

**⚠️ ค้างไว้ให้รอบหน้า**

* **`migrations/099` ยังไม่ได้รันบนฐาน** — classifier กัน `node scripts/migrate.mjs`
  ตอนนี้เส้น `/api/follow-staff-contacts` ตอบ 500 (`relation does not exist`) และ UI **ถอยเป็นช่องพิมพ์เองอยู่**
  รันแล้วช่องจะกลายเป็น dropdown เอง ไม่ต้องแก้โค้ด
* **ข้อ 4 ยังไม่มี "เริ่มงานวันไหน"** — ไม่มีฟิลด์เก็บ (อยู่ในข้อความ topic/note) · ต้องถามเจ้าของก่อนเพิ่มฟิลด์
* **Lumos ยังต้องรอฝั่งเขายืนยัน** — เราแก้ 3 จุดแล้ว (รหัสอ้างอิงไม่มี `::` · เวลา `+07:00` · ล่วงหน้า 10 นาที)
  แต่ยังไม่มีสายจริงพิสูจน์ว่าขึ้นหน้าแจ้งเตือนแล้ว · แถวเก่าที่ค้างคิวรูป `follow::<id>` ยังจับคู่ผลได้ (ตัวรับเทียบค่าใน payload ของแถวเอง)

### รอบ 18 ส.ค. 2569 (ค่ำ-3) — Follow: dropdown เรื่อง/เจ้าหน้าที่รายวัน · หน่วยงานครบ · คำปิดงานชุดใหม่

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/100_follow_topics.sql` | **ใหม่** — `follow_topics` (name, sort_order) + seed 3 เรื่อง · **รันบนฐานแล้ว** |
| `migrations/101_follow_outcome_new_set.sql` | **ใหม่** — CHECK รับทั้งคำใหม่ (`went/arrived/cancelled/leave/postponed`) และคำเก่า · **รันบนฐานแล้ว** |
| `api/_lib/followTopics.ts` · `api/_handlers/follow-topics.ts` | **ใหม่** — GET ทุกคน / POST supervisor+ (`route 88`) |
| `src/lib/followTopicsApi.ts` · `src/components/follow/TopicField.tsx` | **ใหม่** — dropdown เรื่อง + แคชโหลดร่วม |
| `src/components/follow/FollowMasterSelect.tsx` | **ใหม่** — ตัวกลางของช่อง "เลือกจากลิสต์ที่แก้เองได้" ใช้ร่วมทั้งเรื่องและเบอร์เจ้าหน้าที่ |
| `src/components/follow/StaffContactField.tsx` | เขียนใหม่บน `FollowMasterSelect` · รับ `label` (มีหลายตัวในหน้าเดียว) |
| `src/lib/followOutcome.ts` | แยก **ชุดที่ให้เลือก** (5 คำใหม่) ออกจาก **ชุดที่อ่าน/รับได้** (ใหม่+เก่า) |
| `src/components/follow/FollowCompleteControls.tsx` | ปุ่มเดียว "เสร็จสิ้น" → กางให้เลือก 5 คำ · ถอด "เหตุอื่น…" ทิ้ง |
| `api/_lib/siamrajSqlServerUnits.ts` | **ใหม่** — หน่วยงานทั้งชุดตั้งแต่ปี 2567 (ผูก department scope) |
| `api/_handlers/siamraj-unit-requests.ts` | `?units=1` (read-only · **ไม่เพิ่ม route**) |
| `src/lib/boardUnitPicker.ts` | `mergeBoardUnitOptions()` — รวมชุดละเอียด(ใบเปิด) + ชุดครบ (เทสต์ 6) |
| `src/components/follow/BoardUnitPicker.tsx` | รับ `units` ที่ merge แล้ว (เลิกรับ `jobs`) · ป้าย "ไม่มีใบขอเปิด" + วันที่ใบขอล่าสุด |
| `api/_lib/boardCandidatesSql.ts` · `api/_handlers/matching-board-candidates.ts` | ส่ง `is_informed` ออกมา · **picker เลิก `excludeInformed`** |
| `src/components/follow/BoardPersonPicker.tsx` | ป้าย "แจ้งเข้าแล้ว" |
| `src/pages/follow/FollowPage.tsx` | เบอร์ จนท **ย้ายจากขั้น 2 → ขั้น 3** เป็นรายรอบ/รายวัน · dropdown เรื่องที่ขั้น 1 |

**เจ้าของสั่ง 18 ส.ค. (ค่ำ-3) + คำตอบที่เคาะแล้ว**
> หน้า1: dropdown เรื่องที่จะให้โทร · กล่องเลือกพนักงานเพิ่ม Done/Drop ·
> หน้า2: หน่วยงานขึ้นไม่ครบ · หน้า3: เบอร์ จนท ต้องอยู่หน้าวันเวลา มี dropdown ใต้แต่ละวัน ·
> เหลือปุ่ม เสร็จสิ้น/แก้ไข/ยกเลิก และเสร็จสิ้นให้เลือก ไปแล้ว/ถึงแล้ว/ยกเลิก/ลา/เลื่อน

| คำถาม | เจ้าของเลือก |
|---|---|
| ที่มาของตัวเลือก "เรื่อง" | **เก็บในฐาน แก้เองได้** (+ พิมพ์เองได้) |
| "เพิ่ม Done Drop" หมายถึงอะไร | **เอาคนที่แจ้งเข้าแล้วกลับมา + ติดป้าย** |
| หน่วยงานให้ครบถึงไหน | **ทุกหน่วยงานที่มีใบขอตั้งแต่ปี 2567** |
| คำปิดงาน | **ใช้ชุดใหม่แทน · ของเก่าคงเดิม ไม่แปลงข้อมูล** |

**🔴 กับดักที่เจอรอบนี้ — อ่านก่อนแตะของที่เกี่ยวข้อง**

* 🔴 **โปรเจกต์นี้มี tsconfig 3 ตัว ไม่ใช่ 2** — `app` (src) · **`api` (api/)** · root
  ผมรันแค่ 2 ตัวแล้วลืม import `listSiamrajUnits` หลุดไปถึงเบราว์เซอร์ (500 "is not defined")
  **ต้องรันครบสามตัวเสมอ** ตามที่ SESSION-HANDOFF เขียนไว้แต่แรก
* 🔴 **ถัง Done/Drop อยู่ในกล่องเลือกคนตั้งแต่ 10 ส.ค. แล้ว** — ที่หายคือคนที่ `is_inform='Y'`
  ถูก `excludeInformed` ตัด (Done 51 จาก 235) · เจอต้นเหตุจากการวัดเทียบ `picker=1` กับ
  `people=1` ไม่ใช่จากการอ่านโค้ดเฉย ๆ · ⚠️ การกลับคำนี้มีผล**เฉพาะกล่องของหน้า Follow**
  เลนสรรหา/AI matcher ต้องยังตัดคนแจ้งเข้าแล้วอยู่ (มีเทสต์คุม)
* 🔴 **เทสต์ที่อ่านไฟล์เป็นข้อความต้องตัดคอมเมนต์ก่อน** — เจอสองครั้งในรอบเดียว:
  คอมเมนต์ไทยที่มีวงเล็บทำ parser ของ `followOutcome.test.ts` หยุดกลางลิสต์ ·
  และคอมเมนต์ที่เล่าว่า "เลิกใช้ excludeInformed" ทำ `not.toContain` ของ
  `boardPickerScope.test.ts` แดงทั้งที่โค้ดถูก → ใส่ `stripComments()` ไว้ทั้งสองที่แล้ว
* 🔴 **โหมดเวลาเอง: `times` ถูก dedup+sort แล้ว index ไม่ตรงกับ `staffPhones` อีก**
  ต้องแมป **เวลา → เบอร์** ก่อนยิง ไม่งั้นเบอร์ไปโผล่ผิดรอบเงียบ ๆ (ไม่มีอะไรบนจอบอก)
  · เพิ่ม/ลบรอบต้องขยับอาร์เรย์เบอร์คู่กันเสมอ
* 🔴 **ช่องเลือกจากลิสต์มีได้ถึง 31 ตัวในหน้าเดียว** (ตัวละวัน) — ต้องแคชการโหลดระดับโมดูล
  ไม่งั้นเปิดฟอร์มครั้งเดียวยิง 31 request · วัดจริงหลังแคช: 6 ช่อง → 2 request
* ⚠️ **`follow_entry` เป็นโหมด `auto`** — สร้างรายการผ่าน API = เข้าคิวแล้วโทรออกจริงทันที
  ตรวจปุ่มปิดงานจึงต้อง **insert แถวตรงในฐาน** (ไม่มีแถวคิว = ไม่มีทางมีสายหลุด)
  แล้วค่อยยิง PATCH จริงเพื่อพิสูจน์ว่า CHECK รับคำใหม่
* ⚠️ ช่อง `topic` **ไม่ผูก FK** กับ `follow_topics` โดยตั้งใจ — ต้องพิมพ์เรื่องใหม่เองได้
  และรายการเก่าใช้ข้อความอิสระ · ตารางนี้เป็น "ตัวช่วยกรอก" ไม่ใช่ "ตัวบังคับค่า"

**ยืนยันด้วยการยิง/กดจริง (18 ส.ค. ค่ำ-3)**

| สิ่งที่ตรวจ | ผล |
|---|---|
| `/api/follow-topics` | 200 · 3 เรื่องตั้งต้น |
| กล่องเลือกคน | **760 คน** (เดิม 560) · ป้าย "แจ้งเข้าแล้ว" ขึ้นจริง 12 แถวในหน้าแรก |
| กล่องเลือกหน่วยงาน | **1,048 หน่วยงาน** (เดิม 152) · พวกที่มีใบขอเปิดขึ้นก่อน |
| ขั้น 3 โหมดเวลาเอง | 2 รอบ → ช่องเบอร์ 2 ช่องคู่กัน |
| ขั้น 3 โหมดตาราง | 20–22 ส.ค. → ช่องเบอร์ 3 ช่อง (ตัวละวัน) |
| PATCH ปิดงานคำใหม่ | `went` / `arrived` / `postponed` → **200 ทั้งสาม** · ค่ามั่ว → 400 (ไม่ใช่ 500) |
| ปุ่มบนแถวที่ยังไม่ปิด | เหลือ **แก้ไข / เสร็จสิ้น / ยกเลิก** พอดี · กดเสร็จสิ้นได้ 5 คำครบ |
| ข้อมูลทดสอบ | ลบหมด (6 แถว) · ฐานเหลือ 0 |

**ล้างข้อมูลทดสอบของหน้า Follow (เจ้าของสั่ง: *"เจ้าหน้าที่ก็ทดสอบ"*)**

* ลบทั้ง **65 รายการ + 65 แถวคิว** · สำรอง JSON ไว้ก่อนลบ (ที่ scratchpad ของเซสชัน)
* 🔴 **ลำดับสำคัญ: ยกเลิกคิวที่ยัง pending ก่อน แล้วค่อยลบ** — ปล่อยคิวค้างไว้
  Lumos ดึงไปโทรหาคนจริงหลังรายการหายแล้ว และผลที่ส่งกลับจะจับคู่ไม่ได้ (orphan)
  วัดจริงตอนลบ: pending 3 แถว ถูกยกเลิกก่อนลบ
* ทำในทรานแซกชันเดียว (ล้มกลางทาง rollback ข้อมูลอยู่ครบ)

### รอบ 18 ส.ค. 2569 (ค่ำ-4) — ปฏิทินเป็นไอคอน + กล่องจัดการเรื่องบนหน้า Follow

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/follow/FollowCallRoundsPanel.tsx` | ปุ่มปฏิทินการโทร → **ไอคอนอย่างเดียว** (ติดสีเมื่อกำลังกรองวัน) · รีเฟรชก็เป็นไอคอนให้เข้าชุด · **แผง 3 รอบ/7 ถังคงไว้** (เจ้าของเลือก) |
| `src/components/follow/TopicManager.tsx` | **ใหม่** — กล่องจัดการ "เรื่องที่จะให้โทรติดตาม" บนหน้า Follow (list + เพิ่ม supervisor+) · collapsible |
| `src/components/follow/FollowMasterSelect.tsx` | เพิ่ม prop `reloadSignal` — โหลดลิสต์ใหม่เมื่อมีคนเพิ่มค่าจากที่อื่น |
| `src/components/follow/TopicField.tsx` · `FollowEditDialog.tsx` | ส่ง `reloadSignal` ต่อ |
| `src/pages/follow/FollowPage.tsx` | `topicsRev` bump เมื่อ TopicManager เพิ่มเรื่อง → dropdown ฟอร์ม/กล่องแก้ไขอัปเดตสด |

**เจ้าของสั่ง 18 ส.ค. (ค่ำ-4) + คำตอบที่เคาะแล้ว**
> *"ปฏิทินการโทรเปลี่ยนเป็นแค่โลโก้ปฏิทิน เหมือน Filter วันที่"* · *"เรื่องที่จะให้โทรติดตาม
> สร้างตัวเพิ่มข้อมูลไว้ในหน้า Follow นั่นแหละ"*

| คำถาม | เจ้าของเลือก |
|---|---|
| แผง 3 รอบ/7 ถัง | **เก็บแผงไว้ แค่ทำปุ่มปฏิทินเป็นไอคอน** (ไม่ถอดแผง · ไม่กรองลิสต์ข้างล่าง) |
| ตัวเพิ่มเรื่อง | **กล่องจัดการเรื่องบนหน้า Follow** |

**กับดัก**

* 🔴 **dropdown ในฟอร์มโหลดครั้งเดียวตอน mount** — เพิ่มเรื่องจากกล่องจัดการแล้วต้องมี
  `reloadSignal` bump ไม่งั้นเรื่องใหม่ไม่โผล่จนกว่าจะรีเฟรชหน้า (createFollowTopic
  ล้างแคช · reloadSignal สั่งให้ `FollowMasterSelect` โหลดซ้ำ) · วัดจริง: เพิ่มเรื่องแล้ว
  โผล่ใน dropdown **สด** ไม่ต้องรีโหลด
* ⚠️ `TopicManager is not defined` ใน console = **HMR artifact เดิม** (โผล่ตอน vite
  hot-update ก่อน import ลง) — hard reload แล้วหายเกลี้ยง · อย่าแก้ตามอาการ
* ข้อมูลทดสอบ (`__test__` topic) ลบทิ้งแล้ว · ฐานเหลือ 3 เรื่องตั้งต้น

### รอบ 18 ส.ค. 2569 (ค่ำ-5) — ปุ่มเพิ่มย้ายข้างปฏิทิน + ตารางสรุปรายเดือน (คน × วัน)

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/follow/FollowMasterSelect.tsx` | **ถอดส่วนเพิ่มค่าออกทั้งหมด** — เหลือ dropdown + พิมพ์เอง (การเพิ่มย้ายไป dialog) |
| `src/components/follow/FollowMasterManagerDialog.tsx` | **ใหม่** — dialog จัดการลิสต์กลาง (list + เพิ่ม) ใช้ร่วมทั้งเรื่องและเจ้าหน้าที่ · โหลดใหม่ทุกครั้งที่เปิด |
| `src/components/follow/TopicManager.tsx` | **ลบทิ้ง** (ของ ค่ำ-4 — ถูกแทนด้วยปุ่ม+dialog ข้างปฏิทิน · เอาออก = เอาออกให้สุด) |
| `src/components/follow/FollowCallRoundsPanel.tsx` | prop `headerExtras` — ที่วางปุ่มข้างไอคอนปฏิทิน (หน้าแม่คุมสิทธิ์+ถือ dialog เอง) |
| `src/pages/follow/FollowPage.tsx` | ปุ่ม "เพิ่มเรื่อง/เพิ่มเจ้าหน้าที่" ข้างปฏิทิน (**supervisor+ เท่านั้น**) · `contactsRev` คู่กับ `topicsRev` · สวิตช์มุมมอง **การ์ด/ตารางเดือน** |
| `src/lib/followMonthGrid.ts` | **ใหม่ · pure** — ตารางเดือน คน × วัน (เทสต์ 10) · สีของวัน = ของแรงสุดชนะ (แดง>เหลือง>เขียว>ฟ้า>เทา) |
| `src/components/follow/FollowMonthGrid.tsx` | **ใหม่** — ตารางแบบ HTML ที่เจ้าของส่งมา: sticky คอลัมน์ชื่อ · หัวคอลัมน์ตัวย่อวัน+เลขวัน · อาทิตย์ tint · ช่องกดได้เปิดรายละเอียด · เลื่อนเดือนได้ · มี legend |

**เจ้าของสั่ง 18 ส.ค. (ค่ำ-5)**
> *"เพิ่มเรื่อง ย้ายไปไว้ข้างๆปฏิทินแล้วทำให้เพิ่มได้เฉพาะ supervisor"* ·
> *"เพิ่มเจ้าหน้าที่ เปลี่ยนเป็นเพิ่มชื่อ เบอร์โทรเจ้าหน้าที่ เอาไปไว้ข้างๆปฏิทิน"* ·
> *"หน้าสรุปของ Follow อยากได้แบบ [ตารางมอบหมายงาน คน × วัน] ช่วยคิดให้มันเข้ากับหน้านี้"*

**กับดัก**

* 🔴 **dev-role cookie อายุ ~30 นาที** — ตรวจงานยาว ๆ แล้วหน้าเด้งเป็น login เงียบ ๆ
  (element หาไม่เจอทั้งที่โค้ดถูก) เช็ค URL/เนื้อหาก่อนสรุปว่าโค้ดพัง แล้วยิง dev-role ใหม่
* สีช่องตาราง = **ของแรงสุดของวันชนะ** (ตารางมีไว้กวาดตาหาปัญหา ไม่ใช่โชว์ค่าเฉลี่ย) ·
  วันที่มีแต่รอบยกเลิก = จาง (muted) · เทียบวันแบบเวลาไทย (23:30Z = วันถัดไปของไทย — มีเทสต์)
* แถวตาราง = กลุ่มเดียวกับการ์ด (เบอร์ 9 ตัวท้าย + เรื่อง) และใช้ `filtered` ชุดเดียวกัน
  — สองมุมมองห้ามเลขไม่ตรงกัน
* ตรวจจริงครบ: ปุ่มสองตัวอยู่ container เดียวกับไอคอนปฏิทิน · เพิ่มเรื่องจาก dialog แล้ว
  dropdown ในฟอร์มอัปเดตสด · **staff เห็นปุ่มหาย + POST โดน 403 ทั้งสองเส้น** ·
  ช่องเขียว (went) กดแล้วเห็นรายละเอียด · อาทิตย์ 5 คอลัมน์ (2/9/16/23/30 ตรงตัวอย่าง)
* ข้อมูลทดสอบ (4 แถว follow + 1 topic) ลบหมดแล้ว · ฐานเหลือ 0 รายการ / 3 เรื่องตั้งต้น

### รอบ 18 ส.ค. 2569 (ค่ำ-6) — แยกแท็บสถานะ + ปุ่ม Filter ประจำวัน

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/followListFilter.ts` | **ใหม่ · pure** — จำแนกแท็บ (`followLifecycleTab`) + filter วันที่/ช่วงเวลา/เจ้าของงาน + นับแท็บ + list เจ้าของ (เทสต์ 13) |
| `src/pages/follow/FollowPage.tsx` | แท็บ 4 อัน (กำลังตาม/สำเร็จ/สิ้นสุด/ยกเลิก) แทน `filter` เดิม · แผง Filter พับได้ · ใช้กับทั้ง card+grid |

**เจ้าของสั่ง 18 ส.ค. (ค่ำ-6) + คำตอบที่เคาะแล้ว**
> *"ติดตามสำเร็จ/สิ้นสุด/ยกเลิก แยกหน้ากัน จะได้ดูง่าย"* ·
> *"ปุ่ม Filter เช็คสถานะประจำวัน — วันที่ / เวลา / ชื่อเจ้าของงาน"*

| คำถาม | เจ้าของเลือก |
|---|---|
| จำนวนแท็บ | **4 แท็บ** — กำลังตาม/สำเร็จ/สิ้นสุด/ยกเลิก |
| filter เวลา | **ช่วง เช้า/บ่าย/เย็น** (06-12 / 12-17 / 17-20) |

**การจำแนกแท็บ (รอบเดียวอยู่ได้แท็บเดียว · ลำดับตัดสินสำคัญ)**
* `cancelled=true` → **ยกเลิก** (เช็คก่อนสุด — ตัดสายทิ้งก่อนถึงวัน)
* ปิดงาน + ผล `cancelled`/`job_cancelled` → **ยกเลิก** · `went`/`arrived`/`done` → **สำเร็จ** ·
  ที่เหลือ (`leave`/`postponed`/`no_show_start`/`other`) → **สิ้นสุด**
* ยังไม่ปิด ยังไม่ยกเลิก → **กำลังตาม**

**กับดัก / ตรวจจริง**
* กรองระดับ **รอบ (entry) ก่อนแล้วค่อยจับกลุ่ม** — "เช็คสถานะประจำวัน" คือดูรอบ ไม่ใช่ตลอดชีพคน
* filter ทุกช่อง AND กัน · เวลาเทียบแบบเวลาไทย (02:00Z = 09:00 = เช้า · มีเทสต์)
* ตรวจจริง (seed ตรงในฐาน · ลบหมด): แท็บนับ กำลังตาม 2/สำเร็จ 1/สิ้นสุด 1/ยกเลิก 2 ·
  🔴 **ยกเลิก 2 = ของ seed 1 + รายการจริง "นายตี้" (outcome=cancelled)** — พิสูจน์ว่า
  ตัวจำแนกจับ outcome `cancelled` เข้าแท็บยกเลิกถูกกับข้อมูลจริง · สลับแท็บกรองถูกทุกอัน ·
  กรองช่วงเช้าเหลือเฉพาะรอบเช้า · dropdown เจ้าของงานลิสต์คนคีย์จริง
* 🔴 **`filter`/`FollowCallStatus` state เดิมถูกถอดออกหมด** (เอาออกให้สุด) — ชิปกรอง
  call_status เดิมไม่มีแล้ว แท็บ lifecycle แทน

### รอบ 18 ส.ค. 2569 (ค่ำ-7) — แยกกล่องรายชื่อทีมเป็น drill-down ราย BU + pagination

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/rosterBuGroups.ts` | **ใหม่ · pure** — จัดกลุ่มราย BU (SN/DS/LM/LBA/LBD/none) + นับต่อบทบาท + `paginate` (เทสต์ 9) |
| `src/pages/settings/JobStaffRosterTab.tsx` | เขียนใหม่: หน้ารวม = กล่อง BU กดเข้า → 4 กล่องบทบาท (สรรหา/คัดสรร/OPL/Online) แบ่งหน้า **หน้าละ 10** |

**เจ้าของสั่ง 18 ส.ค. (ค่ำ-7)** — แท็บ "สรรหา / คัดสรร / OPL / Online" ใน Settings (`AdminSettings` → `JobStaffRosterTab`)
> *"แยกกล่องเป็นกล่องแต่ละ BU แล้วพอกดแต่ละ BU แยกกล่องของเจ้าหน้าที่สรรหา/คัดสรร/OPL/ทีมออนไลน์ · pagination หน้าละ 10"*

เดิม = filter BU แนวนอน + 4 กล่องโชว์หมดทุกที ไม่แบ่งหน้า → เปลี่ยนเป็น drill-down

**กับดัก / ตรวจจริง**
* 🔴 **"ไม่ระบุ" (bu=null) เป็นกล่องแยก จับคู่ BU แบบ exact** — null ไม่โผล่ในกล่อง BU จริง
  (ในหน้าจัดการ) · คนละเรื่องกับ picker มอบหมายงานที่ null = เห็นทุก BU · อย่าปน
* 🔴 **`paginate` บีบ page ให้อยู่ในช่วงเสมอ** — ลบคนจนหน้าท้ายว่างต้องไม่เห็นหน้าเปล่า
  (มี useEffect sync state page ตามที่ถูกบีบ)
* `JobStaffManageState` มี field `canManageAllBu` — fallback ตอน state=null ต้องใส่ครบ ไม่งั้น tsc ตก
* ⚠️ dev server session นี้ต้อง `preview_start` ทั้ง **vite (8080) และ api (3100)** — api ไม่รันเอง
  · ลืมสตาร์ท api = manage เส้นตอบ 500 (ไม่ใช่โค้ดพัง)
* ตรวจจริง (ข้อมูลจริง 41 คน): กล่อง BU ครบ 6 (SN/DS/LM 0 คน · LBA 6 · LBD 32 · ไม่ระบุ 3) ·
  กด LBD → 4 กล่องบทบาท · OPL 16 คน = **หน้า 1/2 (10 แถว) → หน้า 2/2 (6 แถว)** ปุ่มถัดไป
  disable หน้าสุดท้าย · back "ทุก BU" กลับได้ · console สะอาด

### รอบ 18 ส.ค. 2569 (ค่ำ-8) — รายชื่อทีม: สองชั้นแท็บ pill (BU → บทบาท) แทน drill-down การ์ด

`src/pages/settings/JobStaffRosterTab.tsx` — ปรับต่อจากค่ำ-7 ตามที่เจ้าของสั่งเพิ่ม:
> *"ทุก BU ทำเป็นแท็บแบบนี้ [pill รางเดียว]"* · *"พอกดแต่ละ BU ก็มีให้เลือกดูอีกเป็น
> สรรหา คัดสรร ฯลฯ ไม่ได้ให้เอามารวมกันมันงง"*

* เดิม (ค่ำ-7) = การ์ด BU กดเข้า → **4 กล่องบทบาทเรียงกัน** · เจ้าของบอกงง
* ใหม่ = **สองชั้นแท็บ pill** (สไตล์เดียวกับแท็บ Settings · `AdminSettings` บรรทัด ~252):
  ชั้น 1 เลือก BU (SN/DS/LM/LBA/LBD/ไม่ระบุ + count) → ชั้น 2 เลือกทีม
  (สรรหา/คัดสรร/OPL/Online + count ของ BU นั้น) → **กล่องเดียว** ของบทบาทที่เลือก + แบ่งหน้า 10
* `PillTabs<T>` component ในไฟล์ — generic ต้อง annotate `<RosterBuKey>` / `<RosterKind>`
  ไม่งั้น TS infer เป็น string แล้ว setter ไม่ match (SetStateAction)
* ค่าเริ่มต้น BU = **ตัวแรกที่มีคน** (`activeBu ?? firstWithPeople ?? keys[0]`) ไม่งั้น
  เปิดมาเจอกล่องว่างของ SN · `key={bu:kind}` บน RosterSection = สลับแล้ว remount รีเซ็ตหน้า
* ตรวจจริง: BU pills + kind pills ครบ · LBD→OPL = กล่องเดียว "เจ้าหน้าที่ OPL · LBD"
  หน้า 1/2 (10 แถว) · count บน pill อัปเดตตาม BU (LBA OPL 2 / LBD OPL 16) · console สะอาด

### รอบ 18 ส.ค. 2569 (ค่ำ-9) — สองงาน: ช่อง Online ผู้รับผิดชอบ + ช่องเจ้าหน้าที่ติดตามแบบจำ name→phone

**งาน 1 — ผู้รับผิดชอบทีม Online บนหน้ากล่องงาน** (commit แยก `7d8b1d0`)
> เจ้าของ: *"ผู้รับผิดชอบ ในหน้ากล่องงาน เอาชื่อมาจากทีม online"*

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | เพิ่มช่อง `RosterBackedStaffSelect role=online` (ชื่อจาก `buildOnlineNameOptions`) บันทึก `online_name` |
| `api/_handlers/siamraj-unit-requests.ts` | 🔴 **fix**: `attachAssignments` ไม่ map `online_name` — บันทึกได้แต่อ่านกลับ null เสมอตั้งแต่ 097 |
| `src/components/jobs/JobBoardView.tsx` | `staffAssigneeLine` โชว์ Online ขึ้นก่อน |
| `src/components/jobs/RosterBackedStaffSelect.tsx` · `src/lib/jobStaffRemote.ts` (MutateOp) · `src/lib/siamrajUnitRequestsApi.ts` | widen ให้รับ `online` |

* 🔴 กับดัก: **backend รองรับ online_name ครบตั้งแต่ 097 แต่ read handler ลืม map** —
  พังเงียบ 1 ปี เพิ่งเจอตอนต่อ UI · ยิงเขียนจริง OPL6908073 เลือก "ว่าน" → อ่านกลับได้
  (ก่อน fix = null) · คืนค่า null เดิมแล้ว

**งาน 2 — Follow ช่องเจ้าหน้าที่ติดตาม: ชื่อจากคัดสรร + เบอร์พิมพ์เอง + จำ name→phone**
> เจ้าของ: *"เอาชื่อมาจากเจ้าหน้าที่คัดสรร เบอร์โทรให้เขาพิมพ์เอง แล้วมันจำไว้ว่าเคยเลือก
> ชื่อใครแล้วเบอร์ไหน ให้มันขึ้นมาเอง"*

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/followStaffMemory.ts` | **ใหม่ · pure** — `rememberedPhoneForName` / `nameForPhone` / `staffNameOptions` (เทสต์ 6) |
| `src/components/follow/StaffContactField.tsx` | เขียนใหม่: **select ชื่อ (คัดสรร) + input เบอร์พิมพ์เอง** · เลือกชื่อที่จำไว้ → เบอร์ prefill · blur แล้วจำคู่ (createStaffContact) |

* `follow_staff_contacts` เปลี่ยนบทบาทเป็น **ความจำ name→phone** (ชื่อมาจาก screener roster
  ไม่ใช่จากตารางนี้แล้ว) · ปุ่ม "เพิ่มเจ้าหน้าที่" (ค่ำ-5) ยังใช้ได้ = pre-seed ความจำ
* 🔴 **remember ใช้ onBlur** — ทดสอบด้วย `dispatchEvent('blur')` เฉย ๆ **ไม่ทริกเกอร์** React
  onBlur (React ฟัง focusout ที่ bubble) · ต้อง `FocusEvent('focusout',{bubbles:true})`
  · เกือบสรุปผิดว่าความจำพัง (เห็น prefill เป็น false positive เพราะเบอร์แค่ไม่ถูกล้าง)
* ตรวจจริง: dropdown โชว์ 9 ชื่อคัดสรร + "พิมพ์เบอร์เองไม่ผูกชื่อ" · เลือกครีม+พิมพ์เบอร์+blur
  → จำลงฐาน `ครีม=0866660002` · ล้างเบอร์ เลือกครีมใหม่ → prefill กลับมาเอง · ลบ test row แล้ว

### รอบ 18 ส.ค. 2569 (ค่ำ-10) — เอาปุ่มปฏิทินการโทรออก

`src/components/follow/FollowCallRoundsPanel.tsx` — เจ้าของสั่งเอาปุ่มปฏิทินการโทร (ไอคอน
มุมขวาบน) ออก · **เอาออกให้สุด**: ถอด Popover + ปฏิทินทั้งกริด + ชิป "เฉพาะวันที่ X" +
state (`calendarOpen`/`selectedDay`/`month`) + derived (`calendar`/`grid`/`monthLabel`) +
`scopedEntries` (roundRows อ่านจาก `entries` ตรง ๆ) + import ที่เลิกใช้
(`buildCallCalendar`/`callDayKey`/`monthGridDays`/`shiftMonth`/`Popover*`/`CalendarDays`/
`ChevronLeft/Right`/`X`) · เหลือแค่แผง 3 รอบ + ปุ่มรีเฟรช

* การกรองรายวันมีที่ **"ตัวกรอง" ของลิสต์** (ค่ำ-6: วันที่/ช่วงเวลา/เจ้าของงาน) อยู่แล้ว
  ปฏิทินบนแผงจึงซ้ำซ้อน · ตรวจจริง: ปุ่มปฏิทิน/ชิปหาย · แผง 3 รอบ+รีเฟรชอยู่ครบ · console สะอาด

### รอบ 19 ส.ค. 2569 (รอบยี่สิบสี่ · งาน-1) — หน้าจัดช่องทางรับสมัครเต็มจอ (แทนป๊อปอัปเดิม)

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/recruitChannelAdmin.ts` | **ใหม่ · pure** — เลขหน้า (`channelPageCount`/`clampChannelPage`/`channelPageOffset`/`channelRangeLabel`) + ตรวจชื่อ + ข้อความเตือนก่อนลบ (เทสต์ 16) |
| `src/pages/recruit/RecruitChannelsPage.tsx` | **ใหม่** — หน้า `/recruit/channels` · สลับมุมมองหลัก/รอง · ค้นหา+แบ่งหน้าฝั่งเซิร์ฟเวอร์ · เพิ่ม/แก้ชื่อ/เปิด-ปิด/ลบ · dropdown เลือกพ่อที่ค้นได้ |
| `src/App.tsx` | ลงทะเบียน route `/recruit/channels` (lazy chunk แยก) |
| `src/components/jobs/RecruitBoardTools.tsx` | 🔴 **ถอด `ChannelManagerDialog` ทั้งก้อน** — ปุ่ม "ช่องทาง" `navigate('/recruit/channels')` แทน |
| `api/_lib/recruitPostings.ts` | `listRecruitChannelRootsPage()` **ใหม่** · `listRecruitChannelChildren()` รับ `parentId = null` (ทุกพ่อ) + คืน `parentName` · `likeContains()` escape ไวลด์การ์ด |
| `api/_handlers/recruit-channels.ts` | สาขา `?view=roots` / `?view=children` คืน `{ items, total }` (ท่าเดิม `roots=1`/`parent=`/`q=` ยังอยู่ครบ) |
| `src/lib/recruitPostingsApi.ts` | `fetchRecruitChannelRootsPage()` · `fetchRecruitChannelSecondary()` |
| `src/lib/recruitPostings.ts` | `RecruitChannel.parentName?` |
| `tests/api/recruitChannelAdmin.test.ts` · `tests/api/recruitChannelSearch.test.ts` | เทสต์ใหม่ 16 + อัปเดตคำยืนยัน SQL + เคส escape 2 อัน |

**เจ้าของเคาะ 19 ส.ค. 2569:** *"หน้าใหม่เต็มจอ + ถอดป๊อปอัปเดิม"*

**กับดัก / ตรวจจริง**
* 🔴 **`_` และ `%` ในคำค้นเป็นไวลด์การ์ดของ SQL** — ของเดิมส่ง `%${q}%` ดิบ ๆ พิมพ์ `__test__`
  แล้วได้แถวที่มีแค่คำว่า "test" ติดมา 6 แถว (เจอตอนไล่หาข้อมูลทดสอบที่ค้าง — เกือบสรุปผิดว่าลบไม่หมด)
  → `likeContains()` + `ESCAPE '\'` ทุกจุด · **`ESCAPE '\\'` (สองตัว) = `invalid escape string` ฐานตีกลับ**
  ยืนยันกับฐานจริงแล้วว่าตัวเดียวเท่านั้นที่ผ่าน
* 🔴 **FK `parent_id` เป็น `on delete cascade`** (migration 063) — ลบช่องทางหลัก = ลูกหายทั้งกอง
  ข้อความยืนยันต้องบอกจำนวนลูกเสมอ (`channelDeleteWarning`) · ตรวจจริง: กดลบ "Facebook Ads"
  ขึ้น "ช่องทางรองใต้ช่องทางนี้ 6 ช่องจะถูกลบไปด้วย" · กดยกเลิกแล้วยอดยัง 43/4,345 ครบ
* 🔴 **เลขบนแท็บต้องมาจากยอดที่ไม่ถูกกรอง** — ถ้าเขียนทับด้วย total ของผลค้น แท็บจะกลายเป็น
  "ช่องทางรอง 860" ตอนพิมพ์ค้น · แยก `counts` ออกจาก `total` ของตาราง
* `MatchRow` ต้องประกาศ**ก่อน** `listRecruitChannelChildren` (ไฟล์เดียวกัน ใช้ก่อนประกาศ = tsc ตก)
* dropdown เลือกพ่อโหลดพ่อ 43 ตัวครั้งเดียวแล้วกรองในเครื่อง — **ไม่ขัดกฎ "ห้ามโหลดหมด"**
  ที่ห้ามคือลูก 4,345 ตัว (ท่าเดียวกับ ChannelPicker เดิม)
* ตรวจจริงบนเบราว์เซอร์ (ยิงเส้นเขียนจริงแล้วคืนค่าเดิมครบ): แท็บ 43 / 4,345 ·
  รอง "1–25 จาก 4,345" หน้า 1/174 · กดถัดไปได้ "26–50" · ค้น "ขับรถ" เหลือ 860 (35 หน้า) ·
  กรองพ่อ Facebook Ads เหลือ 6 · เพิ่ม `__test__` เป็น 7 → แก้ชื่อ → ปิดใช้งาน → ลบ กลับเป็น 6 ·
  เพิ่มช่องทางหลักซ้ำชื่อ = "มีช่องทางชื่อนี้อยู่แล้ว" (400 ตามคาด) · ลบทิ้งกลับเป็น 43 ·
  ปุ่ม "ช่องทาง" บนบอร์ดพาไป `/recruit/channels` จริง · โหมดมืดการ์ด slate-900 ตัวหนังสือสว่าง · console สะอาด

### รอบ 19 ส.ค. 2569 (รอบยี่สิบสี่ · งาน-2) — ตัวตั้งเวลาย้ายใบสมัคร + หน้าที่บอกว่า "ย้ายใครไปไหน"

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/applicationAutoMoveReport.ts` | **ใหม่ · pure** — อ่านค่า env (`readAutoMoveWorkerConfig`) + ประกอบข้อความ (`autoMoveRunSummary`/`autoMoveDetailLine`/`autoMoveJobLabel`/`autoMoveModeLabel`/`autoMoveTopReasons`) (เทสต์ 19) |
| `api/_lib/applicationAutoMoveWorker.ts` | **ใหม่** — วนรอบใน process API (แพตเทิร์นเดียวกับ `matchPrecomputeWorker`) · เก็บผลรอบล่าสุดในหน่วยความจำ · `runAutoMoveOnce()` ใช้ซ้ำได้ (เทสต์ 7) |
| `api/_handlers/application-auto-move-status.ts` | **ใหม่ · route 89** — `GET` อ่านค่าตั้ง+รอบล่าสุด · `POST` สั่งลองดูหนึ่งรอบ (**ลองดูเสมอ ย้ายจริงไม่ได้**) |
| `api/_lib/applicationAutoMoveRunner.ts` | `details[]` มี `applicant` เพิ่ม (select `a.full_name`) — เดิมมีแต่ UUID คนอ่านไม่รู้ว่าใคร |
| `server/local-api.ts` | เรียก `startApplicationAutoMoveWorker()` ตอนบูต (ต่อจาก match precompute) |
| `src/lib/applicationAutoMoveApi.ts` · `src/pages/settings/ApplicationAutoMoveTab.tsx` | **ใหม่** — แท็บ "ย้ายใบสมัครอัตโนมัติ" ใน Settings: โหมด · รอบล่าสุด · ตาราง "ย้ายใครไปไหน" · เหตุผลที่ไม่ย้าย · ปุ่มลองดูตอนนี้ |
| `src/pages/settings/AdminSettings.tsx` | เพิ่มแท็บ `autoMove` (admin เท่านั้น · รองรับ `?tab=autoMove`) |
| `.github/workflows/deploy.yml` | `APPLICATION_AUTO_MOVE_ENABLED=true` · `APPLICATION_AUTO_MOVE_APPLY=false` |

**เจ้าของเคาะ 19 ส.ค. 2569:** worker ในเซิร์ฟเวอร์ (ไม่ใช่ GitHub cron) ·
*"แบบ 1 ก็ดี แต่ทำให้มันมีบอกหน่อยว่าย้ายใครไปไหน"* → เปิดโหมดลองดูก่อน + มีหน้าให้ดูผล

**กับดัก / ตรวจจริง**
* 🔴 **สองสวิตช์ ไม่ใช่สวิตช์เดียว** — `ENABLED` เปิด worker · `APPLY` ถึงจะเขียนจริง
  เปิดตัวแรกอย่างเดียว = เดินรอบแล้วบันทึกว่า "จะย้ายใคร" เฉย ๆ · มีเทสต์คุมทั้งสองทาง
* 🔴 **`POST /api/application-auto-move-status` สั่งย้ายจริงไม่ได้โดยตั้งใจ** — ปุ่มบนหน้าตั้งค่า
  ต้องไม่กลายเป็นปุ่มย้ายคนจริง · ย้ายจริงมีทางเดียวคือ `POST /api/application-auto-move` หรือ worker ที่เปิด APPLY
* 🔴 **รอบที่ล้มต้องบันทึกว่าล้ม** — ถ้าปล่อยผลรอบเก่าค้าง หน้าเว็บจะบอกว่ายังดีอยู่ทั้งที่อ่าน ERP ไม่ได้
* ⚠️ ผลรอบล่าสุดอยู่ในหน่วยความจำ process (ตั้งใจ ไม่เพิ่มตาราง) — รีสตาร์ตแล้วว่างจนกว่าจะเดินรอบใหม่
  · บน Vercel (serverless) จะว่างเสมอ ของจริงรันเป็น process เดียวบน on-prem ผ่าน supervisord (`docker/supervisord.conf`)
* ⚠️ `toTargetJob` ซ้ำกับใน `api/_handlers/application-auto-move.ts` — แก้ที่ไหนต้องแก้อีกที่ด้วย
  (import จาก handler ไม่ได้ เพราะมันพันกับ req/res)
* ⚠️ เทสต์: `vi.mock` ถูกยกไปบนสุด — ประกาศ `vi.fn()` ไว้นอกโรงงานแล้วอ้างในโรงงาน = *Cannot access before initialization*
  ต้องสร้างในโรงงานแล้วดึงกลับด้วย `vi.mocked(...)`
* ตรวจจริงบนเบราว์เซอร์ (ข้อมูลจริง · ไม่เขียนอะไรเลยเพราะเป็น dry run): กด "ลองดูตอนนี้"
  → **"รอบล่าสุด จะย้าย 1 ใบ (จากที่ค้างอยู่ 1 ใบ) · ใบขอที่ยังเปิด 290 ใบ"** และรายการ
  **"นายtest test · LAM6908004 → LAO6908007 · เหตุผล: closed_request:same_province"**

### รอบ 19 ส.ค. 2569 (รอบยี่สิบสี่ · งาน-3) — ป้าย "ใบขอชั่วคราว" ของใบพรี

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/publicJobVisibility.ts` | เพิ่ม `PREQUEST_LABEL = 'ใบขอชั่วคราว'` — **คำบนจอที่เดียวของระบบ** |
| `src/components/jobs/PrequestBadge.tsx` | **ใหม่** — ป้ายกลาง ใช้ `isPrequestJob()` (เช็คทั้งธงและ prefix) · คืน null ถ้าไม่ใช่ใบพรี |
| `src/components/jobs/JobBoardView.tsx` | เปลี่ยนป้ายเดิม (inline · คำว่า "ใบขอล่วงหน้า") เป็นคอมโพเนนต์กลาง |
| `src/pages/jobs/JobListPage.tsx` | ติดป้าย 4 จุด — ตารางเดสก์ท็อป + การ์ดจอเล็ก (ทั้งสองมุมมองของหน้า) |
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | ติดป้ายบนหัวหน้า (ข้างชิป "Siamraj · อ่านอย่างเดียว") |
| `src/components/dashboard/analytics/DashboardWorkQueueTable.tsx` | ติดป้ายข้างเลขที่ใบขอ |
| `src/lib/applicationAutoMoveReport.ts` | `autoMoveJobLabel` ใช้ `PREQUEST_LABEL` แทนคำว่า "(ล่วงหน้า)" ที่ hardcode ไว้ |

**เจ้าของสั่ง 19 ส.ค. 2569:** *"ใบขอไหนมาจากใบพรี ก็ใส่ป้ายแท็กไว้ว่าเป็นใบขอชั่วคราว"*

**กับดัก / ตรวจจริง**
* 🔴 **ห้ามเช็ค `job.is_prequest` ตรง ๆ** — บางเส้น (แดชบอร์ด/feed บางทาง) ส่งมาแต่ `id`
  ที่ขึ้นต้น `siamraj-pre:` โดยไม่มีธง · ป้ายจะหายเงียบ ๆ · ใช้ `isPrequestJob()` เสมอ
* 🔴 **"ล่วงหน้า" มีสองความหมายบนจอเดียวกัน** — ชิป `JobUrgencyBadge` สีส้มคำว่า "ล่วงหน้า"
  = *วันที่กรอกถึงวันที่ต้องการ ≥ 7 วัน* (ความเร่งด่วน) · คนละเรื่องกับใบพรี
  คำใหม่ "ใบขอชั่วคราว" จึงช่วยแยกสองอันนี้ออกจากกัน — **อย่ากลับไปใช้คำว่า "ล่วงหน้า" บนป้ายนี้อีก**
* หน้ารายการมี **สองมุมมองในไฟล์เดียว** (ตาราง `<td>` กับการ์ด) — แก้จุดเดียวได้ไม่ครบ
* ตรวจจริง (ข้อมูลจริง · ใบพรีในระบบมีใบเดียว `siamraj-pre:LBM6908001` อีซูซุ):
  หน้ารายการค้น LBM6908001 → แถวนั้นแถวเดียวมีป้าย อีก 4 แถวไม่มี ·
  หน้ารายละเอียดขึ้นป้ายบนหัว · การ์ดบนบอร์ดขึ้นป้าย · โหมดมืดอ่านออกทั้งสามหน้า
* ⚠️ **ยังไม่ได้ตรวจของจริงบนแดชบอร์ด** — ตาราง `DashboardWorkQueueTable` ไม่ถูกเรนเดอร์
  บนหน้า `/dashboard` ตอนเปิดปกติ (อยู่หลัง drill-down) จึงยังไม่เห็นป้ายบนข้อมูลจริง
  โค้ดผ่าน tsc/eslint และป้ายจะโผล่เฉพาะแถวที่เป็นใบพรีเท่านั้น

### รอบ 19 ส.ค. 2569 (รอบยี่สิบสี่ · งาน-4) — ยามเฝ้าระบบ + หน้าสถานะระบบ

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/systemHealth.ts` | **ใหม่ · pure** — เกณฑ์ตัดสินเขียว/เหลือง/แดง (`buildHealthChecks`/`levelFromAge`/`humanAgo`/`worstLevel`/`healthAlertFor`) (เทสต์ 15) |
| `api/_lib/systemHealthStore.ts` | **ใหม่** — อ่านสัญญาณจากคิว + สวิตช์ + ของค้าง (คนสนใจที่ไม่มีคนรับ · ชุดรออนุมัติ) |
| `api/_lib/systemHealthWorker.ts` | **ใหม่** — ยามเฝ้าวนทุก 5 นาที · เด้ง `notifyRoles(['admin'])` ตอนสถานะเปลี่ยน |
| `api/_handlers/system-health.ts` | **ใหม่ · route 90** — `GET` อ่านผลรอบล่าสุด · `POST` ตรวจเดี๋ยวนี้ |
| `api/_lib/rbac.ts` | เพิ่ม resource `system-health` (ตกไป default = admin เท่านั้น ไม่ต้อง migration) |
| `server/local-api.ts` | `startSystemHealthWorker()` ตอนบูต |
| `src/lib/systemHealthApi.ts` · `src/pages/settings/SystemHealthTab.tsx` | **ใหม่** — แท็บ "สถานะระบบ": ไฟ 4 ดวง · ตารางสวิตช์ · ของค้าง + ปุ่มเปิดดู |
| `src/pages/settings/AdminSettings.tsx` | เพิ่มแท็บ `health` (`?tab=health`) |
| `.github/workflows/deploy.yml` | `SYSTEM_HEALTH_WATCH_ENABLED=true` |

**เจ้าของเคาะ 19 ส.ค. 2569:** ประเมินความพร้อม production แล้วเลือก "A+B ก่อน — ยามเฝ้า + หน้าสถานะ"

**กับดัก / ตรวจจริง**
* 🔴 **แยก `computeHealthChecks()` (ไม่เตือน) ออกจาก `runHealthCheckOnce()` (เตือน)**
  เจอตอนตรวจ: เปิดหน้าสถานะบนเครื่อง dev แล้ว **แจ้งเตือน "ERP ผิดปกติ" ไปโผล่บน production**
  (ฐาน dev = prod) ทั้งที่ ERP จริงปกติดี · หน้าเว็บต้องเรียกตัวที่ไม่เตือนเท่านั้น
* 🔴 **ยามเฝ้าปิดโดยค่าเริ่มต้น เปิดที่ deploy** — เหตุผลเดียวกัน (เครื่อง dev ห้ามเตือนคนจริง)
* 🔴 **"ไม่รู้สถานะ" = เหลือง ไม่ใช่เขียว** — `levelFromAge(null)` คืน `warn`
  ถ้าตีเป็นเขียวจะกลับไปเป็นปัญหาเดิม (ระบบเงียบแต่จอบอกว่าสบายดี)
* 🔴 **เตือนเฉพาะตอนสถานะเปลี่ยน + หายแล้วต้องบอกด้วย** — เตือนทุกรอบ = คนกดปิดโดยไม่อ่าน ·
  ไม่บอกตอนหาย = คนไม่เชื่อ ต้องเข้าไปเช็คเองอยู่ดี
* ⚠️ **ไฟ ERP อ้างผลรอบล่าสุดของตัวย้ายใบสมัคร ไม่ได้ยิง ERP เอง** — ไม่งั้นคนเปิดหน้านี้ค้างไว้
  จะกลายเป็นตัวถล่ม ERP · แปลว่าถ้าปิดตัวย้ายใบสมัคร ไฟ ERP จะเป็นเหลือง "ยังไม่ได้ตรวจ"
* เกณฑ์ตั้งหลวมไว้ก่อนโดยตั้งใจ (ดึงคิว 3 ชม. · ผลกลับ 12 ชม.) — เตือนถี่เกินคนจะเลิกอ่าน
* ตรวจจริงบนเบราว์เซอร์ด้วยข้อมูลจริง: ไฟเขียว 3 ดวง (ดึงคิว 28 นาทีก่อน · ผลกลับ 2 ชม. 47 น. ·
  คิวค้าง 0 ใบ/รอเวลานัด 19) · ERP เหลือง "ยังไม่ได้ตรวจ" (ถูกต้อง — ตัวย้ายปิดอยู่บน dev) ·
  ตารางสวิตช์ 4 แถวตรงกับของจริง · ของค้าง 3 รายการ (ชุดรออนุมัติ 11 วัน + คนสนใจ 2 คน) ·
  ยามเฝ้ายิงแจ้งเตือนจริงได้ (เห็น "🚨 ERP (ใบขอ) ผิดปกติ" พร้อมลิงก์) แล้วลบทิ้งด้วย id ·
  หลังแยก compute/notify: กด "ตรวจเดี๋ยวนี้" ไม่เกิดแจ้งเตือนใหม่ · โหมดมืดอ่านออก

### รอบ 19 ส.ค. 2569 (รอบยี่สิบสี่ · งาน-5) — กล่องงาน: ยุบปุ่มเป็นแท็บ + เก็บกวาดคำบนจอ

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/UnitRequestTabs.tsx` | เพิ่ม 3 แท็บ: `edit` · `gen-link` · `find` (รวมเป็น 7 แท็บ) |
| `src/pages/jobs/UnitRequestActionTabPage.tsx` | **ใหม่** — เนื้อของ 3 แท็บนั้น · **ใช้ dialog ตัวเดิม ไม่ก๊อปโค้ด** · ปิด = กลับแท็บรายละเอียด |
| `src/App.tsx` | route `/jobs/siamraj/:id/edit` · `/gen-link` · `/find` |
| `src/pages/jobs/UnitRequestTabPage.tsx` | แคบ type เป็น `ListTabId` (แท็บลิสต์ 3 อันเดิมเท่านั้น) |
| `src/components/jobs/JobBoardView.tsx` | 🔴 ถอด 3 ปุ่มบนการ์ด + dialog + state + import ให้สุด · ถอด "เปิดใบขอในระบบ" · "สมัครตำแหน่งนี้" เหลือเฉพาะ `!isStaff` |
| `src/components/jobs/GenApplyLinkDialog.tsx` | ช่อง "ผู้รับผิดชอบ" ดึงชื่อจาก **ทีม Online** (`buildOnlineNameOptions`) แทนผู้ใช้ทั้งระบบ · บันทึกที่ `responsibleName` |

**เจ้าของสั่ง 19 ส.ค. 2569 (6 ข้อ)** — ผู้รับผิดชอบเอาชื่อจากทีม Online · ใบขอกดเข้าไปมีเส้นงานให้เลือก ·
ปุ่มเหลือแค่ดูชื่อ · "สมัครงาน" มีแค่หน้าสาธารณะ · เอา "เปิดใบขอในระบบ" ออก · ลบข้อมูลคำขอโพสต์งานใหม่

**กับดัก / ตรวจจริง**
* 🔴🔴 **แท็บ "หาผู้สมัครเพิ่ม" ยิงเข้าคิวโทรจริงทันทีที่เปิด** — `RecruitLaneDialog` เรียก
  `send=1` ตั้งแต่เรนเดอร์แรก (มันคือ "ค้นแล้วส่งเลย" ไม่ใช่ "ค้นดูก่อน")
  ตอนเป็น**ปุ่ม**ไม่มีปัญหาเพราะคนตั้งใจกด แต่พอเป็น**แท็บ**คนกดดูเฉย ๆ ได้
  **เจอจริงตอนตรวจ: เปิดแท็บครั้งเดียว = ใบ OPL6907129 เข้าคิวโทร 20 คนทันที**
  (ยกเลิก+ลบทันก่อน Lumos ดึง · `delivery_count = 0` ทุกแถว ไม่มีสายไหนโทรออก)
  → ใส่ด่านยืนยัน `laneStarted` · **mount dialog เฉพาะหลังกดปุ่ม** · เปลี่ยนแท็บแล้วรีเซ็ตด่าน
  ⚠️ บทเรียนกว้างกว่านั้น: **ย้ายปุ่มที่มีผลข้างเคียงไปเป็นแท็บ = เปลี่ยนความหมายของการกด**
  ต้องเช็คทุกครั้งว่าของเดิมทำอะไรตอน mount
* 🔴 `responsibleUserId` ตั้งเป็น `null` โดยตั้งใจ — roster เก็บเป็น**ชื่อ** ไม่ใช่ user id
  ฟิลด์นั้นมีไว้ตอนผูกกับ user จริงเท่านั้น
* ⚠️ `JobBoardView` ใช้ร่วมกันระหว่างบอร์ดเจ้าหน้าที่กับหน้าสาธารณะ — "สมัครตำแหน่งนี้"
  ต้องกันด้วย `!isStaff` **ห้ามลบทิ้ง** ไม่งั้นหน้าสาธารณะสมัครงานไม่ได้
* ตรวจจริง: การ์ดเหลือ "ดูรายชื่อ" 20 ปุ่ม (Gen link/แก้ไข/หาผู้สมัครเพิ่ม/สมัครงาน = 0) ·
  แท็บครบ 7 อัน · Gen link เปิดได้ dropdown ผู้รับผิดชอบ = **เจมส์ · ว่าน · ใหม่** ตรงกับ
  `/api/job-staff` → `onlines` เป๊ะ · หน้าสาธารณะยังมี "สมัครงาน" 21 ปุ่ม + "สมัครตำแหน่งนี้"
  ในป๊อปอัป · "เปิดใบขอในระบบ" หายทุกที่ · หลังใส่ด่าน เปิดแท็บ find แล้วคิวเพิ่ม **0 แถว**
* ลบข้อมูลทดสอบ `job_posting_requests` **12 แถว** (ดูก่อน → เช็คว่าไม่มีตารางไหนอ้างถึง → ลบด้วย id)
  · แท็บ "คำขอโพสต์งานใหม่" เหลือ 0 ทุกสถานะ

### รอบ 19 ส.ค. 2569 (รอบยี่สิบสี่ · งาน-6) — กล่องสถานะบนหน้ากล่องงาน + แยกยกเลิกจากปิดแล้ว

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/jobBoxGroups.ts` | **ใหม่ · pure** — ยุบ 9 สถานะทำงานเหลือ 4 กล่อง + แยกปิด/ยกเลิกด้วย `cancel_date` (เทสต์ 13) |
| `src/components/jobs/JobBoardView.tsx` | แถวกล่องสถานะบนมุมมอง "กล่องงาน" (staff เท่านั้น) · กรองการ์ด + แบ่งหน้าใหม่ตามกล่อง · เพิ่มแท็บบนสุด "ยกเลิก" |
| `src/components/jobs/ClosedRequestsPanel.tsx` | รับ prop `mode` ('closed' \| 'cancelled') · กรองด้วย `filterByClosedBox` · ป้ายหัวเปลี่ยนตามโหมด |
| `src/pages/jobs/StaffJobBoardPage.tsx` | รองรับ view `cancelled` (`?view=cancelled`) |

**เจ้าของสั่ง 19 ส.ค. 2569:** *"หน้ากล่องงานใบไหนปิดแล้วก็ย้ายไปกล่องปิดแล้ว ยกเลิกก็ไปกล่องยกเลิก
มีกล่องเพื่อดูข้อมูลได้หมดอะ กำลังสรรหา ยกเลิก รอแจ้งเข้า รอเริ่มงานไรงี้"* → เคาะ **6 กล่อง + แยกยกเลิก**

**การจับกลุ่ม (ครบทุกสถานะ ห้ามมีใบตกหล่น)**
| กล่อง | รวมสถานะ | ของจริง 19 ส.ค. |
|---|---|---|
| กำลังสรรหา | ยังไม่ตั้งสถานะ · `in_progress` · `on_hold` | 220 |
| กำลังคัดเลือก | `evaluating` · `waiting_interview` · `waiting_result` | 29 |
| รอแจ้งเข้า / รอเริ่มงาน | `waiting_inform` · `waiting_start` | 35 |
| เริ่มงานแล้ว | `daily_work` · `daily_pay` | 10 |
| ปิดแล้ว | feed ใบปิด ที่ไม่มี `cancel_date` | 132 |
| ยกเลิก | feed ใบปิด ที่มี `cancel_date` | 36 |

**กับดัก / ตรวจจริง**
* 🔴 **ยังไม่ตั้งสถานะ = "กำลังสรรหา" ห้ามคืน null** — ของจริง **193 จาก 293 ใบยังไม่ตั้งสถานะ**
  ถ้าตกกล่องคือหายไปจากหน้าจอเกินครึ่ง · สถานะที่ไม่รู้จักก็ตกกล่องนี้เหมือนกัน
* 🔴 **มีเทสต์คุมว่าผลรวมทุกกล่อง = จำนวนใบทั้งหมด** และคุมว่า work_status ทั้ง 9 ตัวมีกล่องรับ
  — ใครเพิ่มสถานะใหม่ใน `work_status_master` แล้วลืมแมป เทสต์จะจับได้ทันที
* 🔴 **นับกล่องจาก `filters.filtered` ไม่ใช่ทั้งระบบ** — เลขบนกล่องต้องเป็น "ในผลที่กรองอยู่"
  ไม่งั้นกรองจังหวัดแล้วกล่องยังโชว์ยอดเดิม ขัดกันเองบนจอเดียว (บทเรียนเดียวกับการ์ด KPI รอบ 23)
* 🔴 **ปิดแล้ว/ยกเลิกมาจากคนละ feed** — กดแล้วต้อง**สลับมุมมอง** ไม่ใช่กรองการ์ดในหน้าเดิม
  (กล่องงานถามหาเฉพาะใบที่ยังเปิด ใบปิดไม่เคยอยู่ในชุดนั้น)
* ⚠️ `JobBoardView` ใช้ร่วมกับหน้าสาธารณะ — แถวกล่องต้องกันด้วย `isStaff && view === 'board'`
* ตรวจจริง: กล่องขึ้นครบ 6 + ทั้งหมด · **220+29+35+10 = 294 = ยอดทั้งหมดเป๊ะ** ·
  กด "กำลังคัดเลือก" → "พบ 29 จาก 294 ตำแหน่ง" แบ่งหน้าใหม่ถูก ·
  แท็บยกเลิกโชว์ 36 ใบ · ปิดแล้ว 132 ใบ · **feed ใบปิดมี 168 = 132 + 36 พอดี** ·
  โหมดมืดอ่านออก

### รอบ 19 ส.ค. 2569 (รอบยี่สิบสี่ · งาน-7) — ถอนแท็บเส้นงานออกจากหน้าใบขอ (เจ้าของกลับคำ)

เจ้าของเคาะ: *"เอาแท็บ 7 แท็บออกจากหน้าใบขอ"* — และยืนยันว่า **"ไม่มีสถานะก็ตีไปว่ากำลังสรรหา" คงไว้**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/UnitRequestTabs.tsx` | กลับเป็น **4 แท็บเดิม** (รายละเอียดงาน · ผู้สมัคร · AI Match · การติดต่อ) |
| `src/pages/jobs/UnitRequestActionTabPage.tsx` | **ลบทิ้ง** |
| `src/App.tsx` | ถอด route `/edit` · `/gen-link` · `/find` |
| `src/pages/jobs/UnitRequestTabPage.tsx` | กลับเป็นของเดิม |
| `src/components/jobs/JobBoardView.tsx` | 🔴 **คืนปุ่ม 3 อันบนการ์ด** (หาผู้สมัครเพิ่ม · Gen link · แก้ไข) + state + dialog |

🔴 **ทำไมต้องคืนปุ่ม** — ถ้าถอดแท็บแล้วปุ่มยังหายอยู่ ทั้งสามฟีเจอร์จะ**ไม่มีทางเข้าเลย**
(กลายเป็นโค้ดตายที่ยังอยู่ในระบบ) · การถอดปุ่มมีเหตุผลเฉพาะตอนที่แท็บรับงานต่อเท่านั้น

**สิ่งที่ยังคงไว้จากรอบเดียวกัน (ไม่ได้ย้อน)**
* ผู้รับผิดชอบใน Gen link = ทีม Online
* "สมัครตำแหน่งนี้" เหลือเฉพาะหน้าสาธารณะ · ถอด "เปิดใบขอในระบบ"
* กล่องสถานะบนหน้ากล่องงาน + แท็บ "ยกเลิก"
* ข้อมูลทดสอบคำขอโพสต์งานใหม่ที่ลบไปแล้ว

**ตรวจจริง:** หน้าใบขอเหลือ 4 แท็บ · การ์ดมีปุ่มครบ (หาผู้สมัครเพิ่ม 20 · Gen link 20 ·
ดูรายชื่อ 20 · แก้ไข 0 เพราะ 20 ใบนี้ยังไม่มีประกาศ ซึ่งเป็นพฤติกรรมเดิม) ·
กล่องสถานะยังทำงาน 219+29+34+10 = 292 ตรงกับยอดทั้งหมด

### รอบ 19 ส.ค. 2569 (รอบยี่สิบห้า · งาน-1) — เลขกล่องงานบอกหน่วยครบ "ใบขอ + อัตรา"

เจ้าของทัก: *"หน้า Dashboard มีงานทั้งหมด 339 แต่หน้ากล่องงานมีแค่ 291 เอง"*

🔴 **ไม่ใช่ข้อมูลหาย — เป็นคนละหน่วยกัน** ทั้งสองหน้าอ่าน
`GET /api/siamraj/unit-requests?limit=500` **ชุดเดียวกันเป๊ะ** วัดจริง 19 ส.ค.:
**292 ใบขอ = 340 อัตรา** (ขอมา 422 − หาได้แล้ว 82 = เหลือหา 340 = `position_units` รวม
= การ์ด「คงเหลือ」บน Dashboard) · กล่องงานเขียน "292 ตำแหน่ง" ทั้งที่ 292 คือจำนวน**ใบ**
และตัวกรองใส่เลขในวงเล็บเปล่า ๆ (340) ที่จริงเป็น**อัตรา**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/jobBoxGroups.ts` | เพิ่ม `countOpenBoxPositions(jobs, positionsOf)` — นับ**อัตรา**ต่อกล่อง (รับ mapper เข้ามาเพื่อไม่ให้กติกา "ไม่มีค่า = 1 อัตรา" ซ้ำสองที่) |
| `src/hooks/useJobBoardFilters.ts` | คืน `visiblePositions` เพิ่ม |
| `src/components/jobs/JobBoardView.tsx` | hero · บรรทัด "พบ …" · กล่องทุกใบ โชว์ "N ใบขอ · M อัตรา" |
| `src/components/jobs/JobBoardTopFilters.tsx` | prop `countUnitLabel` (staff = 'ใบขอ' · public คงเดิม 'ตำแหน่ง') + `positionsNote` |
| `src/lib/siamrajUnitFilters.ts` | ป้ายตัวกรองแผนก/ลักษณะงานย่อยติดหน่วย "(340 อัตรา)" — ใช้ทั้ง Dashboard และหน้ารายการใบขอ |

**ตรวจจริง:** กล่องงาน 215+29+38+10 = 292 ใบ · 260+30+38+12 = 340 อัตรา ·
Dashboard การ์ดคงเหลือ 340 อัตรา · 292 ใบขอ · ตัวกรองขึ้น "(340 อัตรา)" · หน้า /apply
ยังเขียน "พบ 165 ตำแหน่ง" เหมือนเดิม

### รอบ 19 ส.ค. 2569 (รอบยี่สิบห้า · งาน-2) — ปิดแล้ว/ยกเลิก กดแล้วกรองในหน้าเดิม

เจ้าของสั่ง: *"ปิดแล้ว กับ ยกเลิก ในหน้ากล่องงาน มันต้องกดแล้วดูได้แบบกล่องอื่น ๆ สิ
กดแล้วเด้งไปหน้าอื่นทำไม ทำไมไม่ทำให้มันเหมือนกัน"*

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/jobBoardRowFilter.ts` | **ใหม่ · pure** — ยกตัวกรองแถวออกมาจาก hook (`filterJobBoardRows`) เพื่อเอาไปใช้กับ**ชุดใบปิด**ได้ด้วยตัวเดียวกัน · option `skipUrgencyChip` (เทสต์ 8) |
| `src/hooks/useJobBoardFilters.ts` | ใช้ตัวกรอง pure + คืน `filterRows(rows, opts)` ให้เอาไปใช้กับอีกชุดข้อมูล |
| `src/hooks/useClosedRequestsFeed.ts` | **ใหม่** — ชุดใบปิด/ยกเลิก + ช่วงวันที่ 30/90/180/365 + reload (ย้ายมาจาก `ClosedRequestsPanel`) |
| `src/components/jobs/JobBoardView.tsx` | `openBox` เป็น `JobBoxKey` (รวมปิดแล้ว/ยกเลิก) · การ์ดสลับชุดข้อมูลตามกล่อง · แถบเลือกช่วงวันที่ · ซ่อนปุ่มลงมือบนใบที่จบแล้ว · เรียงใบปิดด้วยวันปิดล่าสุด |
| `src/pages/jobs/StaffJobBoardPage.tsx` | โหลดชุดใบปิดที่นี่แล้วส่งเข้ากล่องงาน · แปลงลิงก์เก่า `?view=closed/cancelled` → `initialBox` แล้วล้าง `?view` |
| `src/components/jobs/ClosedRequestsPanel.tsx` | **ลบทิ้ง** (กล่องงานรับงานต่อครบแล้ว ไม่ปล่อยเป็นโค้ดตาย) |
| `src/lib/jobBoxGroups.ts` | เพิ่ม `compareByClosedDateDesc` — ใบปิดเรียงตามวันที่ปิดล่าสุด |

**กับดัก**
* 🔴 **ชุดใบปิดไม่ได้ผ่าน `enrichJobsWithUrgency`** (มีแต่ feed ใบเปิด) — ถ้าไม่ข้ามชิป "ด่วน"
  คนที่ค้างชิปไว้จะเปิดกล่องปิดแล้วเจอ **0 ใบทุกครั้ง** ทั้งที่ของมีอยู่ → `skipUrgencyChip: true`
* 🔴 **ห้ามก๊อปตรรกะกรองรอบสอง** — ใบเปิดกับใบปิดต้องใช้ `filterJobBoardRows` ตัวเดียวกัน
  ไม่งั้นกรองจังหวัดแล้วสองกล่องให้ผลไม่เหมือนกันบนจอเดียว
* 🔴 **ใบที่ปิด/ยกเลิกแล้วต้องไม่มีปุ่มลงมือ** (หาผู้สมัครเพิ่ม · Gen link · แก้ไข) —
  ส่งคนไปงานที่จบแล้ว · เหลือ "ดูรายชื่อ" ได้
* ⚠️ **ต้องมีช่วงวันที่เสมอ** — ใบปิดสะสมย้อนหลังหลายปี (365 วัน = 2,759 ใบ) ·
  วัดจริง 30 วัน = 172 ใบ/81ms · 90 วัน = 1,231 ใบ (ช้าขึ้นชัดเจน กดแล้วต้องรอ ~2-3 วิ)
* ⚠️ **การ์ดใบปิดกดแล้วได้ป๊อปอัปข้อมูล เหมือนการ์ดอื่นทุกใบ** — ไม่ได้พาไปหน้ารายละเอียด
  แล้ว (ของเดิมในแท็บพาไป) · ปุ่ม "เปิดใบขอในระบบ" เจ้าของสั่งถอดไปเมื่อ 19 ส.ค. **ห้ามแอบใส่คืน**
  ทางเข้าหน้ารายละเอียดของใบปิดยังมีที่ drill-down ของ Dashboard

**ตรวจจริง (วัดจาก DOM):** กล่อง 6 ใบโครงสร้าง/คลาสเหมือนกันหมด (`aria-pressed` ครบ) ·
ปิดแล้ว 136 ใบ · 231 อัตรา · ยกเลิก 36 ใบ · 38 อัตรา (รวม 172 = feed ใบปิด 30 วันพอดี) ·
กดปิดแล้ว → URL ยังเป็น `/jobs/board` การ์ดเปลี่ยนเป็นใบปิด "พบ 136 ใบขอ · 231 อัตรา" ·
ค้น "โตโยต้า" → กล่องปิดแล้วเหลือ 9 ใบ "พบ 9 จาก 136 ใบขอ" (ตัวกรองใช้ร่วมกันจริง) ·
สลับ 90 วัน → 1,113 ใบ · `?view=cancelled` เข้ามา = เลือกกล่องยกเลิกให้แล้วล้าง `?view` ·
แบ่งหน้า "แสดง 1–20 จาก 36" · โหมดมืดทุกกล่องมี `dark:bg` ครบ · /apply ไม่มีกล่องโผล่

### รอบ 19 ส.ค. 2569 (รอบยี่สิบห้า · งาน-3) — ชิป「ผ่านมา」ใบล่วงหน้าเป็นสีเดียวเสมอ

เจ้าของสั่ง: *"เรื่องสีในหน้าใบขอ อย่าทำให้มันงง ล่วงหน้าสีอะไรก็สีนั้น เพราะถ้ายังไม่ถึง
วันที่ต้องการก็เป็นล่วงหน้า ก็สีนั้น ๆ ไปเลย มาทำล่วงหน้าหลาย ๆ สีให้งงทำไม"*
(คำถามที่ค้างจากรอบยี่สิบสี่ ข้อ 5 — **เคาะแล้ว**)

🔴 **ต้นเหตุ: ข้อความกับสีมาจากคนละฟังก์ชัน**
`getJobRequestAgeLabel` → พิมพ์ว่า "ล่วงหน้า" · `getJobAgeUrgencyLevel` → สีจากจำนวนวัน
ที่นับจากวันที่กรอก → ใบล่วงหน้าที่กรอกไว้ 200 วันได้สี **ด่วนมาก (แดง)** และ tooltip
ขึ้นคำว่า "ด่วนมาก" ทั้งที่ยังไม่ถึงวันที่ต้องการ

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/jobUrgency.ts` | เพิ่ม `JobAgeChipLevel` (= 4 ระดับเดิม + `unknown` + **`advance`**) · `JOB_AGE_CHIP_META` · `getJobAgeChipInfo()` ที่คืน **level + text + cardText + title พร้อมกัน** · **ถอด `getJobAgeUrgencyLevel()`** ทิ้ง (เป็นทางที่ทำให้คิดสีแยกจากข้อความได้) |
| `src/pages/jobs/JobListPage.tsx` | คอมโพเนนต์ `JobAgeChip` ใช้ทั้งตาราง (desktop) และการ์ด (mobile) — `withPrefix` เติมคำ "ผ่านมา" ให้การ์ดที่ไม่มีหัวคอลัมน์ |
| `tests/api/jobAgeChip.test.ts` | **ใหม่ · 6 เทสต์** — คุมว่ากรอกไว้นานแค่ไหนก็ยัง `advance` · การ์ดไม่ขึ้น "ผ่านมา ล่วงหน้า" · tooltip ห้ามมีคำว่า "ด่วน" · ทุกระดับมี `dark:bg` |

**กติกา**
* ชิป「ผ่านมา」ทุกที่ต้องเรียก `getJobAgeChipInfo()` — **ห้ามอ่านข้อความกับสีแยกกันอีก**
* ใบล่วงหน้าใช้ **เขียว** ชุดเดียวกับ "ล่วงหน้า" บนกราฟ Dashboard (`KIND_TONE.advance = success`)
  — คำเดียวกันต้องสีเดียวกันทุกหน้า
* ข้อความยังมาจาก `getJobRequestAgeLabel` ที่เดิม (เทสต์ 8 เคสของนิยาม "วันผ่านมา" ยังคุมอยู่)
* ⚠️ **หน้า Matching ไม่ได้แก้** — ที่นั่นเขียน "ด่วน · ค้าง 45 วัน" ซึ่งพูดถึงวันที่ค้างตรง ๆ
  ไม่มีคำว่า "ล่วงหน้า" ให้ขัดกัน (ถ้าเจ้าของสั่งให้เหมือนกันด้วย ค่อยเอา `getJobAgeChipInfo` ไปใช้)

**ตรวจจริง (วัดจาก DOM):** กรอง "วันผ่านมา = ล่วงหน้า" ได้ **39 ใบ** ทั้ง 2 หน้า
สีเดียวกันหมด — สว่าง `bg rgb(236,253,245)` / `fg rgb(6,95,70)` · มืด `bg rgba(2,44,34,.7)` /
`fg rgb(110,231,183)` **contrast 9.94** · tooltip = "ยังไม่ถึงวันที่ต้องการ — ใบล่วงหน้าใช้สีเดียวเสมอ" ·
ใบที่เลยกำหนดยังได้สีตามวันเหมือนเดิม (383 วัน = แดง) · ตารางโชว์ "383 วัน" · การ์ดโชว์ "ผ่านมา 383 วัน"

### รอบ 19 ส.ค. 2569 (รอบยี่สิบห้า · งาน-3) — "ล่วงหน้า" เป็นเขียวชุดเดียวทั้งระบบ

เจ้าของทัก: *"ล่วงหน้าตอนนี้เจอทั้งเขียว และ ส้ม เห่ย แก้ยังไง ล่วงหน้ามันต้องเขียวสิ"*
แล้วเคาะกติกา: *"ถ้าอันไหนมันคือ Logic เดียวกันก็ไปทางเดียวกัน ป้องกัน user งง"*

🔴 **บทเรียน: รอบก่อนแก้แค่ชิป「ผ่านมา」หน้าเดียว แล้วสรุปเอาเองว่าจบ** — ของจริงคำว่า
"ล่วงหน้า" โผล่ 5 ที่ คนละสี (วัดจาก DOM: ชิปผ่านมา = เขียว · ป้ายสถานะใบขอ = **ฟ้า**
`text-info` · Pre-Check = ฟ้า · หน้ารายละเอียดใบขอ = ฟ้า `🔵` · Dashboard ถังอายุ = ฟ้า)

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/requestLeadKind.ts` | **ใหม่ · แหล่งเดียว** `REQUEST_LEAD_KIND_TONE` = retroactive:danger · urgent:warn · **advance:success** |
| `src/lib/jobUrgency.ts` | `JOB_URGENCY_TONE` (สเกล ERP 2 ค่า) — `advance` อ้าง `REQUEST_LEAD_KIND_TONE.advance` ตรง ๆ ให้เพี้ยนกันไม่ได้ |
| `src/components/jobs/JobUrgencyBadge.tsx` | เลิก `text-info` → ดึงจาก token กลาง · `🔵` → `🟢` |
| `src/pages/matching/PreCheckPage.tsx` | 2 จุด (ชิปบนการ์ด + ชิปในแผงรายละเอียด) ใช้ `TONE[JOB_URGENCY_TONE[...]]` |
| `src/pages/jobs/JobDetailPage.tsx` | ป้ายบนหัวใบขอ · `🔵 ล่วงหน้า` → `🟢 ล่วงหน้า` |
| `src/components/dashboard/analytics/DashboardAgeOverview.tsx` | ถัง `advance` จาก info → `REQUEST_LEAD_KIND_TONE.advance` |
| `src/components/dashboard/analytics/DashboardLeadKindChart.tsx` | ลบ `KIND_TONE` ที่ประกาศซ้ำ → อ้าง token กลาง |
| `tests/api/jobAgeChip.test.ts` | +4 เทสต์คุมว่า advance = success ทั้งสองสเกล และชิปเป็น emerald ห้ามมี sky/orange/red แฝง |

**⚠️ ผลข้างเคียงที่ต้องรู้:** ในกราฟถังอายุบน Dashboard ตอนนี้ **"ล่วงหน้า" กับ "1–7 วัน"
เป็นเขียวเหมือนกัน** (เดิม advance ฟ้าเพื่อแยกจากถังข้าง ๆ) — ป้ายกำกับยังต่างกัน
แต่ถ้าเจ้าของอยากให้แยกสี ต้องขยับถัง "1–7 วัน" ไม่ใช่ขยับ "ล่วงหน้า"

### รอบ 19 ส.ค. 2569 (รอบยี่สิบห้า · งาน-4) — การ์ดเหลือ 2 ปุ่ม · Gen link/แก้ไข ย้ายเข้าป๊อปอัป

เจ้าของเคาะ: *"เหลือแค่ดูรายชื่อ กับ หาผู้สมัครเพิ่ม"* + ถาม Choice แล้วเลือก
**"ย้ายไปอยู่ในป๊อปอัปที่กดการ์ด"**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/JobBoardView.tsx` | ถอดปุ่ม Gen link + แก้ไข ออกจาก footer การ์ด · ใส่ไว้ท้ายป๊อปอัปรายละเอียด (staff + ไม่ใช่กล่องปิด/ยกเลิก) |

🔴 **ทำไมต้องถามก่อนถอด** — Gen link ของ**ใบขอ** กับ แก้ไขประกาศ มีทางเข้าอยู่ที่ปุ่มบนการ์ด
**ที่เดียว** (ปุ่ม "สร้างลิงก์" บนแถบหัวเป็นของ*ประกาศลอย* คนละตัว · แท็บที่เคยรับงานต่อ
ถอดไปแล้ว 19 ส.ค.) ถอดเฉย ๆ = ฟีเจอร์หายทั้งตัว
* เงื่อนไข "แก้ไขประกาศ" ยังเป็น `latestPostingByJob.has(job.id)` ตัวเดิม (ใบที่ยังไม่มีประกาศ
  ต้องกด Gen link ก่อน) · ใบปิด/ยกเลิกไม่มีปุ่มทั้งคู่
* **ตรวจจริง:** การ์ดเหลือ `หาผู้สมัครเพิ่ม · ดูรายชื่อ` ทุกใบ · ป๊อปอัปใบที่ไม่มีประกาศ =
  `Gen link` · ป๊อปอัปใบที่มีประกาศ (LBM6908002) = **`Gen link` + `แก้ไขประกาศ`**

### รอบ 19 ส.ค. 2569 (รอบยี่สิบห้า · งาน-5) — หน้ารายชื่อในกล่องเป็น 2 แท็บทุกขนาดจอ

เจ้าของเคาะ: *"หน้ารายชื่อในกล่องต้องมีแค่ รายชื่อทั้งหมด กับ คนที่สนใจ"* → เลือก
**"เป็น 2 แท็บทุกขนาดจอ"** (เดิมจอ ≥lg กางเป็น 2 คอลัมน์คู่กัน = หน้าเดียวมีสองหน้าตา)

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/JobApplicantsDialog.tsx` | ถอด `lg:hidden` ออกจากแถบแท็บ · **ลบบล็อก 2 คอลัมน์ของจอใหญ่ทั้งก้อน** (21 บรรทัด) เหลือรายการเดียวตามแท็บ |

**ตรวจจริง:** viewport 1440 → เห็นแท็บ `รายชื่อทั้งหมด (0)` / `คนที่สนใจ (0)` และ
`.lg:grid-cols-2` ในป๊อปอัป = ไม่มีแล้ว

### รอบ 19 ส.ค. 2569 (รอบยี่สิบห้า · งาน-6) — ป๊อปอัปการ์ดมีแท็บไอคอน 3 อัน ชิดขวา

เจ้าของอธิบายเพิ่ม: *"ในกล่องงานฉันหมายถึงว่าอยากได้แบบ icon right เริ่มจากพอกดเข้าไป
เจอรายละเอียดงาน ต่อมาเป็นแก้ไข ต่อมาเป็น gen link"* → ทำ mockup 3 แบบให้เลือก
เจ้าของเคาะ **"แท็บมีไอคอน 3 อัน ชิดขวา · กดแล้วเนื้อกลางเปลี่ยนในป๊อปเดิม"**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/GenApplyLinkDialog.tsx` | เพิ่ม prop `embedded` — คืน**เนื้อฟอร์มเปล่า ๆ** ไม่ห่อ Dialog (แยก `body` ออกมาเป็นตัวแปร ใช้ร่วมกับโหมด Dialog เดิม) |
| `src/components/jobs/EditPostingDialog.tsx` | เพิ่ม prop `embedded` แบบเดียวกัน |
| `src/components/jobs/JobBoardView.tsx` | state `popupTab` ('detail' \| 'edit' \| 'genlink') · แถบไอคอน 3 อันชิดขวาบนหัวป๊อปอัป · เนื้อกลางสลับตามแท็บ · **ลบ state `genLinkJob`/`editPosting` + Dialog สองตัวนั้นทิ้ง** (ไม่ใช้แล้ว) |

**กับดัก**
* 🔴 **ห้ามซ้อน Dialog ใน Dialog** — จึงต้องมีโหมด `embedded` ไม่ใช่เรียก Dialog ซ้อน ·
  ตรวจแล้วว่า `[role="dialog"]` มีแค่ 2 ตัว (แผงเมนู + ป๊อปอัปการ์ด) ไม่มีซ้อน
* 🔴 **เช็คก่อนว่า dialog ที่จะฝังทำอะไรตอน mount** (บทเรียน `RecruitLaneDialog` ยิง `send=1`
  ตอน mount) — ทั้งสองตัวนี้ **ไม่เขียนอะไรตอน mount** `createRecruitPosting` ยิงตอนกดบันทึกเท่านั้น
* ⚠️ แท็บ "แก้ไขประกาศ" โผล่**เฉพาะใบที่มีประกาศแล้ว** (`latestPostingByJob.has(id)`)
  ใบที่ยังไม่มีต้องกด Gen link ก่อน (กติกาเดิม ไม่เปลี่ยน)
* ⚠️ ใบที่ปิด/ยกเลิกแล้วเหลือแท็บ "รายละเอียดงาน" อันเดียว · หน้าสาธารณะไม่มีแท็บเลย
* บันทึกในแท็บแก้ไขสำเร็จ → เด้งกลับแท็บรายละเอียด + รีเฟรชรายการประกาศ (`postingsRev`)

**ตรวจจริง (วัดจาก DOM):** ใบที่ยังไม่มีประกาศ = ไอคอน `[รายละเอียดงาน, Gen link]` ·
ใบที่มีประกาศ (LBM6908002) = `[รายละเอียดงาน, แก้ไขประกาศ, Gen link]` ครบ 3 ·
กด Gen link → เนื้อกลางเป็นฟอร์ม "หัวข้อประกาศ *" ในป๊อปเดิม `aria-pressed` สลับถูก ·
กดแก้ไข → ฟอร์มแก้ไข · กดกลับรายละเอียดได้ · กล่องปิดแล้ว = 1 ไอคอน · /apply = 0 ไอคอน ·
โหมดมืด: แท็บที่เลือก bg น้ำเงิน `rgb(30,64,175)` ไอคอนขาว · ที่ไม่เลือกอ่านออก

### รอบ 20 ส.ค. 2569 (รอบยี่สิบหก · งาน-1) — ป๊อปอัปการ์ดต้องเจอ 3 ปุ่มเสมอ

เจ้าของสั่ง: *"หน้ากล่องงานปุ่มแก้ไขมันต้องมาอยู่ด้วยกันกับกล่องงานอะ เปิดมาต้องเจอ 3 ปุ่ม
1.รายละเอียดงาน 2.แก้ไข 3.Gen link"*

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/JobBoardView.tsx` | แท็บ "แก้ไข" **โชว์เสมอ** (ถอดเงื่อนไข `latestPostingByJob.has(id)` ออกจากการโชว์ไอคอน) · ใบที่ยังไม่มีประกาศ กดแล้วเจอคำอธิบาย + ปุ่ม "ไปหน้า Gen link" |

🔴 **บทเรียน:** เดิมซ่อนแท็บแก้ไขเมื่อใบยังไม่มีประกาศ → บางใบเห็น 2 ปุ่ม บางใบเห็น 3 ปุ่ม
**ไม่คงที่** เจ้าของจึงทัก · จำนวนปุ่มบนจอต้องเท่ากันทุกใบ ส่วนสถานะ "ยังทำไม่ได้"
ให้บอกในเนื้อ **ห้ามซ่อนปุ่ม** และห้ามปล่อยเป็นทางตัน (ต้องมีทางไปต่อ)

**ตรวจจริง:** ใบไม่มีประกาศ = ไอคอน `[รายละเอียดงาน, แก้ไข, Gen link]` ครบ 3 · กดแก้ไข →
"ใบนี้ยังไม่มีประกาศให้แก้" + ปุ่มพาไป Gen link (กดแล้ว `aria-pressed` ของ Gen link = true) ·
ใบมีประกาศ (LBM6908002) = 3 ไอคอนเหมือนกัน · กดแก้ไข → ฟอร์ม "หัวข้อประกาศ *" จริง

### รอบ 20 ส.ค. 2569 (รอบยี่สิบหก · งาน-2) — ถอดไอคอนดินสอบนการ์ด · ฟอร์มย้ายเข้าแท็บ "แก้ไข"

เจ้าของสั่ง (ส่ง HTML ของปุ่มมาให้ตรง ๆ): *"เอาออกที"* — ไอคอนดินสอเล็ก ๆ มุมขวาบนการ์ด
(`aria-label="แก้ข้อมูลประกาศ"`) · ถามก่อนเพราะเป็น**ทางเข้าเดียว**ของฟอร์มนั้น
เจ้าของเคาะ **"ย้ายไปรวมในแท็บ แก้ไข"**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/EditPublicJobFieldsDialog.tsx` | เพิ่ม prop `embedded` (คืนเนื้อฟอร์มเปล่า ๆ) |
| `src/components/jobs/JobBoardView.tsx` | ถอดไอคอนดินสอออกจากหัวการ์ด · แท็บ "แก้ไข" เป็น **2 ส่วน**: ข้อความประกาศ (`EditPostingDialog`) + **ข้อมูลที่จะขึ้นประกาศ** (`EditPublicJobFieldsDialog`) · ลบ state `editPublicJob` + Dialog ตัวเดิมทิ้ง |

🔴 **ทำไมต้องถามก่อน** — ฟอร์มนี้เป็นทางเดียวที่แก้ 3 อย่างที่ ERP ไม่มีให้:
จังหวัด/อำเภอ/ตำบลบนประกาศ · รายได้รวม · **สวัสดิการที่ติ๊กเพิ่ม** (ตัวที่งานค้างข้อ
"รอเจ้าของส่งรายการสวัสดิการจริง" อ้างถึง) — ถอดเฉย ๆ = ทั้งสามอย่างแก้ไม่ได้อีกเลย

**ผลพลอยได้:** แท็บ "แก้ไข" **ไม่เป็นทางตันอีกแล้ว** — ใบที่ยังไม่มีประกาศก็ยังแก้
"ข้อมูลที่จะขึ้นประกาศ" ได้ (ส่วนข้อความประกาศขึ้นโน้ต + ปุ่มพาไป Gen link)

**ตรวจจริง (วัดจาก DOM):** `button[aria-label="แก้ข้อมูลประกาศ"]` บนหน้า = **0 อัน** ·
การ์ดเหลือ `[หาผู้สมัครเพิ่ม, ดูรายชื่อ]` · แท็บแก้ไขมีครบ 2 ส่วน (โน้ตประกาศ + ฟอร์ม
จังหวัด/อำเภอ/ตำบล · รายได้ · สวัสดิการ · ปุ่มยกเลิก/บันทึก) ·
🔴 **ยิงเส้นเขียนจริง**: กดบันทึก → `POST /api/siamraj/unit-notes` **200 OK**
(บันทึกค่าเดิมทับ = ข้อมูลไม่เปลี่ยน) แล้วเด้งกลับแท็บรายละเอียดถูกต้อง

**เพิ่มเติม 20 ส.ค. 2569 (งาน-2 ต่อ):** เจ้าของสั่งถอด**โน้ต "ใบนี้ยังไม่มีประกาศ —
กด Gen link สร้างก่อน" + ปุ่ม "ไปหน้า Gen link"** ออกจากแท็บแก้ไข เพราะ *"มันอยู่อีกหน้าแล้ว"*
(Gen link เป็นแท็บข้าง ๆ อยู่แล้ว โน้ตจึงเป็นของซ้ำ) · ใบที่ยังไม่มีประกาศ แท็บแก้ไข
เข้าตรง "ข้อมูลที่จะขึ้นประกาศ" ทันที
🔴 **บทเรียน: อย่าใส่ป้ายชวนไปที่อื่น ถ้าที่นั่นเป็นแท็บที่มองเห็นอยู่แล้วบนจอเดียวกัน**
ตรวจจริง: ใบไม่มีประกาศ → ไม่มีทั้งโน้ตและปุ่ม เข้าฟอร์มตรง · ใบมีประกาศ (LBM6908002)
→ ยังมี 2 ส่วนครบ (ฟอร์มข้อความประกาศ + ข้อมูลที่จะขึ้นประกาศ)

### รอบ 20 ส.ค. 2569 (รอบยี่สิบหก · งาน-3) — กดหัวคอลัมน์เรียงตารางหน้ารายการใบขอ

เจ้าของสั่ง: *"ทำเป็นกดเลือกได้ไหมว่าจะเรียงลำดับอันไหน เช่น เรียงจากมากไปน้อยของใบขอ"*
\+ *"เช็คด้วยว่ารันเรียงตามที่เลือกจริงไหม"*

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/jobListTableSort.ts` | **ใหม่ · pure** — 14 คอลัมน์ · `toggleTableSort` · `parseTableSort`/`serializeTableSort` (URL `tsort=<col>:<dir>`) · `compareJobsByTableColumn` (เทสต์ 11) |
| `src/lib/jobListPageState.ts` | เก็บ `tableSort` ลง URL param `tsort` (parse ไม่ผ่าน = null ไม่ throw) |
| `src/pages/jobs/JobListPage.tsx` | หัวคอลัมน์ทั้ง 14 เป็นปุ่ม + ลูกศร ▲▼ + `aria-sort` · ชิป "เรียงจากคอลัมน์ X · ล้าง" · เลือก dropdown = ล้าง `tableSort` |

**กติกาที่ล็อกไว้**
* 🔴 **กดเรียงได้ทุกคอลัมน์** — กดได้บางอันไม่ได้บางอัน = ของที่เจ้าของทักว่า "ไม่คงที่"
* 🔴 **ค่าว่างตกท้ายเสมอ** ทั้ง asc/desc (ช่องว่างห้ามชนะใบที่มีข้อมูลจริง)
* 🔴 **ลำดับต้องนิ่ง** — ค่าเท่ากันตัดด้วยเลขที่ใบขอ ไม่งั้นกดหน้า 2 เห็นใบซ้ำ/หาย
* 🔴 **มีตัวเรียงที่มีผลทีละหนึ่งตัว** — กดคอลัมน์ทับ dropdown แล้วขึ้นชิปบอก + ปุ่มล้าง
  (สองตัวเรียงพร้อมกันคนอ่านไม่รู้ว่าอันไหนมีผล)
* ทิศตั้งต้น: ตัวเลข/วันที่ = `desc` (อยากเห็นมากสุด/ล่าสุดก่อน) · ข้อความ = `asc`
* ⚠️ **ตารางโผล่เฉพาะจอกว้าง** — จอแคบ (หรือ browser pane ที่ `innerWidth = 0`) เรนเดอร์
  เป็นการ์ด ไม่มี `<thead>` ให้กด · ตรวจต้อง `resize_window` ให้กว้างก่อน

**ตรวจจริงบนหน้าจอ (ไม่ใช่แค่เทสต์)**
* เลขที่ใบขอ asc → `DSO6709001, DSO6809001, DSO6810008…` · desc → `SQ6908002, SQ6908001…`
* คงเหลือ desc → `16, 10, 8, 5, 3, 3` (เช็คด้วยโค้ดว่าลดหลั่นจริงทุกแถว) · asc → `1,1,1…`
* วันที่ต้องการ desc → `9/10/2569` ขึ้นก่อน `1/10/2569`
* URL เปลี่ยนตามทุกครั้ง (`?tsort=request_no:asc` → `:desc` → `?tsort=remaining:desc` …)
* ชิป "เรียงจากคอลัมน์ วันที่ต้องการ ▼ · ล้าง" กดล้างแล้ว `tsort` หายจาก URL ·
  เลือก dropdown แล้วได้ `?sort=oldest` (tsort ถูกล้างให้เอง)

**แก้ตาม 20 ส.ค. 2569 — คอลัมน์ "ผ่านมา" เรียงมั่ว (เจ้าของทัก):** *"เรียงมั่วมาก
เดี๋ยว 0 เดี๋ยว ล่วงหน้า"*
🔴 **ต้นเหตุ: เรียงตามค่าที่ซ่อนอยู่ ไม่ใช่สิ่งที่ช่องนั้นโชว์** — ใบที่ยังไม่ถึงวันที่ต้องการ
ช่องนี้เขียนว่า "ล่วงหน้า" แต่ `getJobRequestAgeDays` คืนจำนวนวันนับจาก**วันที่กรอก**
(เช่น 45) ใบล่วงหน้าจึงไปแทรกกลางระหว่าง `0 วัน` กับ `3 วัน`
👉 แก้เป็น **เส้นเวลาเดียวเทียบวันที่ต้องการ**: ล่วงหน้า = ค่าลบ (`-1 - daysUntilRequired`)
→ `0` = ถึงกำหนดวันนี้ → บวก = ผ่านมาแล้วกี่วัน · ใบล่วงหน้าเกาะกลุ่มปลายเดียวเสมอ (+3 เทสต์)
🔴 **บทเรียนกว้าง ๆ : คอลัมน์ไหนที่ข้อความบนจอไม่ใช่ตัวเลขดิบ ต้องเรียงตามสิ่งที่โชว์**
และ**ตรวจให้ครบทุกคอลัมน์** — รอบก่อนผมตรวจแค่ 3 คอลัมน์ (เลขที่ใบขอ/คงเหลือ/วันที่ต้องการ)
บั๊กนี้จึงหลุดขึ้น prod
ตรวจจริงบนหน้าจอ: asc → "ล่วงหน้า" เป็นก้อนเดียวหน้าสุด (นับ block ได้ 1) ·
desc → 841, 834, 707, 582, 535, 507, 507, 499 ลดหลั่นจริงทุกแถว ไม่มีล่วงหน้าแทรก

**แก้ตาม 20 ส.ค. 2569 (ต่อ):** เจ้าของสั่งถอดชิป "เรียงจากคอลัมน์ X ▼ · ล้าง" ออก —
*"ไม่ต้องโชว์ก็ได้นะ ปล่อยไปเลย กดเรียงก็ปล่อยเรียงเลย"* · ลูกศร ▲▼ บนหัวคอลัมน์
บอกอยู่แล้วว่าเรียงอะไร · ทางกลับไปใช้ dropdown ยังมี (เลือก dropdown = ล้าง `tsort` ให้เอง)
พร้อมกันนั้นให้ป้ายหัวคอลัมน์ดึงจาก `JOB_LIST_TABLE_COLUMN_LABEL` ที่เดียว (เดิมพิมพ์ซ้ำใน array)

### รอบ 20 ส.ค. 2569 (รอบยี่สิบหก · งาน-3) — ชุดใหญ่บอร์ดรับสมัคร 12 ข้อของเจ้าของ

เจ้าของสั่งเป็นลิสต์ 12 ข้อ (จบท้ายว่า *"มีไรสงสัยถามมา"*) — ถาม Choice 4 เรื่องก่อนลงมือ
(ขอบเขตรื้อ UI · ข้อ 6 ต้องทำอะไรเพิ่ม · ตำแหน่งกล่องสนใจ/ไม่สนใจ · ตำแหน่งปุ่ม iRecruit)

| ข้อ | สรุป | commit |
|---|---|---|
| 1 | จัดระเบียบหัวบอร์ด (ปุ่มตั้งค่ายุบเข้า dropdown "ตั้งค่าบอร์ด") + ล้าง radius/hex เฉพาะไฟล์บอร์ด | `205be9c` |
| 2 | ถอดแถบ ทั้งหมด/ด่วน ทั้งฟีเจอร์ (รวม skipUrgencyChip ที่หมดความจำเป็น) | `6b436fd` |
| 3 | เพดาน /api/public/jobs 200→500 — ใบเก่าตกขอบ (เคสกันยง อันดับ 201/216/283 จาก 284) | `8b03adc` |
| 4-5 | ป๊อปการ์ดเป็น stepper ①รายละเอียด→②แก้ไข→③Gen link + ปุ่ม "ถัดไป" (ข้อ 5 ได้ฟรี — override เขียนที่ public jobs อ่านอยู่แล้ว) | `d351c7a` |
| 6 | ✅ ยืนยันเดินจริงจาก prod: ใบ apply_page 13:41:51.53 เข้าคิว .58 (0.05 วิ) — ไม่แก้ | — |
| 7 | ปุ่ม "เพิ่มผู้สมัคร" ในป๊อปดูรายชื่อ ผูกใบขอ (AddApplicantDialog embedded + API รับ job_id) | `76a70fa` |
| 8-9 | แท็บ "ไม่สนใจ" (declined+wrong_person) · ข้อ 9 มีอยู่แล้ว พิสูจน์ครบวง claim→การโทรของฉัน | `454ff8d` |
| 10-11 | เครื่องมือที่คนสนใจ: โทร (tel:) · ประมวลผล (ApplicantContactDialog embedded) · เอาออก (Lead) | `5e67abd` |
| 12 | บอร์ดสรุปนัด (นัดทั้งหมด/มา/ไม่มา/รอผล + ตารางรายวัน) — `src/lib/appointmentBoard.ts` ใหม่ +4 เทสต์ | `48b531e` |

**กับดักที่เจอ/กติกาที่เกิดในรอบนี้**
* 🔴 **INSERT…RETURNING ที่ใช้ชุดคอลัมน์มี derived (origin อ้าง alias `a`) ต้อง
  `insert into ${tbl} as a`** — POST เพิ่มผู้สมัครตาย 500 มาตั้งแต่ 16 ส.ค. โดยไม่มีใครรู้
  (เจอเพราะยิงเส้นเขียนจริง) · ตระกูลเดียวกับบั๊ก PATCH เดิม
* 🔴 "ไม่สนใจ" = declined + wrong_person เท่านั้น · no_answer/busy/unresponsive
  = ยังติดต่อไม่ได้ ต้องตามต่อ (เทสต์คุมใน applicantCallOutcome)
* จำลอง "คนสนใจ" อย่างปลอดภัย: insert `candidate_call_holds` ด้วย**เบอร์ปลอมที่ไม่ชนใคร**
  (+66999999903) result_outcome='confirmed' → ลบด้วย id · ระวัง CHECK constraint
  source/result_scope (ค่าที่ใช้ได้: source=board/irecruit/application · scope=job/all/scheduled/unscheduled)
* embedded pattern ขยายไปอีก 2 ตัว: `AddApplicantDialog` · `ApplicantContactDialog`
  (รวมของเดิม = 5 ตัวที่มีโหมดนี้)
* ป๊อปดูรายชื่อ ตอนนี้มี 3 มุมมองใน: รายชื่อ (3 แท็บ) · เพิ่มผู้สมัคร · ประมวลผล

### รอบ 20 ส.ค. 2569 (รอบยี่สิบหก · งาน-4) — หน้า Settings เป็นเมนูซ้ายแบ่งกลุ่ม

เจ้าของทัก: *"หน้า Setting ตอนนี้มันสะเปะสะปะมาก"* → วัดของจริงเจอ 4 ปัญหา แล้วถามให้เคาะ
เจ้าของเลือก **"เมนูซ้ายแบ่งกลุ่ม"** + **"เปลี่ยนเป็นไทยให้หมด"**

**ปัญหาที่วัดได้ (ก่อนแก้)**
1. **12 แท็บแถวเดียวเลื่อนซ้ายขวา** — เห็นพร้อมกันจริง ~8 อัน (`สถานะระบบ · Reference Data · Audit Log` ตกขอบ)
2. **ไม่มีการจัดกลุ่ม** — ธีม/โลโก้ อยู่ติด Users ติด น้ำหนักเรียงผู้สมัคร ติด Audit Log
3. **ไทยปนอังกฤษ** — Users · Roles · Reference Data · Audit Log
4. **ป้ายยาวไม่เท่ากันสุดขั้ว** — `สรรหา / คัดสรร / OPL / Online` (29 ตัว) ข้าง `Roles` (5 ตัว)

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/settingsNav.ts` | **ใหม่ · pure** — 12 แท็บ · ป้ายไทย · คำอธิบายใต้ชื่อ · **5 กลุ่ม** (`people` `look` `automation` `data` `monitor`) · `isSettingsTabId` · `buildSettingsNav(allowed)` (เทสต์ 9) |
| `src/pages/settings/AdminSettings.tsx` | แท็บแถวเดียว → **เมนูซ้าย 16rem (lg+) + ดรอปดาวน์ shadcn Select (จอเล็ก)** · ไอคอนอยู่ที่ `TAB_ICON` ในไฟล์หน้า · เนื้อหาย้ายเข้าคอลัมน์ขวา `min-w-0` |

**ป้ายไทยที่เปลี่ยน:** Users → ผู้ใช้งาน · Roles → บทบาทและสิทธิ์ · Reference Data → ข้อมูลอ้างอิง
· Audit Log → บันทึกการใช้งาน · สรรหา/คัดสรร/OPL/Online → ทีมสรรหา / คัดสรร / OPL / Online

**กับดัก / ของแถม**
* 🔴 **เทสต์คุมว่าทุกแท็บต้องอยู่กลุ่มใดกลุ่มหนึ่ง** และผลรวมทุกกลุ่ม = 12 ไม่ซ้ำไม่ตกหล่น
  (เพิ่มแท็บใหม่แล้วลืมจัดกลุ่ม เทสต์จับได้) + เทสต์ว่าป้ายทุกอันต้องมีอักษรไทย
* 🔴 **บั๊กเดิมที่เจอตอนรื้อ: `?tab=navMenu` ใช้ไม่ได้** — ตัวคัดค่าจาก URL ไล่เทียบชื่อทีละอัน
  11 บรรทัดแล้ว**ลืม `navMenu`** ลิงก์นั้นจึงเด้งกลับ `users` เสมอ · แก้เป็น `isSettingsTabId` ตัวเดียว
* ⚠️ จอเล็กใช้ **ดรอปดาวน์** (จัดกลุ่มด้วย `SelectGroup` เหมือนกัน) — **ห้ามกลับไปเป็นแถวเลื่อนซ้ายขวา**
* ⚠️ ตารางผู้ใช้มี `overflow-x-auto` ของตัวเองอยู่แล้ว — คอลัมน์ขวาต้องมี `min-w-0` ไม่งั้น grid ดันหน้าทั้งหน้า

**ตรวจจริง (วัดจาก DOM):** เมนูซ้ายขึ้น **5 กลุ่ม / 12 หัวข้อครบ** ไม่มีป้ายอังกฤษเหลือ (นับได้ 0) ·
กด "บันทึกการใช้งาน" → `aria-current` ย้ายถูก เนื้อหาเปลี่ยน · กด "สถานะระบบ" → ย้ายถูก ·
ตารางผู้ใช้เลื่อนในกล่องตัวเอง (`scrollWidth > clientWidth`) ไม่ดันหน้า ·
`?tab=navMenu` เข้าได้แล้ว · โหมดมืด: ตัวที่เลือก bg `rgba(30,41,59,.5)` ตัวอักษร `rgb(233,233,237)` อ่านออก

### รอบ 20 ส.ค. 2569 (รอบยี่สิบหก · งาน-5) — จัดหน้ากล่องงาน: ดันการ์ดขึ้นจอแรก

เจ้าของทัก: *"หน้า Ui ในหน้าบอร์ดรับสมัครงาน หน้ากล่องงาน ยังไม่แก้เลย"* → วัดของจริงที่ 1440×900
แล้วถามให้เคาะ เจ้าของเลือก **"ดันการ์ดขึ้นจอแรก"** + **"เปลี่ยน `<button>` เป็น shadcn Button พร้อมกัน"**

**ตัวเลขก่อน/หลัง (วัดที่จอ 1440×900)**
| | ก่อน | หลัง |
|---|---|---|
| การ์ดงานใบแรกเริ่มที่ | **Y=734px** (จอสูง 900 → เห็นครึ่งใบ) | **Y=561px** (เห็นเต็มแถวแรก) |
| แผงตัวกรอง | 209px กางค้าง | **79px** (ยุบเป็นแถวเดียว กดกาง) |
| กล่องสถานะ | 4 บรรทัด/กล่อง | **2 บรรทัด** (คำอธิบายไป `title`) |
| ปุ่ม Pre-Check | ลอยเดี่ยวเป็นแถวของตัวเอง 28px | ย้ายเข้าเมนู "ตั้งค่าบอร์ด" |

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/JobBoardTopFilters.tsx` | ดรอปดาวน์ 6 ช่อง **พับไว้ก่อน** · ปุ่ม "ตัวกรอง" กดกาง/พับ (จอใหญ่) · บรรทัด "พบ N" ย้ายมาอยู่แถวเดียวกับปุ่ม · padding p-4/md:p-5 → p-3/md:p-4 · 🔴 **กางเองเมื่อมีตัวกรองเปิดอยู่** (คนจะได้ไม่สงสัยว่าผลน้อยเพราะอะไร) |
| `src/components/jobs/JobBoardView.tsx` | กล่องสถานะเหลือ 2 บรรทัด · ถอดแถว Pre-Check · ส่ง `extraMenuItems` เข้าเมนูตั้งค่าบอร์ด · `<button>` 6 จุด → `ui/button` |
| `src/components/jobs/RecruitBoardTools.tsx` | รับ prop `extraMenuItems` ต่อท้ายเมนู "ตั้งค่าบอร์ด" |

**🔴 กับดักใหญ่ที่เจอ: `ui/button.tsx` เป็นธีมสว่างล้วน**
variant ในนั้นเขียน `bg-white/50` · `border-white/80` · `default: bg-[#141210]` (hex ดิบ)
**ไม่มีคู่ `dark:` เลยแม้แต่ตัวเดียว** → พอเปลี่ยนมาใช้ `<Button variant="outline">` ตรง ๆ
โหมดมืดได้พื้น `rgba(255,255,255,.5)` ตัวหนังสือ emerald-300 = อ่านแทบไม่ออก
👉 แก้ด้วยการ **ทับ className ด้วย `TONE.*.outline` / `TONE.*.solid`** ที่มีคู่ dark ครบ
(tailwind-merge ให้ตัวหลังชนะ) — ใช้ component ของ shadcn ตามกติกา แต่สีมาจาก designTokens ตามกติกาข้อ 4
⚠️ **การแก้ `ui/button.tsx` ให้รองรับโหมดมืดจริง ๆ เป็นงานทั้งระบบ — รอวันเสาร์ตามที่เจ้าของสั่งเลื่อน**

**ที่ยังไม่แตะ (บอกเจ้าของแล้ว)**
* **`<button>` ที่เป็น "การ์ดกดได้" กับ "แท็บ"** (กล่องสถานะ 7 กล่อง · แท็บมุมมอง 5 อัน ·
  แท็บไอคอนในป๊อปอัป) — พวกนี้ไม่ใช่ Button ในความหมายของ design system
  ถ้าจะให้ถูกจริงควรเป็น `ui/tabs` + การ์ด ไม่ใช่ยัด `Button` เข้าไป
* **"กล่องลอย (ไม่ผูกใบขอ)" ยังอยู่ล่างสุด (Y=3,257px)** — ตอนถามผมเสนอว่าจะย้ายขึ้นมาติด
  กล่องสถานะ แต่ **ทำแล้วขัดกับเป้าหมายเอง** เพราะก้อนนั้นสูง 493px จะดันการ์ดตกจอไปอีก
  จึงยังไม่ย้าย รอเจ้าของเคาะว่าจะให้ทำเป็นกล่องในแถวสถานะ (กดแล้วสลับการ์ด) หรือแบบอื่น

**ตรวจจริง (วัดจาก DOM):** การ์ดขึ้นจอแรกจริง (561 < 900) · กดปุ่มตัวกรอง → ดรอปดาวน์
0→6 ช่อง การ์ดขยับ 561→668 กดปิดกลับมา 561 · กล่องสถานะ `innerText` เหลือ 2 บรรทัดทุกกล่อง ·
ไม่มีปุ่ม Pre-Check ลอยแล้ว (นับได้ 0) · การ์ดเหลือ 2 ปุ่ม ·
โหมดมืดปุ่มพื้น `rgb(15,23,42)` ตัวหนังสือ emerald-300/sky-300 · โหมดสว่างพื้นขาวตัวหนังสือเข้ม

### รอบ 20 ส.ค. 2569 (รอบยี่สิบหก · งาน-6) — รายได้แบบแยกส่วน + สวัสดิการ freetext + ซ่อนใบเริ่มงาน

เจ้าของสั่งชุดใหญ่เรื่องประกาศ (ถามเป็น Choice แล้วเคาะ 3 ข้อ):
1. ยอดรวมใส่เอง > ผลบวก → **เติมบรรทัด "อื่น ๆ (เช่น OT)" ให้เลข balance**
2. สวัสดิการ → **Freetext ล้วน จำกัดจำนวน** (5 รายการ × 30 ตัวอักษร)
3. ใบสถานะ "เริ่มงานแล้ว" → **ซ่อนจากหน้าสาธารณะด้วย**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/incomeBreakdown.ts` | **ใหม่ · pure** — `buildIncomeDisplay` (กติกา balance: override > ผลบวก → เติมอื่น ๆ · override < ผลบวก → ใช้ผลบวก "เลขห้ามโกหกลง") · `cleanIncomeBreakdown` · `cleanBenefitLines` · เพดาน 10 รายการ×30 ตัว / 5×30 (เทสต์ 10) |
| `src/lib/publicJobVisibility.ts` | HIDDEN เพิ่ม `daily_work` + `daily_pay` (รวมเป็น 4 สถานะ) |
| `src/lib/extraBenefits.ts` | `benefitDisplayLabels` — รับทั้งคีย์เก่า (แปลงเป็น label) และข้อความอิสระใหม่ (คืนตรง ๆ) **ใบที่ติ๊กไว้เดิมห้ามหายเงียบ** |
| `api/_lib/siamrajUnitNotes.ts` | sanitizer: `benefits` freetext 5×30 · `income` ใหม่ (เพดานเดียวกับ lib) |
| `api/_handlers/public/jobs.ts` | `income_display` ผ่าน `buildIncomeDisplay` · **ชนะ breakdown อัตโนมัติจาก ERP** (ไม่ส่ง base/items ของ ERP ซ้อน) · รายเดือน → `monthly_income = total` (รายวันไม่ยัด — คนละหน่วย) |
| `api/_handlers/siamraj-unit-requests.ts` | แนบ `income_display` ให้ feed staff — ป๊อปกล่องงานเห็นเหมือนผู้สมัครเป๊ะ |
| `src/components/jobs/EditPublicJobFieldsDialog.tsx` | ฟอร์มรายได้ใหม่: หน่วยวัน/เดือน · แถวรายการ (datalist ชื่อแนะนำ 10 ตัว) · ยอดรวมใส่เอง · **preview "ผู้สมัครจะเห็น" ใช้ตัวคำนวณเดียวกับหน้าจริง** · สวัสดิการเป็น textarea บรรทัดละรายการ + ตัวนับ/คำเตือนเกินโควตา |
| `src/components/jobs/EditPostingDialog.tsx` | ช่อง "สถานที่ทำงาน" **read-only** (เจ้าของสั่ง) + ชี้ไปแก้ที่ dropdown พื้นที่ทำงาน — กันสองช่องขัดกันเอง |
| `src/components/jobs/JobBoardView.tsx` | การ์ด: `฿20,000 ต่อเดือน` จาก income_display มาก่อน · ป๊อป: บล็อก "คิดจาก" ของ breakdown ที่ตั้งเอง (ไม่โชว์ซ้อนกับของ ERP) |
| `src/types/index.ts` | `income_display` + `field_overrides.income/benefits/total_income` |

**กับดัก**
* 🔴 **override < ผลบวก = ใช้ผลบวก ไม่ใช่ค่าที่ใส่** — เลขบนประกาศห้ามน้อยกว่าของที่แจกแจง
  (ฟอร์มขึ้นคำเตือนสีเหลืองบอกตรง ๆ)
* 🔴 **breakdown รายวันห้ามยัดใส่ `monthly_income`** — คนละหน่วย การ์ดใช้ `income_display.total`
  + ป้ายหน่วยของตัวเองแทน
* 🔴 ไม่มีรายการ = ช่องยอดรวมทำหน้าที่เดิม (ทับ `total_income` เลขเดี่ยว) — คนที่เคยตั้ง
  เลขเดี่ยวไว้ **ไม่เสียค่า** ตอนบันทึกรอบถัดไป
* ⚠️ `benefits` ใน overrides ตอนนี้ปนสองยุค (คีย์เก่า + ข้อความใหม่) — ทุกจุดแสดงผลต้องผ่าน
  `benefitDisplayLabels` ห้ามใช้ `extraBenefitLabels` ตรง ๆ (ตัวนั้นตัดข้อความอิสระทิ้ง)

**ตรวจจริง (เดินครบวง + คืนค่าเดิมแล้ว):** ตั้ง breakdown เคสตัวอย่างของเจ้าของบนใบ LMM6704005
(15,000+2,000+1,000 ใส่ยอด 20,000) → public API ตอบ 4 บรรทัด + อื่น ๆ 2,000 + monthly 20,000 ·
การ์ดสาธารณะ `฿20,000 ต่อเดือน` · ป๊อป "คิดจาก" ครบ 4 บรรทัด + รวม · ชิปสวัสดิการ freetext
ขึ้นบนการ์ด · ฟอร์มโหลดกลับครบ + preview ตรง · สถานที่ทำงาน readOnly+disabled ·
คืนค่าเดิมแล้ว POST 200 + ป๊อปกลับสภาพเดิม + คีย์เก่า 5 ตัวแปลงเป็นคำอ่านในฟอร์มถูก

### รอบ 20 ส.ค. 2569 (รอบยี่สิบหก · งาน-7) — ย้ายก้อน "นัด → มาไหม" ไปแท็บติดตามนัดหมาย

เจ้าของสั่ง: *"หน้ารายชื่อผู้สมัคร ตรงศูนย์คุมงานสรรหา นัด → มาไหม ย้ายไปหน้าติดตาม
การนัดหมาย เพื่อให้รู้ว่านัดทั้งหมดเท่าไหร่ มาเท่าไหร่ ไม่มาเท่าไหร่"* — ถามเป็น Choice
(เพราะแท็บนัดหมายมีบอร์ด นัดทั้งหมด/มา/ไม่มา อยู่แล้ว กลัวเลขสองชุดซ้อน) เจ้าของเคาะ
**"แค่ย้ายก้อนนั้นไป อันอื่น ๆ เก็บไว้"**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/recruit-rm/RecruitControlPanel.tsx` | ตัดขั้น `appointment` ออกจาก STAGES (เหลือ 4 ขั้น: เข้ามา→โทร→ติดต่อ→เก็บใบสมัคร) + ตัด 4 กล่องของกลุ่ม |
| `src/components/recruit-rm/RmWorkspace.tsx` | แท็บ appointments: แถวกล่อง 4 ใบ "นัด → มาไหม (ยอดทั้งระบบ)" — ดึง `fetchRecruitRmOverview()` (API เดิมตัวเดียวกับศูนย์คุม) เฉพาะตอนอยู่แท็บนี้ · โหลดล้ม = ไม่แสดงแถว |

**กับดัก**
* 🔴 **สองชุดเลขบนหน้าเดียว คนละแหล่ง** — ก้อนที่ย้ายมา = ยอดทั้งระบบจาก
  `/api/recruit-rm-overview` · บอร์ดสรุปนัดข้างล่าง = นับจากรายการในหน้า (ผ่านตัวกรอง)
  ใกล้กันแต่ไม่จำเป็นต้องเท่ากัน → ป้ายหัวก้อนเขียนกำกับว่า "ยอดทั้งระบบ" ชัด ๆ
* ⚠️ กล่อง `scheduled` / `success_unscheduled` เดิมกดแล้ว filter รายชื่อ (`?bucket=`) ได้ —
  ย้ายมาแล้ว**เป็นกล่องดูอย่างเดียว** (แท็บนัดหมายไม่มีระบบ bucket ของหน้ารายชื่อ)
* ⚠️ `attendance` เป็น null ได้ (ก่อน migration 089) → โชว์ขีด ไม่ใช่ 0

**ตรวจจริง (วัดจาก DOM):** แท็บรายชื่อผู้สมัคร — ศูนย์คุมเหลือ 4 ขั้น ไม่มีคำว่า
"นัด → มาไหม"/"สำเร็จ·นัดได้" เหลืออยู่ · แท็บติดตามนัดหมาย — ก้อนขึ้นครบ 4 กล่อง
เลขตรงกับ API เป๊ะ (ตอนตรวจฐานตอบ 0 ทุกช่อง = ค่าจริง ไม่ใช่บั๊กแสดงผล) ·
บอร์ดสรุปนัดยังทำงานตามเดิม (ขึ้นเมื่อมีรายการนัด > 0)

### รอบ 21 ส.ค. 2569 (รอบยี่สิบเจ็ด · งาน-1) — ย้ายประวัติการแก้ไขไปป๊อปกล่องงาน + ถอดช่อง Online จากหน้าใบงาน

เจ้าของ clarify คำสั่งเดิม 18 ส.ค. (*"เพิ่ม log การแก้ไขไว้ด้วยนะหน้ากล่องงาน"*) ที่ตอนนั้น
ถูกทำไว้ที่**หน้าใบงาน**: *"ฉันหมายถึงหน้ากล่องงาน — ของหน้าใบงานทำแบบเดิม เคยไม่มีก็ไม่ต้องมี"*
และ *"ทีม Online (ผู้รับผิดชอบ) มีแค่กล่องงาน"* — สั่ง "อันนี้แก้เลย"

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | ถอด section "ประวัติการแก้ไข" + ช่องเลือก "ทีม Online (ผู้รับผิดชอบ)" + state/effect/payload ของทั้งคู่ (คืนแบบเดิม) |
| `src/components/jobs/JobBoardView.tsx` | เพิ่ม "ประวัติการแก้ไข — ใครแก้อะไรไป" ท้ายแท็บรายละเอียดงานในป๊อปอัปการ์ด (**staff เท่านั้น**) — fetch `fetchUnitEditLog(unitRequestNoteKey(selected))` ตอนเปิดป๊อป |

**กับดัก**
* 🔴 **คีย์ประวัติต้องเป็นตัวเดียวกับที่ audit เก็บ** — audit เก็บ `entity_id = requestNo ที่
  client ส่งตอน save` ซึ่งทุกเส้นใช้ `unitRequestNoteKey()` (externalId || request_no || id)
  → ป๊อปใช้ helper ตัวเดียวกัน คีย์จึงตรง (ตรวจจริง: ประวัติ 6 รายการของ LMM6704005 ขึ้นครบ)
* 🔴 **JobBoardView ใช้ร่วมกับ /apply** — ประวัติ+ชื่อคนแก้เป็นข้อมูลภายใน ต้องกั้น `isStaff`
  ทั้งตัว fetch และตัวแสดงผล
* 🔴 **ถอดช่อง Online แล้ว payload ห้ามส่ง `online_name`** — server เป็น partial update
  (`hasOnline = input.onlineName !== undefined`) ไม่ส่ง = คงค่าเดิม · **ยิงเส้นเขียนจริง
  พิสูจน์แล้ว**: POST ไม่ส่ง online_name → ค่า "ใหม่" ของ LAM6908006 คงเดิม (200)
* ⚠️ ตั้งค่าทีม Online ยังทำได้ที่ Gen link ในกล่องงาน (ทางเข้าไม่หาย)

**ตรวจจริง:** ป๊อปกล่องงานมี "ประวัติการแก้ไข" + ข้อมูลจริงขึ้น · หน้าใบงานไม่มีทั้ง
ประวัติและช่อง Online (role อื่นครบ) · test 1,856 ผ่าน · tsc 3 = 0

### รอบ 21 ส.ค. 2569 (รอบยี่สิบเจ็ด · งาน-2) — ปุ่ม "ลงงานแล้ว" เขียวทึบตลอดเวลา (อ่านเป็นสถานะ)

เจ้าของส่งภาพป๊อปผู้สมัคร (การ์ด #1808 อติกันต์ แสสลับ) แล้วทัก: *"คนนี้อยู่ใน Todo
ทำ[ไม]บอกลงงานแล้ว"*

🔴 **ตรวจฐานก่อนแก้ — สถานะไม่ได้เพี้ยน:** `select ... from candidate_proposals
where candidate_ref='1808' or candidate_name like '%อติกันต์%'` → **0 แถว** ·
แถว proposal ล่าสุดทั้งฐานเป็น `cancelled` ทั้งหมด ไม่มี `placed` เลย
→ ระบบไม่ได้บันทึกว่าลงงาน **เพี้ยนที่สีปุ่ม** ไม่ใช่ที่ข้อมูล

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/candidateProposalsApi.ts` | เพิ่ม `isSolidProposalAction(status, currentStatus)` — **pure** · ทึบได้เฉพาะสถานะปัจจุบันจริง · ไม่มี proposal = ไม่มีปุ่มไหนทึบ |
| `src/pages/matching/MatchingPage.tsx` | `proposalActionButtonClass` รับ `currentStatus` แล้วเรียก helper · call site ทั้ง 4 ส่ง `current?.status` |
| `tests/api/proposalActionSolid.test.ts` | **ใหม่ · 3 เทสต์** — ไม่มี proposal = ไม่มีปุ่มทึบ · "ลงงานแล้ว" ห้ามทึบเมื่อสถานะจริงเป็นอย่างอื่น · ทึบเฉพาะปุ่มที่ตรงสถานะ (ไล่ครบ 6×6) |

**ต้นเหตุในโค้ดเดิม**
```ts
if (status === 'placed') return cn(..., tone.solid);   // ← เจาะจงสถานะ ไม่ได้ดูของจริง
```
ปุ่ม "ลงงานแล้ว" จึงเขียวทึบเด่นกว่าเพื่อนทุกครั้งที่เปิดป๊อป — คนอ่านว่าเป็นสถานะที่บันทึกแล้ว
(ปุ่มอื่นสีจาง = อ่านว่ายังไม่ทำ) ทั้งที่ทั้ง 4 ปุ่มเป็นแค่ "ปุ่มให้กด" เท่ากันหมด

🔴 **บทเรียน: สีทึบ/เข้ม = "นี่คือสถานะปัจจุบัน" ห้ามใช้เป็นสีประจำปุ่ม** — ถ้าจะเน้นปุ่มที่
อยากให้กดบ่อย ใช้ขนาด/ลำดับ/ไอคอน ไม่ใช่ความทึบของสี (ชนกับภาษาสถานะที่ระบบใช้ทั้งระบบ)

**เพิ่มเติม 21 ส.ค. 2569 (งาน-2 ต่อ) — เจ้าของขยายเป้าว่า *"ให้คนไม่งง"*:**
แก้สีเดียวไม่พอ ต้องบอกสถานะให้ชัดด้วย
* **โชว์ "สถานะตอนนี้" เสมอ** — เดิมไม่มี proposal = ไม่โชว์ชิปอะไรเลย คนจึงไปอ่าน
  *ปุ่ม* เป็นสถานะแทน · ตอนนี้ขึ้นชิปเทา `สถานะตอนนี้: ยังไม่ได้เสนอ`
* **บอกว่าแถวนั้นคือปุ่ม** — เพิ่มบรรทัดใต้ปุ่ม: *"แถวนี้คือปุ่มกดเพื่อบันทึก — ปุ่มที่ทึบ
  คือสถานะตอนนี้ · กดปุ่มอื่นเพื่อเปลี่ยนสถานะ"*
⚠️ **ยังไม่ได้เห็นบนจอจริง** — ใบขอบน dev ที่ลองเปิด (OPL6908090 มี 18 แมท) รายชื่อ
ในป๊อป section 1 ไม่เรนเดอร์ให้กดเข้าไปถึงป๊อปรายคน · **ไม่กด "ค้นหาใหม่ด้วย AI"**
เพราะจะยิง re-match บนฐานจริง (ฐาน dev = prod) → พิสูจน์ด้วยเทสต์ตรรกะแทน

### รอบ 21-22 ส.ค. 2569 (รอบยี่สิบเจ็ด · งาน-2) — รื้อ UI หน้าบอร์ดรับสมัคร 🟡 **ยังไม่ commit**

เจ้าของสั่ง *"ออกแบบใหม่เลย ลองนึกว่าถ้าทำใหม่ใช้กติกาใหม่ทำได้ดีกว่านี้ไหม"* แล้วต่อด้วย
*"ทำแล้วรันแบบ local มาดู · อย่าพึ่ง commit&push"* → รัน panel ออกแบบ 4 ทิศทาง + วิจารณ์ + สังเคราะห์
(ผลเต็มที่ `docs/board-redesign-panel-2569-08-21.md` — มี **anti-patterns 22 ข้อ**)

🔴 **panel ให้ 4-4.5/10 ทั้ง 4 ทิศทาง** — ทุกตัวโดนตีตกเพราะเอาเลข 271-277 ที่ถูกตีตกแล้วกลับมา
หรือไปยุบกล่องที่เจ้าของสั่งให้ทำ → **ข้อสรุป: โครงเดิมถูก ที่ผิดคือหน้าไม่บอกอะไรเลย**

| ไฟล์ | ทำอะไร | สถานะ |
|---|---|---|
| `src/lib/jobLinkSilence.ts` | **ใหม่ · pure** — เลือกใบ "ปล่อยลิงก์แล้วยังไม่มีใบสมัคร ≥3 วัน" + เหตุผลจากยอดคลิกจริง + ปุ่มขั้นถัดไป (เทสต์ 10) | 🟡 ยังไม่ commit |
| `tests/api/jobLinkSilence.test.ts` | **ใหม่** — ล็อกว่าใบที่ยังไม่ปล่อยลิงก์ห้ามเข้ากอง (กันกลับไปเป็นกล่องส้ม 277) | 🟡 |
| `src/components/jobs/JobBoardSilentLinks.tsx` | **ใหม่** — แถบในหน้า (ไม่ใช่ Dialog) ซ่อนตัวเองเมื่อไม่มีของ · ปุ่มพาเข้าป๊อป 3 ขั้นเดิม | 🟡 |
| `src/components/jobs/JobBoardTopFilters.tsx` | prop `variant?: 'card'\|'bar'` + `eyebrow` · default = card (/apply ไม่กระทบ) | 🟡 |
| `src/lib/unitRequestDisplay.ts` | `jobBoardCardSubtitle()` ใหม่ — ตัดตำแหน่งที่พิมพ์ซ้ำ (ห้ามแก้ `unitRequestCardSubtitle` ตัวเดิม) | 🟡 |
| `src/components/jobs/JobBoardView.tsx` | กล่องสถานะ `flex-wrap` (เลิกละเมิดกติกาข้อ 7) · ชิปอายุบนการ์ด staff · เรนเดอร์แถบลิงก์เงียบ · `pendingPopupTabRef` | 🟡 |

**กับดักที่เจอตอนทำ**
* 🔴 `<span w-px>` เป็น divider ใน `flex-wrap` จะโดดขึ้นต้นบรรทัดใหม่แบบสุ่ม → ต้องห่อกลุ่มแล้วใส่ `border-l` ที่กลุ่ม
* 🔴 effect รีเซ็ต `popupTab` เป็น `'detail'` ทุกครั้งที่ `selected?.id` เปลี่ยน → ปุ่มที่สั่งแท็บล่วงหน้า
  ต้องผ่าน `pendingPopupTabRef` ไม่งั้นถูกทับทุกครั้ง
* ⚠️ ห้ามย้ายปุ่มตัวกรองออกจาก `JobBoardTopFilters` (สเตต Sheet อยู่ในนั้น มือถือจะไม่เหลือปุ่มเปิด)
* 🐛 **บั๊กเดิม**: ใบล่วงหน้า `siamraj-pre:` vs posting `siamraj-sql:` → จับคู่ไม่ติด
  (กระทบชิป "ปล่อยลิงก์แล้ว" · แท็บแก้ไข · แถบลิงก์เงียบ · channelsByJob) ยังไม่แก้

**ตรวจจริง (1440×900):** การ์ด Y=575 อยู่จอแรก · ไม่มี horizontal scroll ทั้งหน้า ·
ชิปอายุ 843→836→709→584→537→509 วัน · แถบลิงก์เงียบ 1 ใบ · `/apply` ไม่รั่วอะไรเลย ·
โหมดมืดอ่านออก · test 1,869 ผ่าน/6 skip · tsc 3 = 0 · eslint 0 error/18 warning

### รอบยี่สิบแปด · 22 ส.ค. 2569 — Jarvis HUD + ฉาก "ห้องทำงาน" บนหน้าแรก 🟡 **ยังไม่ commit**

เจ้าของสั่ง *"ขอให้ระบบดูล้ำทันสมัยเหมือนแบบ Jarvis ในหนัง Iron man"* + *"หน้าหลักมีตัวละคร
แทนแต่ละแผนก มีโต๊ะทำงาน บอกว่าแต่ละคนตอนนี้กำลังทำอะไร พอเม้าไปจี้จะเห็นสถานะ"*
แผนเต็ม 8 Phase อยู่ที่ `~/.claude/plans/shiny-knitting-glacier.md` (ติ๊ก checkbox ทุกข้อที่ทำเสร็จ)

| ไฟล์ | ทำอะไร | สถานะ |
|---|---|---|
| `src/lib/designTokens.ts` | **+`HUD`** (แผง ink · กริด · มุมวงเล็บ · เลข mono) · **+`HUD_HEX`** (เฉด 300/400 คู่ของ `TONE[..].onDark` สำหรับ SVG บนพื้นเข้ม) · **+`HUD_INK`** (สีตัวหนังสือบนบล็อกสีอิ่ม) | 🟡 |
| `src/index.css` | class จริงของ HUD (`.jarvis-hud-panel/-inner/-corner/-scan/-popover`) · แอนิเมชันฉากห้องทำงาน · **ตัวแปร `--jarvis-ink*` ของปุ่ม** | 🟡 |
| `src/components/ui/button.tsx` | ถอด hex ดิบ `bg-[#141210]` → `var(--jarvis-ink)` + เติมคู่ `dark:` ครบทุก variant | 🟡 |
| `src/components/hud/` | **ใหม่ 4 ตัว** `HudPanel` · `HudStat` · `HudGauge` · `HudTicker` (div + class กลาง แพตเทิร์นเดียวกับ `DASH.card` ไม่ใช่ primitive ใหม่) | 🟡 |
| `src/lib/officeFloor.ts` | **ใหม่ · pure** — แปลงเลขจริงเป็นสถานะ 6 โต๊ะ + ประโยค "กำลังทำอะไร" + พาดหัว (เทสต์ 15) | 🟡 |
| `api/_handlers/office-floor.ts` | **ใหม่** `GET /api/office-floor` — ตัวนับ 5 ก้อน · **reuse `OVERVIEW_BUCKETS`** ไม่เขียนนิยาม "โทรแล้ว" ใหม่ · cache 30 วิ · `withAuth` (ไม่มีข้อมูลบุคคล) | 🟡 |
| `src/components/home/OfficeFloor.tsx` | **ใหม่** ฉาก SVG 6 โต๊ะ + ตัวละคร + HoverCard · มือถือเปลี่ยนเป็นรายการโต๊ะ | 🟡 |
| `src/pages/HomePage.tsx` | เรนเดอร์ฉากเหนือ funnel · ประกอบเลข ERP จาก flow-summary ที่โหลดอยู่แล้ว | 🟡 |

**กับดักที่เจอตอนทำ (จดไว้กันพลาดซ้ำ)**
* 🔴 **ห้ามตั้งต้น state แอนิเมชันจาก `document.hidden`** — พรีวิว/iframe/แท็บพื้นหลังรายงาน
  `hidden` ค้างโดยไม่ยิง `visibilitychange` ตามมา → ฉากนิ่งสนิทหาสาเหตุไม่เจอ
  ให้ตั้งต้น "ขยับ" แล้วค่อยหยุดเมื่อได้ event (เบราว์เซอร์หยุด CSS animation ของแท็บที่ไม่ดูให้เองอยู่แล้ว)
* 🔴 **`board_match_results` มี 503 แถว แต่ใบเปิดมี 283** (เก็บใบปิดไว้ด้วย) — เอายอดรวมมาลบกันได้ติดลบ
  เลข "AI คิดให้แล้ว / ยังไม่มีคนแนะนำ" ต้องมาจาก `flow-summary` (นับเฉพาะใบเปิด) เท่านั้น
* 🔴 **ฉาก 6 โต๊ะย่อลงจอ 375px แล้วป้ายเหลือ ~6px อ่านไม่ออก** → มือถือเปลี่ยนเป็นรายการโต๊ะ
  (ไม่ใช้เลื่อนซ้าย-ขวา เพราะเจ้าของสั่งเลิกไปแล้ว)
* ⚠️ `waitingResult` ของคิว Lumos = `status='delivered' and outcome is null` ได้ **19** ไม่ใช่ 56
  (แถว delivered ส่วนใหญ่มี `last_outcome` แล้วแต่ status ไม่ขยับ) — เลขบนจอต้องเป็น 19
* ⚠️ ฐานใหม่มีใบสมัคร **1 ใบทั้งระบบ** → โต๊ะคนส่วนใหญ่ว่าง · ฉากจึงต้องตอบเป็น "สถานะ"
  ไม่ใช่โชว์ 0 ทุกช่อง (เทสต์ล็อกไว้ว่าโต๊ะว่างห้ามพูดเลข 0)

**ตรวจจริง (22 ส.ค. 2569):** test **1,890 ผ่าน / 6 skip (187 ไฟล์)** · tsc 3 config = 0 ·
eslint 0 error / 18 warning เดิม · registry **91 route** (+1) · migration ไม่แตะ ·
`/api/office-floor` ตอบ 200 (intake inQueue 1 · AI waiting 19/stale 19 นานสุด 6 วัน · content 1) ·
วัดจอจริง 1440×900 + 375×812 ทั้ง light/dark · `/apply` ไม่รั่ว (238 ตำแหน่ง · ปุ่มสมัคร 21 · ไม่มีคำของ staff · ไม่มี HUD panel)

### รอบยี่สิบแปด (ต่อ) · 22 ส.ค. 2569 — Phase 4 เก็บพื้น 4/7 🟡 **ยังไม่ commit**

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/102_unit_notes_field_overrides.sql` | **ใหม่** — รับหนี้คอลัมน์ `field_overrides` ที่เคยสร้างด้วยสคริปต์มือ (ฐานใหม่รัน migrate แล้วไม่ได้คอลัมน์ → ค่าที่ทีมแก้ "หายเงียบ" ผ่านทาง hasColumn fallback) · รันแล้วบนฐานจริง: 406 แถว · มี override 5 แถว ไม่เปลี่ยน |
| `src/lib/dashboard/slaByLeadKind.ts` | **ใหม่ · pure** — ตาราง ปิดทัน/ปิดไม่ทัน/ยกเลิก/เกิน/เสี่ยง/ยังทัน × ชนิดใบขอ 3 ชนิด (เทสต์ 11 · มี sum-check) |
| `src/components/dashboard/analytics/DashboardSlaByLeadKind.tsx` | **ใหม่** — ตารางกดได้ทุกช่อง · ตัดคอลัมน์ที่ว่างทั้งตาราง · บอกตรง ๆ เมื่อยังไม่ได้ดึงชุดใบปิด |
| `SupervisorDashboard.tsx` · `DashboardShell.tsx` | ต่อตาราง + drill-down (`slaControlRecords` ชุดแยกของตาราง SLA) |
| `src/pages/jobs/UnitRequestTabPage.tsx` | ปุ่ม "คิดใหม่" มี popup ยืนยันแล้ว (ใช้ shadcn `AlertDialog`) |
| `src/pages/matching/MatchingPage.tsx` | ปุ่ม "หาคนเพิ่ม + ส่ง AI โทร" มี popup ยืนยันแล้ว (เดิมยิงสายจริงโดยไม่ถาม) |
| `api/_lib/runtime.ts` · `api/_handlers/auth/config.ts` | **ใหม่** flag `JARVIS_PASSWORD_LOGIN_UI` (ตั้งต้น false) + ส่ง `passwordLoginUi` ให้หน้าเว็บ |
| `src/lib/authConfig.ts` · `src/hooks/useAuthConfig.ts` | **ใหม่** — กฎ `shouldShowPasswordUi()` ที่เดียว + hook cache สำหรับเปลือกแอป (เทสต์ 5) |
| `LoginPage.tsx` · `AppLayout.tsx` · `AppNavDrawer.tsx` | ซ่อนฟอร์ม/ปุ่ม/เมนูรหัสผ่านตามกฎเดียวกัน |

**🔴 บทเรียนของรอบนี้ (จดไว้กันพลาดซ้ำ)**
1. **`controlRecords` ของ Dashboard ไม่รับชุด `closedAllJobs`** (โหมด "ทั้งหมด" ดึง on-demand)
   ใครทำแผงใหม่ที่ต้องใช้ใบปิดในโหมดนี้ ต้อง**แยกชุดของตัวเอง** — ยัดเข้า `controlRecords`
   จะไปขยับ KPI/cohort/กระทบยอด ที่คิดจาก throughput (คอมเมนต์เหนือ `recruiterOverviewAllMode` เตือนไว้)
2. **`computeJobSla()` ตอบ `closed_*` เฉพาะ `controlStatus === 'fully_closed'`**
   → ใบ **ยกเลิก** ตกไปกิ่งเดียวกับใบที่ยังเปิด แล้วกลายเป็น `breached`
   วัดจริง: ช่อง "ยังไม่ปิด · เกินแล้ว" กระโดด 200 → 1,582 ก่อนแยกถัง "ยกเลิก" (ของจริง 396 · ยกเลิก 1,200)
   ใครทำแผงที่อ่าน `slaStatus` ตรง ๆ ต้องดัก cancelled เองเสมอ (กติกาแม่: ห้ามปนยกเลิกกับหาได้/ค้าง)
3. **ซ่อน UI รหัสผ่านต้องมี fail-safe** — ถ้า `microsoftLogin=false` ต้องโชว์ฟอร์มเสมอ
   ไม่งั้นเครื่อง dev / วันที่ Azure ล่ม จะไม่มีทางเข้าระบบเลย (กฎอยู่ที่ `shouldShowPasswordUi` ที่เดียว)

**ตรวจจริง:** test **1,906 ผ่าน / 6 skip (189 ไฟล์)** · tsc 3 = 0 · eslint 0 error/18 warning ·
registry 91 route · migration ถึง **102** · ตาราง SLA วัดจากจอจริง (ปิดทัน 1,264 · ปิดไม่ทัน 88 ·
ยกเลิก 1,200 · เกินแล้ว 396 · เสี่ยง 9 · ยังทัน 73 · รวม 3,030 — แถวบวกได้ครบทุกแถว) ·
กดช่อง "ฉุกเฉิน × ปิดไม่ทัน" ได้ป๊อป "15 ใบขอ" ตรงกับเลขในช่อง ·
popup ทั้งสองตัวเปิด/ยกเลิกได้จริง (**ไม่กดยืนยันปุ่มส่ง AI โทร** เพราะยิงสายจริงบนฐาน production)

### รอบยี่สิบแปด (ต่อ 2) · 22 ส.ค. 2569 — Phase 4 ปิดครบ 🟡 **ยังไม่ commit**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/hooks/useListPagination.ts` | **ใหม่** — hook กลางของการแบ่งหน้า (สเตต + หั่นชุด + props ของ `ListPaginationBar`) · `computeListPage()` เป็น pure มีเทสต์ 6 |
| `src/pages/follow/FollowPage.tsx` | แบ่งหน้าการ์ดติดตาม (นับเป็น **คน** ไม่ใช่รอบ) + เปลี่ยนแท็บ/ตัวกรอง = กลับหน้า 1 |
| `src/pages/matching/JobPostingsPage.tsx` · `ReservationsPage.tsx` | แบ่งหน้าด้วย hook กลาง |
| `src/pages/matching/MatchingPage.tsx` | ตัวเลือกต่อหน้าใช้ชุดกลาง + **คง 60/100 ไว้** (ถอดออก = ลดความสามารถเดิม) |
| `src/lib/recruitRm.ts` | `RmFilters` += `dateFrom`/`dateTo` + `applicationAppliedYmd()` · `countActiveRmFilters` นับช่วงวันเป็น 1 (เทสต์ 5) |
| `src/components/recruit-rm/RmWorkspace.tsx` | ปฏิทินกรองวันที่สมัคร (ซ่อนในโหมด `?bucket=` เพราะ server กรองมาแล้ว) |
| `src/pages/matching/OurPeoplePage.tsx` | ปฏิทินช่วงวัน อยู่คู่แท่งเดือนเดิม — เลือกอันหนึ่งล้างอีกอัน (กันตัวกรองซ้อนกันแล้วอ่านไม่ออกว่าเหลือเท่านี้เพราะอะไร) |

**🔴 ของตายที่เจอบน Dashboard (ยังไม่แก้ — รอเจ้าของเคาะ)**
* `DashboardWorkQueueTable.tsx` **ไม่มีใครเรนเดอร์** (orphan เหมือน `DashboardSlaSummary` ก่อนหน้านี้)
  → ใส่ pager ลงไปแล้ว **ถอยกลับ** เพราะเป็น dead code
* ตัวกรอง **"กรองตารางงานติดตาม"** ใน `DashboardFilterBar` จึงกรองตารางที่ไม่มีบนจอ
  มีผลจริงแค่กับ **CSV export** (`exportWorkQueueCsv`) — คนกดแล้วไม่เห็นอะไรเปลี่ยน = "ปุ่มที่ทำให้งง"

**🔴 กันพลาดซ้ำ: ก่อนต่อ UI ตัวกรองที่ "logic มีแล้วแต่ UI ไม่ต่อ" ต้องเช็ก git ก่อน**
ตัวกรอง ช่องทาง/จังหวัด/สถานะ ของ `filterApplications` **ไม่ใช่ของที่ยังไม่ได้ทำ** —
เจ้าของสั่งถอด UI ทิ้งเมื่อ 17 ส.ค. 2569 (`9dbe94b` ลบ `RmFilterSidebar.tsx`)
ถ้าเผลอ "ต่อให้ครบ" = เอาของที่ถูกสั่งถอดกลับมา · เขียนกำกับไว้ที่ `RmFilters` แล้ว

**ตรวจจริง:** test **1,917 ผ่าน / 6 skip (190 ไฟล์)** · tsc 3 = 0 · eslint 0 error/18 warning ·
migration ถึง 102 · registry 91 route ·
วัดจอจริง: /follow + /jobs/board?view=postings มี "แสดง 1–1 จาก 1" + dropdown `10,20,30,40,50` ·
ปฏิทินผู้สมัคร: 1/7–2/7/2569 → 0 รายชื่อ · 30 วันล่าสุด → ถัง To do 121 → 47 คน ·
popup ยืนยัน 2 ตัวเปิด/ยกเลิกได้ (ไม่กดยืนยันตัวที่ยิงสายจริง)

### รอบยี่สิบแปด (ต่อ 3) · 22 ส.ค. 2569 — ยกระดับหน้าตาฉาก "ห้องทำงาน" 🟡 **ยังไม่ commit**

เจ้าของสั่ง *"ทำ Phase 2 ให้เท่และดูทันสมัยกว่านี้"*

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/designTokens.ts` | **+`HUD_SCENE`** — สีโครงฉาก (พื้น/โต๊ะ/เก้าอี้/เส้นเชื่อม) เป็น rgba ล้วน · มีเทสต์กันสีหลุดจาน (ขาว/เทา/teal-300/slate-400 เท่านั้น) |
| `src/lib/officeFloor.ts` | **+`OFFICE_LINKS` / `isLinkFlowing()` / `deskStatValue()`** — ตรรกะ "เส้นไหนมีงานไหลจริง" ย้ายมาไว้ที่ไฟล์ pure (เทสต์ 6 ตัว) |
| `src/components/home/OfficeFloor.tsx` | ผังห้องมีความลึก (`depth` ต่อแถว) · โต๊ะไอโซเมตริก · จอลอยที่แท่งมาจากเลขจริง · ตัวละครใส่เฮดเซ็ต · เส้นงานไหล · vignette + bloom |
| `src/index.css` | `+.jarvis-office-flow` (เส้นประวิ่ง) · `+.jarvis-office-pad` (วงแหวนหายใจ) · ท่าเดินเพิ่มจังหวะย่อตัว · reduced-motion ครอบของใหม่ครบ |

**🔴 กับดักที่เจอตอนตรวจ (จดไว้กันพลาดซ้ำ)**
* **ป้ายลอยเหนือหัวของโต๊ะแถวหน้า ทับป้ายชื่อของโต๊ะแถวหลัง** — ในผังที่มีความลึก
  ตำแหน่ง "เหนือหัว" ของแถวหน้า = แถบเดียวกับป้ายของแถวหลัง → ย้ายป้ายมากลางโต๊ะ (อากาศว่างเสมอ)
* **กรอบกด (hotspot) ของสองแถวซ้อนกัน 14px** → จี้โต๊ะหน้าได้การ์ดของโต๊ะหลัง
  วัดด้วย DOM แล้วหรี่ความสูงกรอบแถวหลังจนซ้อน 0
* **`max-h` บน `<svg>` ทำให้ฉากถูก letterbox** (เนื้อหาแคบกว่ากรอบ เห็นขอบซ้าย-ขวา)
  → คุมสัดส่วนที่ viewBox แทน (1000×344) แล้วปล่อย `h-auto w-full`
* **ของที่ "ปิดใช้" ก็ต้องอ่านป้ายออก** — เผลอใช้สีเก้าอี้ (alpha .13) แล้วชื่อโต๊ะหายไปเลย
  ตัวโต๊ะหรี่ได้ แต่ป้ายที่บอกว่า "ยังไม่เปิดใช้" คือข้อมูล

**ตรวจจริง:** test **1,924 ผ่าน / 6 skip (190 ไฟล์)** · tsc 3 = 0 · eslint 0 error/18 warning ·
DOM: ฉาก 1315×452 ไม่มี letterbox · เส้นเชื่อม 5 เส้น **วิ่ง 2 เส้นตามข้อมูลจริง** ·
วงแหวนเรือง 1 โต๊ะจาก 6 · จอลอย 5 จอ (โต๊ะที่ปิดใช้ไม่มีจอ) · กรอบกด 6 อันไม่ซ้อนกันเลย ·
light/dark + มือถือ 375px (มือถือยังเป็นรายการโต๊ะ ไม่มี horizontal scroll)

### รอบยี่สิบเก้า · 22-23 ส.ค. 2569 — 3D Virtual Office (ศูนย์ปฏิบัติการเสมือน) 🟡 **ยังไม่ commit**

เจ้าของเคาะเป็นลำดับ: *"ทำให้เท่และทันสมัยกว่านี้"* → *"มันคือ dashboard 3d virtual office"*
→ ส่งภาพอ้างอิงมาแล้วติของที่ทำไปว่า **"บ้านนอกมาก"** → รื้อภาษาภาพทั้งชุด

**เคาะแล้ว: ทำด้วย CSS 3D ไม่เพิ่ม library · กล้องขยับตามเมาส์เบา ๆ อัตโนมัติ (ไม่ให้ลากหมุนเอง)**
เหตุผลที่ไม่ใช้ WebGL: ระบบนี้ยังไม่มี three.js เลย · three + R3F ≈ **+180-220KB gzip** บนหน้าแรก

| ไฟล์ | ทำอะไร |
|---|---|
| `src/index.css` | 3 บล็อกใหม่: `.jarvis-office-stage/-world/-ground/-grid/-wall/-standee/-path` (โครง CSS 3D) · `-pod/-pod-rim/-core-*/-plate/-panel` (ภาษาภาพศูนย์ปฏิบัติการ) · `-sky/-skyline` (ฉากหลังเมือง) |
| `src/lib/officeFloor.ts` | `OFFICE_BOARD` · `OFFICE_CORE` · `OFFICE_SLOTS` (แท่นล้อมแกนกลาง) · `coreSpokeGeometry()` · `isDeskActive()` · `pathGeometry()` — **ผังห้องเป็นข้อมูล ไม่ใช่ตัวเลขในไฟล์ UI** (เทสต์ 28) |
| `src/components/home/OfficeFloor.tsx` | เขียนใหม่ทั้งฉาก: ฉากหลังเมือง → พื้นมีตาราง+ผนัง → สายข้อมูลจาก Core → แท่นวงกลม → **มาสคอต** + จอโฮโล 2 แผ่น + ป้ายชื่อทีมเรือง · กล้องตามเมาส์ (ResizeObserver คุมอัตราย่อ) |

**🔴 กับดักของงาน 3D บนเว็บ (จดไว้กันพลาดซ้ำ)**
1. **ห้ามวางแท่นไว้กลางคอลัมน์เดียวกับแกนกลาง** — ป้ายตั้งของแท่นที่อยู่ใกล้กล้องพุ่งขึ้นไป
   ทับป้าย "JARVIS Core" พอดี (เจอจริง: `selection` เคยอยู่ x=510 เท่ากับ core) · **มีเทสต์คุม dx > 90**
2. **ป้ายของแกนกลางต้องอยู่เหนือลำแสง** ไม่ใช่ใต้ — ใต้ลำแสงคือแถบที่มาสคอตแท่นหน้าบัง
3. **แท่นจางเกิน = ตัวละครดูลอย** — ต้องมีพื้นทึบ + ขอบยก + เงาใต้แท่น + แผ่นแสงจุดที่ยืน
4. **กรอบกดซ้อนกัน 2 คู่เป็นเรื่องปกติในฉาก 3D** (ของใกล้บังของไกล) — ที่ต้องคุมคือ
   **ของใกล้ต้องชนะ** ทั้ง DOM order และ z-index (เรียง `y` ขึ้น → ใกล้อยู่ท้าย) วัดแล้ว z 316>128 ✔
5. `ResizeObserver` คุมอัตราย่อ **ห้ามใช้ media query** — กล่องนี้อยู่ในแผงที่กว้างไม่เท่ากันแต่ละหน้า

**ตรวจจริง (23 ส.ค. 2569):** test **1,931 ผ่าน / 6 skip (190 ไฟล์)** · tsc 3 = 0 · eslint 0 error/18 warning ·
DOM: เวที 1315×554 · แท่น 6 + แกนกลาง · มาสคอต 5 (โต๊ะที่ปิดใช้ไม่มีมาสคอต) · ป้าย 7 ·
สายข้อมูล 6 เส้น **วิ่ง 4 เส้นตามข้อมูลจริง** · ทีมกดได้ 6 · light/dark + มือถือ 375px (ยังเป็นรายการโต๊ะ ไม่มี h-scroll)

**⚠️ ข้อจำกัดที่ต้องบอกเจ้าของ:** ภาพอ้างอิงเป็น **งาน render 3D** (โมเดล + แสงจริง)
CSS/SVG เขียนมือให้ได้ *ภาษาเดียวกัน* (แท่นเรือง · แกนกลาง · มาสคอต · สายข้อมูล) แต่ไม่ได้
*เนื้อวัสดุ/แสงเงา* ระดับนั้น — ถ้าจะเอาให้เท่าภาพจริง ทางที่ตรงที่สุดคือ
**ใช้ไฟล์ภาพที่ render มาแล้ว (PNG โปร่ง) วางเป็นแท่น/มาสคอต แล้วซ้อนข้อมูลเป็น HTML**
(ยังไม่ต้องมี WebGL · ของที่ทำไว้รอบนี้รองรับการสลับไปใช้ภาพได้เลย)

### รอบสามสิบ · 23 ส.ค. 2569 — Phase 3 (ปุ่มซ้ำ) + Phase 5 เริ่ม (gating ปล่อยใบ) 🟡 **ยังไม่ commit**

**Phase 3 — ล้างปุ่มซ้ำ (เจ้าของเคาะ: เก็บทุกปุ่ม เปลี่ยนคำให้ต่างกันชัด)**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/candidateSearchLabels.ts` | **ใหม่** — คำบนปุ่ม "หาคนเพิ่ม" **4 ทาง** ที่เดียว (เทสต์ 7 · ห้ามชื่อระบบขึ้นปุ่ม · ปุ่มที่โทรต้องมีคำว่า "โทร") |
| `MatchingPage.tsx` · `UnitRequestTabPage.tsx` · `JobBoardView.tsx` | เปลี่ยนไปใช้คำกลาง |
| `RecruitLaneDialog.tsx` | **ใส่ขั้นยืนยันก่อนยิงสาย** + เปลี่ยนหัวป๊อปเป็นคำที่บอกว่าโทร |

🔴 **เจอปุ่มที่ 4 ที่ไม่มีในลิสต์เดิม (อันตรายสุด):** การ์ดบอร์ดรับสมัครกับแท็บ AI Match
ใช้คำ **"หาผู้สมัครเพิ่ม" เหมือนกันเป๊ะ** แต่การ์ดบอร์ดเรียก `fetchRecruitLaneCandidates(send: true)`
= **โทรหาคนจริงทันทีที่ป๊อปเปิด** ส่วนแท็บ AI Match เป็น `send: false` แค่ดูรายชื่อ
→ แยกคำ + ใส่ยืนยัน · เทสต์ล็อกว่า effect ที่ยิงต้องมี `!confirmed` เป็นเงื่อนไข

**Phase 5 — gating "ปล่อยใบขึ้นหน้าสาธารณะ" (5/13 · ใช้งานได้จริงแล้ว)**

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/103_job_public_releases.sql` | **ใหม่** — ทะเบียนใบที่ปล่อยแล้ว (job_id text · ไม่มี FK เพราะใบขออยู่ ERP) |
| `api/_lib/jobPublicReleases.ts` | **ใหม่** — ตัวกลางเดียวของ "ใบนี้คนนอกเห็นได้ไหม" · เทียบ **ทั้ง id เต็มและเลขที่ใบขอ** (แก้กับดัก pre:/sql:) |
| `api/_handlers/public/jobs.ts` | **+ด่านที่ 4** — โชว์เฉพาะใบที่ปล่อย · **fail-closed** (อ่านทะเบียนไม่ได้ = ไม่ปล่อยอะไรเลย) ทั้งหน้ารวมและเปิดตรงด้วย id |
| `api/_handlers/lumos-positions.ts` | ด่านเดียวกัน — AI เห็นเท่าที่คนนอกเห็น |
| `api/_handlers/job-public-release.ts` | **ใหม่** `GET/POST/DELETE` (rbac `recruit-postings`) · เพดาน 300 ใบ/ครั้ง |
| `src/lib/jobPublicReleaseApi.ts` | **ใหม่** — client + `buildReleaseIndex()` (เทสต์ 6 · ล็อกกับดัก pre:/sql:) |
| `src/components/jobs/JobBoardView.tsx` | แถบ "หน้าสาธารณะ (/apply)" นับปล่อยแล้ว/ยังไม่ปล่อย + ปุ่มปล่อยเป็นชุด · ปุ่มปล่อย/ดึงลงในป๊อป 3 ขั้น (staff เท่านั้น) |

**🔴 กับดักที่เจอตอนตรวจ**
1. **DELETE ที่มี body ไม่ถึง handler** ในเซิร์ฟเวอร์ท้องถิ่น (POST ผ่านแต่ DELETE ตอบ
   "ต้องระบุ jobId") → ต้องรับ jobIds ทาง **query** ด้วย ห้ามพึ่ง body ตัวเดียว
2. **`dbQuery` ของโปรเจกต์คืนแค่ `{ rows }` ไม่มี `rowCount`** → นับแถวต้องใช้ `RETURNING`
3. `JwtUserPayload` มีแค่ `sub/email/role` — ไม่มี `id`/`name`

**⚠️ พฤติกรรมที่เปลี่ยนจริง (เจ้าของเคาะเอง):** `/api/public/jobs` วัดแล้วได้ **`[]`** ตอนทะเบียนว่าง
(เดิม 238 ตำแหน่ง) · ปล่อย 1 ใบ → 1 · ดึงลง → 0 · **ลบข้อมูลทดสอบด้วย id ครบแล้ว ทะเบียนเหลือ 0 แถว**

**ตรวจจริง:** test **1,944 ผ่าน / 6 skip (192 ไฟล์)** · tsc 3 = 0 · eslint 0 error/18 warning ·
registry **92 route** · migration ถึง **103** · แถบบอร์ดวัดจากจอ "ปล่อยแล้ว 0 · ยังไม่ปล่อย 283" ·
ป๊อปปล่อย/ดึงลงกดจริงแล้วสลับข้อความถูกต้อง

### รอบสามสิบเอ็ด · 23 ส.ค. 2569 — Phase 5 ปิด 12/13 (วงจรกันชื่อดอง + ปุ่มรวม "เก็บไปโทรเอง") 🟡 **ยังไม่ commit**

เจ้าของสั่งทำต่อ Phase 5 ที่เหลือเป็นลำดับแรก · ทำคู่กับข้อ ② ของ Phase 3 (รวมสองปุ่มเป็นปุ่มเดียว)

**วงจรที่เคาะไว้:** เก็บชื่อไปแล้วดองเกิน 1 วันไม่ stamp ว่าโทร → worker ถอด claim +
เตือนหัวหน้าทันที → ใบเข้ากอง **"เลือกวิธีโทร"** → ไม่เลือกใน 1 วัน → worker ส่ง AI เอง

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/104_application_call_choice.sql` | **ใหม่** — `unclaimed_at` · `unclaimed_from_name` · `call_choice` (CHECK: manual/ai/auto_ai) · `call_choice_at` · `call_choice_by_name` + partial index ของกองรอเลือก · **รันฐานจริงแล้ว** |
| `api/_lib/applicantOverviewSql.ts` | `claimed_idle` **เพิ่มเงื่อนไข dial stamp** (เจ้าของ: "ไม่ stamp = ถอด") · **+ถัง `awaiting_call_choice`** · `buildAwaitingChoiceSql()` |
| `src/lib/callChoiceGuard.ts` | **ใหม่ · pure** — `CLAIM_IDLE_HOURS`/`CALL_CHOICE_HOURS` = 24 · `choiceCountdown()` · `buildUnclaimNotice()` · `unclaimDedupeKey()` (เทสต์ 14) |
| `api/_lib/callChoiceWorker.ts` | **ใหม่** — ถอด claim + เตือน + ส่ง AI เอง · **ปิดเป็นค่าตั้งต้น** (`CLAIM_GUARD_ENABLED`) · แพตเทิร์นเดียวกับ `systemHealthWorker` |
| `server/local-api.ts` | สตาร์ท `startClaimGuardWorker()` (จุดเดียวกับ worker ตัวอื่น) |
| `api/_handlers/application-call-choice.ts` | **ใหม่** `POST` — เส้นเดียวของ "ใครจะโทรหาคนนี้" · `manual` = claim **+ ล็อกเบอร์** ในคำสั่งเดียว · `ai` = เข้าคิวผ่าน `enqueueLumosInterviewForApplications` · เพดาน 200 คน/ครั้ง · registry **93 route** |
| `src/lib/callChoiceSummary.ts` | **ใหม่ · pure** — สรุปผลเป็นข้อความเดียว **ต้องพูดเรื่องที่ทำไม่ได้ด้วย** (เทสต์ 5) |
| `src/lib/applicantCallOutcome.ts` | **+`isInterestedApplicant` / `isNotInterestedApplicant`** — `ok=false` จาก contact log นับเป็นไม่สนใจ · **เทียบเวลา** ผลโทร vs ผลติดต่อ อันใหม่กว่าชนะ (เทสต์ 12) |
| `api/_lib/applicationContacts.ts` | **+`loadLatestContactResults()`** — ผลติดต่อล่าสุดต่อใบ (คืน ok + เวลา) |
| `api/_handlers/job-applications.ts` | ชั้นคอลัมน์ใหม่ `LIST_COLUMNS_NO_CHOICE` (ไล่ **ห้าชั้น**) · แนบ `last_contact_ok/at` + ฟิลด์ 104 |
| `src/components/recruit-rm/RmWorkspace.tsx` | ปุ่มรวม "เก็บไปโทรเอง" (เลิกจับล็อกเองจากหน้าเว็บ) · แถบกอง "เลือกวิธีโทร" (ซ่อนตัวเองเมื่อไม่มีของ) · ป๊อปยืนยันส่ง AI |
| `src/components/recruit-rm/CallChoiceConfirmDialog.tsx` | **ใหม่** — AlertDialog โชว์ **รายชื่อจริง** ก่อนยิงสาย |
| `src/components/jobs/JobRecallSuggestions.tsx` | **ใหม่** — กอง "AI จับให้จากคนที่เคยปฏิเสธงานอื่น" ในแท็บไม่สนใจ · checkbox + ยืนยัน **แบบบล็อกในหน้า** |
| `api/_handlers/matching-selection-recall.ts` | **+`refs=`** ส่งเฉพาะคนที่ติ๊ก (กรองจากผลที่ AI คิดมาเท่านั้น) |
| `src/components/notifications/ClaimIdleAlertDialog.tsx` · `src/lib/claimIdleAlert.ts` | **ใหม่** — ป๊อปเตือนหัวหน้าตอนเปิดระบบ · อ่านจากกล่องขาเข้าที่ poll อยู่แล้ว (ไม่ยิง query ใหม่) |
| `src/lib/officeFloor.ts` · `api/_handlers/office-floor.ts` | โต๊ะสรรหานับกองรอเลือกเป็น backlog + ช่องใหม่ · `awaitingChoice` เป็น `undefined` เมื่อยังไม่ migrate = **ซ่อนช่อง** ไม่ใช่โชว์ 0 |
| `api/_handlers/recruit-rm-overview.ts` · `RecruitControlPanel.tsx` | กล่องกดได้ "รอเลือกวิธีโทร N ใบ" (ต่อในกล่องเดิม ไม่เพิ่มกล่องใหม่) |

**🔴 กับดัก/บทเรียนของรอบนี้**

1. **ล็อกเบอร์ล้มด้วยเหตุผลอื่นนอกจาก `taken` ต้องรายงานด้วย** — เจอตอนตรวจ: เบอร์ 11 หลัก
   แปลง E.164 ไม่ได้ → `acquireCallHold` คืน `no_phone` แล้วโค้ดเงียบ → คนอ่านว่า "เก็บสำเร็จ"
   ทั้งที่ **AI ยังโทรทับได้** (claim กัน AI ไม่ได้ ตัวที่กันคือ hold)
2. **🔴 worker ที่รันทดสอบบนเครื่อง dev เขียนแจ้งเตือนลงฐาน production** — กับดักเดิมข้อ 3
   ของรอบยี่สิบสี่ เกิดซ้ำ: `notifyRoles(['admin','supervisor'])` สร้าง **11 แถว** ถึงคนจริง
   → ลบด้วย id ครบแล้ว · **ครั้งหน้าให้เตรียมข้อมูลกองรอเลือกด้วย SQL ตรง ๆ ไม่ต้องรัน worker**
3. **`unclaimed_at` มีคำว่า `claimed_at` อยู่ในตัว** — regex guard ที่เขียนว่า
   `/claimed_at\s*<\s*now\(\)/` จับ `unclaimed_at` ด้วย ทำเทสต์ตกทั้งที่โค้ดถูก (ต้องกั้น `a.`)
4. **เทสต์ static ที่ตรวจ "ห้ามมีคำนี้" ต้องตัดคอมเมนต์ก่อน** — คอมเมนต์ที่อธิบายกับดัก
   (เช่น "dbQuery ไม่มี rowCount") ทำเทสต์ของตัวเองตก
5. **ปุ่มในแถบสัญญาณต้องคุม `min-h-9`** — วัดจริงบนมือถือได้ 23px (นิ้วกดไม่โดน) → แก้เป็น 41px
6. **ปั๊ม `call_choice` ก่อนส่งคิว ไม่ใช่หลัง** — ส่งก่อนแล้วรอบล้มกลางทาง รอบถัดไปยิงซ้ำคนเดิม
   (ด่านกันซ้ำของคิวช่วยเฉพาะแถวที่ยัง active — แถว `cancelled` ถูก revive ใหม่ทุกรอบ)

**ตรวจจริง (23 ส.ค. 2569):** test **2,005 ผ่าน / 6 skip (198 ไฟล์)** · tsc 4 config = 0 ·
eslint 0 error/18 warning · registry **93 route** · migration ถึง **104** ·
ยิงเส้นเขียนจริงครบวง: worker ถอด claim 2/2 → กด "เก็บไปโทรเอง" ได้ claim + ล็อก `+66999999901` →
กดซ้ำได้ข้อความ "มีคนถือไปโทรอยู่" → ดันเวลาครบกำหนด → worker ส่ง `auto_ai` เข้าคิว pending 1 แถว
(**ใบที่มีคนกดเก็บแล้วไม่ถูกส่ง** — ด่าน `claimed_by is null` ทำงาน) ·
วัดจอ 1440×900 + 375×812 light/dark (ไม่มี h-scroll · ป้ายนับถอยหลัง "19 ชม." / "ครบกำหนด") ·
ป๊อปยืนยันโชว์รายชื่อจริง 2 ชื่อ + ปุ่ม "ส่ง 2 คนเข้าคิวโทร" (**ไม่กดยืนยัน** เพราะยิงสายจริง) ·
`/apply` ไม่รั่วคำของ staff เลย · **ลบข้อมูลทดสอบ + แจ้งเตือนด้วย id ครบ เหลือ 0 ทุกตาราง**

### รอบสามสิบเอ็ด (ต่อ) · 23 ส.ค. 2569 — ปิดบั๊ก id ใบล่วงหน้า (5.6) + ตัวกรอง orphan 🟡 **ยังไม่ commit**

เจ้าของเคาะ 2 ข้อ: **พัก Phase 2.12 (ฉาก 3D เป็นภาพ render) ไว้ก่อน** · ทำ 5.6 + ตัวกรอง orphan

**① บั๊ก `siamraj-pre:` ไม่จับคู่ `siamraj-sql:` (ค้างมาตั้งแต่รอบยี่สิบเจ็ด)**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/jobKeyIndex.ts` | **ใหม่ · pure** — `requestNoOf` (แหล่งเดียวของทั้ง repo) · `buildJobKeyIndex()` เก็บสองคีย์เทียบสองคีย์ · `buildCountIndex()` · `countFor()` (เทสต์ 13) |
| `src/lib/jobPublicReleaseApi.ts` | เลิกประกาศ `requestNoOf` เอง → re-export จาก `jobKeyIndex` (เคยมี 2 ก๊อปปี้ ห้ามงอกตัวที่สาม) |
| `src/components/jobs/JobBoardView.tsx` | 3 useMemo (`postedJobIds` · `latestPostingByJob` · `channelsByJob`) เปลี่ยนจาก Map/Set ดิบ → index · **+ยอดผู้สมัคร/Lead/ที่มา** (`applicantIdx`/`leadIdx`/`originIdx`) · `silentLinkRows` สร้าง reader จาก postings ตรง ๆ |
| `src/lib/jobLinkSilence.ts` | `SilentLinkInput` ทุกช่องเป็น `JobKeyReader<T>` (สัญญาเดียวกับ `Map.get` → เทสต์เดิมที่ส่ง Map ไม่ต้องแก้) |
| `api/_lib/siamrajUnitRequests.ts` | **+`isErpJobId()`** — ตัวกลางเดียวว่า "id นี้เป็นใบขอ ERP ไหม" ครอบ prefix ทั้งสามแบบ |
| `api/_handlers/jobs.ts` · `api/_handlers/job-assignments.ts` | เลิกเช็ค `startsWith` เอง → `isErpJobId()` |

**🔴 บั๊กที่เจอ *เพิ่ม* ตอนแก้ (หนักกว่าที่จดไว้):** `jobs.ts:143` และ `job-assignments.ts:34` เช็ค
prefix เองแล้ว **ลืม `siamraj-pre:` ทั้งคู่** → id ใบล่วงหน้าตกไปคิวรีตารางฝั่งเราที่คีย์เป็น uuid
แล้ว **ตาย 500** (ไม่ใช่ 404 ที่อ่านรู้เรื่อง) · มีเทสต์ static กันเช็ค prefix เองแล้ว

**🔴 กติกาที่ต้องคงไว้ (ห้ามพลาดตอนแก้ต่อ):**
* **เลขที่ใบขอเป็นทางถอย ไม่ใช่คีย์หลัก** — ฐานจริงมีเลขที่ **ซ้ำข้ามบริษัท 23 ใบ**
  (`LBM6908001` = ล่วงหน้าอีซูซุ · ปกติชับบ์ ไลฟ์) → เลขที่ที่ชี้ได้หลายใบ **ถูกตัดออกจาก index**
  (ambiguous = ไม่จับคู่ · ยอมพลาดดีกว่าเอาข้อมูลอีกบริษัทมาแปะ)
* **ห้าม `includes`/`endsWith`** — `LBM690800` ต้องไม่แมตช์ `LBM6908001` (เทสต์ล็อกทั้งสองไฟล์)
* เทสต์ `jobLinkSilence.test.ts` เดิม **ผ่านทั้งชุดแม้บั๊กยังอยู่** เพราะทุกเคสใช้ id เปล่า (`'a'`)
  → เพิ่ม describe ใหม่ที่ใช้ id มี prefix จริง 4 เคส

**วัดจอจริง (1440×900):** ใบล่วงหน้าใบเดียวบนบอร์ด `siamraj-pre:LBM6908001` (อีซูซุมอเตอร์)
ตอนนี้ได้ **✓ ปล่อยลิงก์แล้ว** · ชิป **"ลิงก์กลาง · คลิก 3"** · แท็บ "แก้ไข" เปิด**ฟอร์มจริง 8 ช่อง**
(เดิมเหลือแต่ข้อความ) · **แถบลิงก์เงียบขึ้น 6 ใบ (เดิม 1 ใบ)** โดยใบล่วงหน้าอยู่แถวแรก
พร้อมเหตุผลถูก "ปล่อยลิงก์ 18 วันก่อน · มีคนกดดู 3 ครั้ง แต่ยังไม่มีใครกรอก" → ปุ่ม "แก้ประกาศ"

**② ตัวกรอง orphan บน Dashboard — เจ้าของเคาะ: เขียนกำกับว่ามีผลกับ CSV**

วัดจริงก่อนถาม: ไม่ใช่แค่ dropdown — **ช่องค้นหาบนหัว Dashboard ก็เป็น orphan เหมือนกัน**
(`filters.search` + `filters.queueStatus` → `applyDashboardFilters` → `data.workQueue`
ซึ่งมีผู้ใช้เดียวคือ `exportWorkQueueCsv`) · กด dropdown เป็น "ยกเลิก" + พิมพ์คำค้นที่ไม่มีจริง
→ **ข้อความบนจอไม่เปลี่ยนแม้ตัวอักษรเดียว (6,678 ตัวอักษรเท่าเดิมทั้ง 3 ครั้ง)**

| ไฟล์ | ทำอะไร |
|---|---|
| `DashboardFilterBar.tsx` | ป้าย "กรองตารางงานติดตาม" → **"กรองข้อมูลในไฟล์ CSV"** + คำอธิบายใต้ป้าย · ตัวเลือกแรก "ทุกสถานะ (ตาราง)" → "ทุกสถานะ" |
| `DashboardShell.tsx` | placeholder ช่องค้นหา → "ค้นหาเพื่อกรองไฟล์ CSV (ไม่เปลี่ยนตัวเลขบนหน้า)" + `title` |
| `tests/api/dashboardCsvOnlyFilters.test.ts` | **ใหม่** — กันคำไหลกลับไปอ้างตารางที่ไม่มี + ล็อกว่าข้อเท็จจริงที่คำกำกับอ้างยังจริง (ตารางยัง orphan · workQueue ยังมีผู้ใช้เดียว) |

**ตรวจจริง:** test **2,033 ผ่าน / 6 skip (201 ไฟล์)** · tsc 4 config = 0 · eslint 0 error/18 warning ·
registry 93 · migration 104 · วัดจอทั้ง light/dark ไม่มี h-scroll ·
โหมดมืดคำกำกับเป็น slate-400 บนพื้น slate-900 (อ่านออก)

### รอบสามสิบสอง · 23 ส.ค. 2569 — **Phase 6 + Phase 7 ปิดครบ** (เจ้าของสั่ง "เอาให้ครบทุก Phase ก่อน") 🟡 **ยังไม่ commit**

**Phase 6 — สถานะผู้สมัคร "ชุดเดียว" (10/10)**

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/105_selection_progress_central.sql` | **ใหม่** — ตารางกลาง คีย์ **(job_id, phone_e164)** + backfill idempotent (ฐานจริงมี 0 แถวที่ตั้งขั้นไว้ → เริ่มจากศูนย์) |
| `api/_lib/selectionProgressStore.ts` | **ใหม่** — adapter **dual-write**: เขียนตารางกลาง**ก่อน** แล้วเขียนคอลัมน์เดิม 094 คู่ไป · อ่านกลางก่อนแล้วถอยไปคอลัมน์เดิม |
| `api/_handlers/selection-progress.ts` | **ใหม่** `GET/PATCH` — เส้นของ**คนที่ยังไม่มีใบสมัคร** (คนจาก match) · registry 94 |
| `api/_handlers/job-applications.ts` | `patchSelectionProgress` เขียนผ่าน store · GET อ่านตารางกลางมาทับค่าบนใบ |
| `src/lib/selectionProgressApi.ts` · `src/lib/selectionUnitStage.ts` | **ใหม่** — client + กติกา "ขั้นไหนต้องเลือกหน่วยงาน" |
| `src/components/recruit-rm/SelectionProgressControls.tsx` | รับ `subject` union (application / person) · เช็คลิสต์ **6 ข้อ** (+ทำบัตร) · ปุ่มเลือกหน่วยงานใน **Popover** · ขั้น "รอแจ้งเข้า" มีปุ่มไปตั้งตารางโทร |
| `src/components/follow/BoardUnitPicker.tsx` | แยกเนื้อเป็น **`BoardUnitPickerBody`** เพื่อฝังแบบไม่ห่อ Dialog (ห้าม Dialog ซ้อน Dialog) |
| `src/pages/jobs/UnitRequestTabPage.tsx` | แท็บ AI Match **ลงมือได้** (checkbox + `LumosSendBar` + `dispatchLumosCalls` + ป๊อปยืนยันรายชื่อ) · แท็บการติดต่อมีกอง "คนที่สนใจ (ของทั้งใบขอ)" |
| `migrations/106_job_site_map.sql` · `api/_lib/jobSiteMap.ts` | **ใหม่** — จำ site_code ของใบขอ (feed เติมเอง **283 ใบ**) |
| `api/_lib/applicationRotationSql.ts` · `lumosDispatch.ts` | `phonesDeclinedThisUnit` — กัน declined **ระดับหน่วยงาน** ที่คอขวดเดิม |
| `src/lib/selectionProgress.ts` | `probation` เปลี่ยนคำบนจอเป็น **"เรียนงาน"** (ค่าในฐานไม่เปลี่ยน · เจ้าของเคาะ) |

🔴 **ทำไมคีย์เป็นเบอร์ ไม่ใช่ id ใบสมัคร:** คนจาก match ไม่มีแถวใน `public_job_applications`
เลย · และคนเดียวมีหลายรหัส (`app-`/`card-`/`ir-`) แต่เบอร์มีเบอร์เดียว (บทเรียนล็อกโทร 068)
🔴 **กัน declined ระดับหน่วยงานมีผลจริง:** ไซต์ `67LBDL0208` มี **28 ใบขอ** ⇒ เดิมคนที่ปฏิเสธ
1 ใบยังถูกเสนออีก 27 ใบของไซต์เดิม · fail-safe: ไม่รู้ไซต์ → กันระดับใบขอเท่าเดิม

**Phase 7 — Follow ครบวง + หน้า "ดูแลหลังเริ่มงาน" (6/6)**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/followCompletion.ts` | **ใหม่ · pure** — กอง "โทรครบแล้ว" นับที่ระดับ **คน** ไม่ใช่รอบ (เทสต์ 13) |
| `src/components/follow/FollowCompletedPanel.tsx` | **ใหม่** — กล่องบนหน้า Follow + ปุ่ม [ย้ายไปดูแลหลังเริ่มงาน] · ซ่อนตัวเองเมื่อไม่มีของ |
| `migrations/107_aftercare.sql` · `api/_handlers/aftercare.ts` | **ใหม่** — ทะเบียนคนในความดูแล (คีย์เบอร์ E.164) · registry 95 |
| `src/lib/aftercareApi.ts` · `src/lib/aftercareRounds.ts` | **ใหม่** — client + preset รอบโทร **3/7/30 วัน** จากวันเริ่มงาน (บวกวันแบบปฏิทิน) |
| `src/pages/aftercare/AftercarePage.tsx` | **ใหม่** — หน้า "ดูแลหลังเริ่มงาน" + สรุป 3 กล่อง + ชิปรอบต่อคน |
| `src/App.tsx` · `dockNavConfig.tsx` · `roleFunctions.ts` · `src/lib/rbac.ts` | route `/aftercare` + **เมนูหลักของตัวเอง ข้าง Follow** (เจ้าของเคาะ) + สิทธิ์ `aftercare_read` · API ใช้ key `follow` เดิม |
| `api/_handlers/follow.ts` · `src/lib/followApi.ts` | ส่ง **`followup_state`** มาฝั่งจอ (เดิมไม่เคยส่ง → `needs_human` ใช้ไม่ได้เลย) |
| `api/_lib/applicantOverviewSql.ts` | **+ถัง `overdue_no_result`** — ย้ายเงื่อนไขจาก CTE มาเป็น expression บน alias `a` ⇒ เลข "เลยนัดยังไม่บันทึกผล" **กดดูรายชื่อได้** |

**🐛 บั๊กที่เจอ+แก้ระหว่างทาง**

1. **ช่อง "ไป" บนแผงรอบ Follow เช็คแค่ `'done'`** ไม่รับ `went`/`arrived` ของ migration 101
   ⇒ **เลขต่ำกว่าจริงทุกแถวตั้งแต่เปลี่ยนชุดคำ** · เทสต์เดิม 10 เคสไม่จับเพราะไม่มีเคสคำใหม่
   → ย้ายนิยาม "สำเร็จ" ไป `followOutcome.ts` (`FOLLOW_OUTCOME_SUCCESS`/`isSuccessOutcome`)
     ที่เดียว + เทสต์ 4 เคสจับบั๊กนี้
2. **สีมาสคอตในฉาก 3D เป็น hex ดิบนอกจานที่กติกาอนุญาต** — ย้ายเข้า `HUD_SCENE.mascot*`
   แล้วเทสต์ `designTokens` จับได้ว่าฟ้าจาง/น้ำเงินเข้มอยู่นอกจาน (ขาว/เทา/teal/slate)
   → เปลี่ยนเป็นไล่ขาว-เทา (แสง teal ของฉากยังฉาบให้เห็นเป็นโทนฟ้าเหมือนเดิม)

**🔴 กติกาที่ฝังไว้ใหม่**
* `SelectionProgressControls` อยู่ในป๊อปที่เป็น Dialog → ตัวเลือกหน่วยงานต้องเป็น **Popover**
  และต้องใช้ `BoardUnitPickerBody` ตัวเดียวกับหน้า Follow (ห้ามก๊อปรายการหน่วยงาน)
* หน้า "ดูแลหลังเริ่มงาน" **ไม่มีระบบโทรของตัวเอง** — ปุ่มตั้งรอบพาไปหน้า Follow ผ่าน
  `followPrefill` (เพิ่มคีย์ `pf_unit` ส่งชื่อหน่วยงานไปด้วย)
* ไม่รู้วันเริ่มงาน = ปุ่มตั้งรอบ **disabled** + บอกให้กรอกก่อน (ห้ามเดาจากวันที่ย้ายเข้ามา)

**ตรวจจริง (23 ส.ค. 2569):** test **2,111 ผ่าน / 6 skip (206 ไฟล์)** · tsc 4 config = 0 ·
eslint 0 error/18 warning · registry **95 route** · migration ถึง **107** (รันฐานจริงครบ) ·
ยิงเส้นเขียนจริงครบทุกเส้นใหม่ (selection-progress · aftercare ครบ 4 การกระทำ) ·
วัดจอ: เช็คลิสต์ **0/6** + ปุ่มหน่วยงานเปิด Popover 1,051 หน่วยงาน (ไม่มี Dialog ซ้อน) ·
หน้าดูแลหลังเริ่มงานสรุป 2/1/1 ตรงข้อมูลทดสอบ + ชิปรอบ 3/7/30 คำนวณถูก + คนไม่รู้วันเริ่มงาน
ปุ่ม disabled · light/dark ไม่มี h-scroll · **ลบข้อมูลทดสอบ + audit ด้วย id ครบ เหลือ 0 ทุกตาราง**

### รอบสามสิบสาม · 24 ส.ค. 2569 — **audit ผังกับโค้ดจริง + ปิดช่องโหว่ "ไม่สนใจ" หลุดการกันเสนอซ้ำ**

**ที่มา:** เจ้าของถามว่า "ระบบได้ตามที่วางกันไว้ไหม" → ตรวจ 4 จุดขนานกัน เจอช่องโหว่จริง 1 จุด
+ ปุ่มขาด popup รายชื่อ 1 จุด + กฎที่ผังพูดถึงแต่ระบบไม่มี 1 ข้อ

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/applicationRotationSql.ts` | **เพิ่มแหล่งที่ 3** ให้ `buildDeclinedThisJobSql` + `buildDeclinedAnyJobSql`: ผลติดต่อจากมือคน (`application_contact_logs.ok = false`) join ผ่านใบสมัคร · และ `buildContactedAboutJobSql` เทียบ `(c.job_id = $1 or a.job_id = $1)` |
| `src/components/recruit-rm/CallChoiceConfirmDialog.tsx` | เพิ่ม prop **`embedded`** — คืนเนื้อล้วนไม่ห่อ AlertDialog (แพทเทิร์นเดียวกับ `GenApplyLinkDialog`) · แยก `namesBlock` ออกมาชิ้นเดียวใช้ทั้งสองโหมด |
| `src/components/jobs/JobApplicantsDialog.tsx` | ปุ่ม "ส่งให้ AI โทร" เลิกใช้ `window.confirm` → ใช้ `CallChoiceConfirmDialog embedded` โชว์รายชื่อจริง |
| `tests/api/applicationRotationSql.test.ts` · `tests/api/declinedUnitScope.test.ts` | แก้เทสต์ที่ล็อกจำนวน `union`/`'declined'` ไว้ + เพิ่มเคสจับช่องโหว่ (ok=false · a.job_id · ไม่มีหน้าต่างเวลาบนเส้นที่สาม) |

🔴 **กับดักที่เป็นต้นเหตุ (จำไว้):** คอมเมนต์เดิมเขียนว่า *"ผลจากคนถูกเขียนลง holds อยู่แล้ว"*
จึงไม่นับ contact log — **ไม่จริง** `createContactLog()` เขียนแค่ log + status ไม่แตะ holds
⇒ คนที่บอกเจ้าหน้าที่ว่าไม่เอา ยังถูก AI โทรงานเดิมซ้ำได้ · **ข้อสมมติในคอมเมนต์ต้องพิสูจน์ ไม่ใช่เชื่อ**
🔴 **กับดักที่สอง:** `application_contact_logs.job_id` = "ใบที่นัดลง" เขียนเฉพาะตอน `ok && appointmentAt`
⇒ log ที่ `ok=false` มี `job_id` เป็น **null ตลอด** จึงหลุด cooldown 30 วันด้วย — ต้องเทียบ `a.job_id` (ใบที่เขาสมัคร)
🔴 **กติกา:** `CallChoiceConfirmDialog` เรียกจากในป๊อปอื่น **ต้องส่ง `embedded`** ไม่งั้นเป็น Dialog ซ้อน Dialog

**ตรวจจริง 24 ส.ค. 2569:** ยิงบนฐานจริง — ใส่ log `ok=false` ให้ใบสมัคร `f7602f74…` แล้ว
`phonesDeclinedThisUnit` เปลี่ยนจาก `false` → **`true`** (ระดับใบขอด้วย) · **ลบด้วย id ครบ เหลือ 0 แถว**
· สถานะใบสมัครไม่ถูกแตะ (ยัง `new` — insert ตรงไม่ผ่าน `createContactLog`) ·
วัดจอจริง: ป๊อปผู้สมัครของใบ `LMM6704005` กด "ส่งให้ AI โทร" → **ไม่เรียก `window.confirm`** ·
`role="dialog"` ที่เปิดอยู่ยังมี **1 อัน** (ไม่ซ้อน) · เห็นชื่อจริง "1. นายดำรงค์ คงจะดี" ·
ปุ่มยืนยันบอกผล "ส่ง 1 คนเข้าคิวโทร" · **ไม่ได้กดยืนยัน** (จะยิงสายจริงหาคนจริง) กดยกเลิกแล้วกลับหน้าเดิม
· test **2,115 ผ่าน / 6 skip (206 ไฟล์)** · tsc 4 config = 0 · eslint 0 error / 18 warning

**ยังไม่ทำ (เจ้าของสั่ง):** กฎ "Follow ไม่เกิน 7 วัน" — *"เดี๋ยว User จัดการเอง"* ห้าม implement
(ตรวจแล้วว่าระบบ**ไม่มี**กฎนี้เลย เลข 7 ที่มีเป็นคนละเรื่องหมด: `CONFIRMED_FOCUS_DAYS` บังไม่ให้
เสนอใบอื่น · พักเบอร์โทรผิดคน 7 วัน · รอบ aftercare วันที่ 7 · เส้นแบ่งใบด่วน/ล่วงหน้า)

### รอบสามสิบสี่ · 24 ส.ค. 2569 — **Phase 10 เริ่ม: รื้อหน้าหลักตามภาพอ้างอิงที่เจ้าของส่งมา**

**เจ้าของเคาะ:** ฉาก + KPI แถวบน + 3 แผงล่าง (คง shell เดิม ไม่ทำ sidebar ถาวร) · **6 แท่นตามระบบจริง**
(ไม่ตัด "ดูแลหลังเริ่มงาน" ออกแม้ภาพมี 5) · **ทำตัวเทียบวันต่อวันจริง** · แยกตาม BU · ฉากทำด้วย SVG/CSS ไปก่อน

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/homeBu.ts` | **ใหม่ · pure** — 🔴 **BU มาจาก `site_code` ตำแหน่ง 3-5 ไม่ใช่ prefix เลขที่ใบขอ** |
| `src/lib/homeKpi.ts` | **ใหม่ · pure** — 5 KPI + ตัวเทียบเมื่อวาน · `delta=null` เมื่อไม่มีของเทียบ · ธง `quiet` · `MIN_RATE_SAMPLE=5` |
| `src/lib/homeDigest.ts` | **ใหม่ · pure** — จัดเรียง 3 แผงล่าง + เวลาสัมพัทธ์ (รับ `now` เข้ามา ไม่อ่านนาฬิกาเอง) |
| `api/_handlers/home-kpis.ts` | **ใหม่** `GET /api/home-kpis?bu=` — registry **96 route** · cache 20 วิ ต่อ BU · ทุกก้อนกลืน error ของตัวเอง |
| `src/lib/homeKpiApi.ts` | **ใหม่** — client (ล้ม = ซ่อนแถบ ไม่ขึ้นกรอบ error) |
| `src/components/home/HomeKpiRow.tsx` · `HomeBuFilter.tsx` · `HomeDigestPanels.tsx` | **ใหม่** — แถบ KPI 5 ใบ · ปุ่มสลับ BU (นับใบขอต่อ BU) · 3 แผงล่าง |
| `src/components/home/OfficeFloor.tsx` | เพิ่ม `Workstation` (เก้าอี้ + มาสคอต + จอ 2 ตัว + **โต๊ะบังตัวล่าง**) · มาสคอตเล็กลง 86→68 · Core มีผนังกระจก+ฝาบน · สายมีจุดข้อมูลวิ่ง |
| `src/index.css` | คลาสใหม่ `jarvis-office-desk` · `-desk-glow` · `-chair` · `-screen-bar` · `-core-glass` · `-core-cap` · `-spark` |
| `src/pages/HomePage.tsx` | วาง BU filter + KPI row เหนือฉาก · 3 แผงล่างก่อนแผง Lumos/Follow เดิม |

🔴 **กับดักที่เจอจริงรอบนี้ (จำไว้):**
1. **BU ไม่ได้อยู่ในเลขที่ใบขอ** — prefix (OPL/LMO/LAO/DSO/SQ/LAM/LMM/LBM/PEO) เป็น **ชนิดใบขอ**
   ไม่มี LBA/LBD เลย · BU จริงอยู่ใน `site_code`: LBD 170 · LML 81 · LBA 22 · DSL 8 · SNJ 3
   👉 ถ้าเผลอใช้ prefix ตัวกรองจะ "ทำงาน" แต่แบ่งผิดสายธุรกิจทั้งหมดโดยไม่มีใครรู้
2. 🔴 **ห้ามซ้อน `transform: scale()` ในบริบท CSS 3D ของป้ายตั้ง** — เกิด containing block ใหม่
   แล้วชิ้นที่มี `perspective()/rotateY()` กางเป็นบล็อกสียักษ์พาดทั้งฉาก ⇒ **คูณพิกัดเอง**
3. 🔴 **`.jarvis-office-panel` มี `@apply relative`** ซึ่งชนะ utility `absolute` —
   ต้องประกาศ `position:'absolute'` ใน inline style (จอกางเป็น 342×308 เพราะข้อนี้)
4. **`HudPanel` ไม่มี prop `dense`** — ใส่ไปแล้ว tsc ไม่ฟ้อง (React ปล่อยผ่าน) แต่ไม่มีผล
5. **ตัวเทียบวันต่อวันทำได้เฉพาะเหตุการณ์ที่มีเวลา** — "ใบขอเปิดกี่ใบ / ข้อเสนอค้างกี่ใบ"
   เทียบไม่ได้เพราะไม่เก็บ snapshot รายวัน ⇒ **ไม่เอาเข้าแถบ KPI เลย** (ห้ามแต่งเลข)
6. **วันเงียบห้ามแปะ 0** — ฐานจริงวันนี้ 0 ทุกช่อง · อัตรา % ที่ตัวอย่าง < 5 สายห้ามอวด
   (เคยขึ้น "0 %" ซึ่งคนอ่านว่าโทรไม่ติดเลย ทั้งที่จริงคือยังไม่มีสาย — แก้แล้ว)

**ตรวจจริง 24 ส.ค. 2569:**
* SQL พิสูจน์ว่านับได้จริง (ไม่ใช่ 0 ตลอด): 19 ส.ค. **5 สาย** (ต่อติด 3 · สนใจ 1) · 18 ส.ค. **38 สาย**
  · แยก BU ได้ (18 ส.ค.: LBD 18 · DSL 14 · LBA 5) · เทียบวันก่อนหน้าได้ (5 vs 38)
* ยิงเส้นจริงผ่านเบราว์เซอร์: `bu_options` 5 ตัวจากข้อมูลจริง · `?bu=LBD` รับ · `?bu=DROP TABLE` → `null`
* **พิสูจน์ปลายทางจริง**: ใส่ log นัดสัมภาษณ์ 1 แถว (วันนี้) → การ์ดขึ้น **"นัดสัมภาษณ์วันนี้ 1 นัด · +1 นัด จากเมื่อวาน"**
  → **ลบด้วย stamp เหลือ 0 แถว · สถานะใบสมัครไม่ถูกแตะ (ยัง `new`)**
* วัดจอ 1434px: KPI 5 ใบ · ปุ่ม BU 6 ตัว · 3 แผงครบ · ฉากมี 6 โต๊ะ + Core กระจก + จุดวิ่ง 4 เส้น · ไม่มี h-scroll
* มือถือ 375px: KPI **2 คอลัมน์** · ฉากซ่อน (ใช้รายการโต๊ะเดิม) · **ไม่มีของล้นขอบเลย**
* test **2,145 ผ่าน / 6 skip (208 ไฟล์)** · tsc 4 config = 0 · eslint 0 error / **18 warning เท่าฐานเดิม** · registry 96

### รอบสามสิบห้า · 24 ส.ค. 2569 — **ฉากหน้าแรกเป็น "4 ห้อง" ด้วยภาพ render ของเจ้าของ (2.12 + 10.1)**

**ที่มา:** เจ้าของตีตกฉาก CSS (*"ภาพตัวอย่างถ้าไม่ได้ประมาณนี้ไม่ต้องออกมานะเสียเวลาและเปลือง"*)
แล้ว gen ภาพ 4 ห้องส่งมาเอง (จาก prompt ที่เราเขียนให้ — ฉากเปล่าไม่มีตัวหนังสือ/การ์ดฝัง)
→ mockup CSS 4 ห้องที่ทำค้างถูก**ทิ้งทั้งอัน** ไม่ได้ส่ง

| ไฟล์ | ทำอะไร |
|---|---|
| `public/office/office-rooms.jpg` | **ใหม่** — ภาพฉากจากเจ้าของ (แปลงจาก PNG 2.4MB → JPEG 605KB · 1672×941) |
| `src/lib/officeRooms.ts` | **ใหม่ · pure** — รวมโต๊ะ 6 ตัวเป็น 4 ห้อง (online=content · recruit=intake · select=selection+follow+aftercare · ai=aiCalls) · `ROOM_SPOTS` = ตำแหน่ง % บนภาพ ที่เดียว · เทสต์ 9 เคส |
| `src/components/home/OfficeRooms.tsx` | **ใหม่** — ภาพ + ชั้น DOM ทับ: ป้ายเลขห้อง 4 + การ์ดสถิติ 4 ใบ (เลขสด กดได้ทุกแถว) + ป้าย JARVIS Core · **ภาพโหลดไม่ได้ → fallback `OfficeFloor` ฉาก CSS เดิมทั้งก้อน** (2.12.4) · md การ์ดลงใต้ภาพ · มือถือไม่ใช้ภาพ |
| `src/pages/HomePage.tsx` | สลับ `OfficeFloor` → `OfficeRooms` (ฉากเดิมไม่ถูกลบ — เป็น fallback) |

🔴 **กับดัก/กติกาใหม่:**
1. **เลข/การ์ดห้ามฝังในภาพ** — ภาพต้อง gen แบบไม่มีตัวหนังสือ เพราะเลขฝังจะตายค้างและโกหกคนดู
   (การ์ดจริงวางทับด้วย % จาก `ROOM_SPOTS` · เปลี่ยนภาพต้องวัดตำแหน่งใหม่ที่นั่นที่เดียว)
2. **aspect-ratio ของกรอบต้องตรงไฟล์ภาพ** (`1672 / 941`) ไม่งั้นตำแหน่ง % เพี้ยนทั้งฉาก
3. หัวการ์ดชื่อไทยห้ามต่อท้าย "Room" — เคยได้ **"คัดสรร Room"** (เทสต์ล็อกแล้ว: `ห้องคัดสรร`)
4. `officeRooms.ts` **ห้ามคิดเลขใหม่** — ทุกเลขมาจาก `Desk` ของ `officeFloor.ts` (นิยามเดียวทั้งระบบ)
5. 🔴 บั๊กที่เกือบหลุดตอนทำ mockup: `python s.index('  /* หมายเลขชี้')` ไปเจอคอมเมนต์ชื่อเดียวกันใน
   `<style>` ก่อน → slice กินเนื้อไฟล์ทั้งกลาง — **patch ด้วยสตริงสั้นที่ซ้ำได้ = อันตราย เขียนไฟล์ใหม่ทั้งก้อนแทน**

**ตรวจจริง 24 ส.ค. 2569:** ภาพโหลดจริง (naturalWidth 1672) · ชิ้นทับภาพ 9 ชิ้นอยู่ในกรอบครบ
ไม่ทับกันเอง (วัด bbox ทุกชิ้น) · การ์ด 4 ใบ + ป้ายเลขห้อง 4 + Core ครบ · แถวการ์ดกดแยกปลายทางได้
(ห้องคัดสรร 3 แถว 3 ปลายทาง) · มือถือ 375px: ภาพซ่อน การ์ด 4 ใบเรียงลงมา ไม่มี h-scroll ·
test **2,154 ผ่าน / 6 skip (209 ไฟล์)** · tsc app = 0 · eslint 0 error / 18 warning เท่าฐาน

### รอบสามสิบหก · 24 ส.ค. 2569 — **ถอดแถบ funnel · หน้าแรกเหลือ 4 ห้อง + Dashboard ครบระบบ**

**เจ้าของเคาะ:** *"อยากให้มีแค่ 4 ห้องแต่มี Dashboard บอกครบทั้งระบบอะ"* และ 2 แผงเรื่องสาย
*"เอาไว้กับทีม Lumos"*

**วัดจริงก่อนถอด (สำคัญ — เหตุผลของการถอด):** funnel 7 กล่อง **ซ้ำกับการ์ดห้องไปแล้ว 4 กล่อง**
· AI แนะนำคนแล้ว **174** = ห้องคัดสรร → คัดสรร/เสนองาน **174 ใบขอ** (เลขเดียวกันเป๊ะ)
· ส่งคิด Content **1** = Online Room → กำลังคิดคอนเทนต์ **1 ใบ** · ส่ง Scraping **0** = Online Room
· ผลจากการโทร **40** = แผง "ผลโทรเดือนนี้" · (ส่ง AI โทร ซ้ำบางส่วนกับ AI Call Room)
ขนาดที่กิน: หน้ายาว **2,639px** ท่อนท้ายใต้ฉาก **1,268px ≈ ครึ่งหน้า** (funnel เอง 320px)

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/HomePage.tsx` | **ถอดแถบ funnel ทั้งบล็อก (−156 บรรทัด)** + ถอดโค้ดตายให้สุด: `FlowStage` · `FLOW_ROW_GRID` · `postingStagesSub` · import `PageHeroStrip`/`heroButton`/`resolveUnitNavPath`/`jobPostingStatusLabel`/`ArrowRight`/`ArrowDown` · 748 → **618 บรรทัด** |
| `src/lib/homeKpi.ts` | เพิ่ม `StandingCard` + `buildOpenRequestsCard()` — การ์ด **ยอดคงค้าง** ที่ **ไม่มีตัวเทียบเมื่อวานตลอดกาล** (แยก type ออกจาก `KpiCard` เพื่อไม่ให้เผลอวาดลูกศร) |
| `src/components/home/HomeKpiRow.tsx` | รับ prop `standing` วางเป็นการ์ดใบแรก · grid 5 → **6 คอลัมน์** เมื่อมีการ์ดนี้ |
| `src/lib/officeRooms.ts` | เพิ่ม `fillRows()` — ห้องรวมหลายโต๊ะเติมช่องที่เหลือ (ถึง `MAX_ROWS`) ด้วย stat ที่ยังไม่ได้โชว์ ⇒ **"ยังไม่มีคนแนะนำ 119" ไม่หายจากหน้าแรก** |
| `tests/api/officeRooms.test.ts` | แก้สัญญาเดิม (ห้องรวมได้ 3 แถว → **4 แถว**) + เพิ่ม 3 เคส: ไม่ซ้ำแถวเดิม · ลำดับคงที่ · ห้องโต๊ะเดียวไม่ถูกเติมซ้ำ |

🔴 **สองเลขที่ไม่ซ้ำใครถูกย้าย ไม่ได้ทิ้ง** (กติกา "ทุกตัวเลขต้องมีที่ไป"):
* "ใบขอเปิดอยู่ **293** · ด่วน **199** ใบ" → **การ์ด KPI ใบแรก** (ตรงกับภาพอ้างอิงที่การ์ดใบแรก
  คือ "ตำแหน่งเปิดรับทั้งหมด") · ไม่มีลูกศรเทียบเพราะเป็นยอดคงค้าง ไม่ใช่เหตุการณ์
* "ยังไม่มีคนแนะนำ **119**" → แถวที่ 4 ของการ์ดห้องคัดสรร (ผ่าน `fillRows`)

🔴 **dialog ไม่กำพร้า** — `callResultsOpen` / `activeCallsOpen` เปิดจาก `LumosCallHealthPanel`
(`onOpenResults`/`onOpenWaiting`) อยู่แล้ว การถอด tile จึงไม่ทำให้ dialog เข้าไม่ถึง
(เช็คก่อนถอด — ถ้าเปิดได้จาก tile ทางเดียวจะกลายเป็นฟีเจอร์กำพร้า)

🔴 **สองแผงเรื่องสายจับกลุ่มใต้หัวข้อ "ห้อง AI Call · ทีม Lumos"** (เม็ดเลข 4 + สีชมพูของห้อง)
— เดิมเป็นแผงลอยท้ายหน้าที่ไม่บอกว่าเป็นของทีมไหน

**โครงหน้าแรกตอนนี้:** ทักทาย → ตัวกรอง BU → **KPI 6 ใบ** (ยอดคงค้าง 1 + เหตุการณ์ 5) →
**ฉาก 4 ห้อง** (ภาพ render + การ์ดสด) → 3 แผง (อัปเดตล่าสุด · ผลงานเด่น · ผลโทรเดือนนี้) →
กลุ่มทีม Lumos (สุขภาพสาย + Follow วันนี้) · **หน้ายาว 2,639 → 2,355px**

**ตรวจจริง:** วัด DOM ว่าทุกส่วนอยู่ครบ 9/9 · KPI 6 ใบ · การ์ดห้อง 4 ใบ · ภาพฉากโหลด ·
funnel หายจริง · test **2,157 ผ่าน / 6 skip (209 ไฟล์)** · tsc 4 config = 0 ·
eslint 0 error / 18 warning เท่าฐาน

### รอบสามสิบเจ็ด · 25 ส.ค. 2569 — **Dropdown ราชการ/เอกชน บนหน้าหน่วยงาน**

**เจ้าของสั่ง:** *"ในหน้าหน่วยงาน เพิ่ม Dropdown ให้เลือกว่าเป็น ราชการ หรือ เอกชน"*
เคาะเพิ่มหลังเห็นข้อมูลจริง: **2 ตัวเลือก · ให้คนระบุเอง** (ไม่ derive จาก ERP)

🔴 **ที่ตรวจเจอก่อนลงมือ (สำคัญ — อย่าลืมตอนแก้ต่อ):**
1. **ERP มีข้อมูลนี้อยู่แล้ว แต่ใช้ตรง ๆ ไม่ได้** — `st_site_contract_p1.customer_group_code`
   + ตารางแม่ `ms_customer_group` (001 เอกชน · 002 ราชการ · 003 กฟภ. · 004 รัฐวิสาหกิจ ·
   005 บุคคลธรรมดา · 006 ขายทอดตลาด · 007 ศาสนสถาน)
   วัดจริงบนใบขอที่เปิดอยู่: เอกชน 11,660 · ราชการ 2,950 · **กฟภ. 2,671** · **ไม่รู้กลุ่ม 2,804**
   ⇒ กฟภ./รัฐวิสาหกิจ จะนับฝั่งไหน = นโยบาย ไม่ใช่ข้อมูล · เจ้าของจึงเลือกให้คนระบุเอง
2. 🔴 **`job_category` ในโค้ดถูกฮาร์ดโค้ดเป็น `'private'` ทุกใบ** ทั้ง `siamrajUnitRequests.ts:166`
   และ `siamrajSqlServerRequests.ts:224` ⇒ ช่องค้นหาบนหน้าหน่วยงานที่รวม
   `JOB_CATEGORY_LABELS[j.job_category]` ทำให้พิมพ์ "เอกชน" แล้วเจอทุกใบ (**ยังไม่ได้แก้**)

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/108_unit_sector.sql` | **ใหม่** — ตาราง `unit_sector` คีย์ **site_code** + CHECK สองค่า |
| `src/lib/unitSector.ts` | **ใหม่ · pure** — ค่า/ป้าย/normalize · เทสต์ 11 เคส |
| `api/_handlers/unit-sector.ts` | **ใหม่** `GET/PATCH` · registry **97 route** |
| `src/lib/unitSectorApi.ts` · `src/components/jobs/UnitSectorSelect.tsx` | **ใหม่** — client + dropdown (shadcn `select`) |
| `src/lib/jobListTableSort.ts` | เพิ่มคอลัมน์ `sector` + `TableSortContext` (ค่ามาจากนอก `JobRequest`) |
| `src/pages/jobs/JobListPage.tsx` | คอลัมน์ใหม่หลัง "หน่วยงาน" (เดสก์ท็อป) + แถวในการ์ด (มือถือ) + optimistic save |

🔴 **กติกาที่ฝังไว้:**
* **คีย์เป็น site_code ไม่ใช่เลขที่ใบขอ** — 293 ใบมาจาก **138 หน่วยงาน** ⇒ กรอกครั้งเดียวใช้ทั้งไซต์
  (คีย์รายใบต้องกรอก 293 ครั้ง และใบใหม่ของไซต์เดิมจะว่างอีก)
* **"ยังไม่ระบุ" ≠ เอกชน** — ห้ามตั้ง default · เป็นตัวเลือกจริงที่ล้างค่าได้
* 🔴 **`normalizeUnitSector` แยก `undefined` (ค่ามั่ว → 400) ออกจาก `null` (ล้างค่า)**
  ถ้ารวมเป็นค่าเดียว ค่ามั่วจะกลายเป็นการลบของที่ทีมระบุไว้แบบเงียบ ๆ
* **เรียงคอลัมน์นี้ได้เหมือนทุกคอลัมน์** (กติกาเจ้าของ 20 ส.ค.) · "ยังไม่ระบุ" ถือเป็นค่าว่าง **ตกท้ายเสมอ**
* dropdown อยู่ในแถวที่กดแล้วเปิดใบขอ ⇒ ต้อง `stopPropagation` ไม่งั้นเลือกแล้วเด้งออกจากหน้า
* `JwtUserPayload` มีแค่ `sub`/`email`/`role` — **ไม่มี `id`/`full_name`** (tsc api จับได้ 2 error)

**กับดักที่เจอตอนทำ:** หน้านี้มี **thead สองอัน** (ตาราง skeleton บรรทัด ~706 กับตารางจริง ~876)
เผลอเติม `<th>` ลงตาราง skeleton → หัว 14 ช่อง/แถว 15 ช่อง เหลื่อมกัน · และหัวตารางจริงสร้างจาก
รายการคีย์ `JOB_LIST_TABLE_COLUMNS` **ต้องเรียงให้ตรงลำดับเซลล์** ไม่งั้นหัวกับช่องคนละตำแหน่ง

**ตรวจจริง 25 ส.ค. 2569:** ยิงเขียนจริงครบวง — บันทึก 200 · **ค่ามั่ว → 400 และค่าเดิมไม่หาย** ·
ล้างค่า 200 · กดผ่าน dropdown จริง: เลือก "ราชการ" แล้ว **ใบขอทั้ง 2 ใบของไซต์เดียวกันเปลี่ยนตาม**
· ไม่เด้งออกจากหน้า · toast ขึ้น · **ลบข้อมูลทดสอบครบ เหลือ 0 แถว** ·
หัว 15/เซลล์ 15 ตรงตำแหน่ง · มือถือ 375px ปุ่มสูง 36px ไม่มีของล้นขอบ ·
test **2,172 ผ่าน / 6 skip (210 ไฟล์)** · tsc 4 = 0 · eslint 0 error/18 warning · build ผ่าน

### รอบสามสิบแปด · 25 ส.ค. 2569 — **แถบกดลงมาดูรายละเอียด + เงินคนที่ออก + ผู้รับผิดชอบบรรทัดเดียว**

**เจ้าของสั่ง 3 ข้อ:** กดลงมาค่อยเห็นข้อมูล + ดึงรายได้มาด้วย · ผู้รับผิดชอบให้อยู่บรรทัดเดียว ·
เอาเงินเดือนล่าสุดของคนที่ออกมาโชว์ได้ไหม (เคาะ: **โชว์ทั้งสองก้อนพร้อมป้ายกำกับ**)

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/siamrajSqlServerRequests.ts` | 🔴 **แก้ครบ 3 จุดตามกติกา** (row type + BASE_SQL + `SELECT_COLUMNS`) + `OUTER APPLY hr_staff_changing` เอาแถวล่าสุดต่อ staff_id |
| `src/types/index.ts` | `resigned_wage_draw_rate` · `resigned_wage_fee_rate` · `resigned_wage_effective_date` (null = ไม่รู้) |
| `src/lib/unitRequestDetail.ts` | **ใหม่ · pure** — แปลงเป็นกลุ่ม "ป้าย → ค่า" · เทสต์ 9 เคส |
| `src/components/jobs/UnitRequestDetailPanel.tsx` | **ใหม่** — วาดแถบรายละเอียด |
| `src/pages/jobs/JobListPage.tsx` | ปุ่มลูกศรกาง/หุบ + แถว `colSpan={15}` (เดสก์ท็อป) · ปุ่มในการ์ด (มือถือ) · **ผู้รับผิดชอบรวมเป็นบรรทัดเดียว** |

🔴 **เงินคนที่ออก — ที่มาและข้อจำกัด (จำไว้):**
* มาจาก `hr_staff_changing` (แถว `effective_date` ล่าสุด) เชื่อมผ่าน `st_request_staff.staff_id`
* **สองตัวเลขคนละความหมาย**: `wage_draw_rate` = เงินที่จ่ายพนักงาน · `wage_fee_rate` = ค่าที่เก็บลูกค้า
  ⇒ ห้ามรวมกัน ห้ามเดาว่าตัวไหนคือ "เงินเดือน" · จอต้องมีป้ายกำกับทั้งคู่เสมอ
* **ความครบ 3,914 / 5,158 ใบ = 76%** (วัดจริง) ⇒ `null` = ไม่รู้ **ห้ามแสดงเป็น 0**
  แต่ **0 ที่มาจากฐานต้องโชว์ 0** (แปลว่าไม่ได้เบิกส่วนนั้น) — เทสต์ล็อกสองเคสนี้ไว้แล้ว
* ⚠️ `effective_date` บางแถวเป็น **อนาคต** (ออก ก.ย. 69 แต่ effective ก.ย. 70)
  ยังไม่ยืนยันว่าหมายถึงอะไรแน่ — จึงติดป้ายกลาง ๆ ว่า "วันที่ของรายการล่าสุดใน ERP"
* วัดจริง: `total_income` ของใบขอ (payment_rate) = ตัวเดียวกับ `fee` ของคนที่ออกในหลายใบ

🔴 **กติกาที่ฝังไว้:**
* ปุ่มกางอยู่ในแถวที่กดแล้วเปิดใบขอ ⇒ **ต้อง `stopPropagation`** ไม่งั้นกางแล้วเด้งออกจากหน้า
* แถวรายละเอียด **ไม่ผูก onClick เปิดใบขอ** (อ่านอยู่แล้วเผลอกดโดนจะเด้ง)
* กลุ่มที่ไม่มีของจริงสักช่อง **ไม่โชว์ทั้งกลุ่ม** ห้ามขึ้นหัวข้อว่าง
* ผู้รับผิดชอบ: คนที่ยังไม่มีชื่อ **ตัดทิ้ง** ไม่โชว์ "OPL —" ให้รก · ไม่มีใครเลยค่อยขึ้นขีดเดียว
* ห่อแถวด้วย `React.Fragment key` (สองแถวต่อใบขอ) — `key` ย้ายไป Fragment ไม่ใช่ `<tr>`

**เพื่อนร่วมทีม commit อะไรมา (ตอบเจ้าของ):** `scripts/test-lumos-push-interviews.mts`
โดย Wutthipong Luangsanam — สคริปต์ debug ยิง pushInterviews ไป Lumos ตรง ๆ เพื่อไล่ error 401
พิมพ์ request/response เต็ม (มาสก์ key) · **สคริปต์เดี่ยว ไม่มีโค้ดไหน import ไม่อยู่ใน build/deploy**

**ตรวจจริง 25 ส.ค. 2569:** feed คืนค่าใหม่จริง **35/40 ใบมีเงินคนที่ออก** พร้อมชื่อ ·
กดกางบนจอจริง: แถว 20→21 · แผงขึ้น "ค่าจ้างตามสัญญา 16,304 · draw 23,861 · fee 16,304"
พร้อมป้ายครบ · **ไม่เด้งออกจากหน้า** · ผู้รับผิดชอบสูง **18px = บรรทัดเดียว** (`whitespace: nowrap`)
· มือถือ 375px กางได้ ไม่มีของล้นขอบ · test **2,181 ผ่าน / 6 skip (211 ไฟล์)** ·
tsc 4 = 0 · eslint 0 error/18 warning · build ผ่าน

### รอบสามสิบเก้า · 25 ส.ค. 2569 — **ย้าย dropdown ราชการ/เอกชน จากตาราง → ใบงาน**

**เจ้าของสั่ง:** *"ราชการ เอกชนเจอแล้ว แต่ย้ายมาไว้ในใบงานเลือกจากใบงาน"*

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | **เพิ่ม** ช่องเลือกถัดจาก "รหัสไซต์" + โหลด/บันทึกแบบ optimistic + บรรทัดกำกับ "มีผลกับทุกใบขอของหน่วยงานนี้" |
| `src/pages/jobs/JobListPage.tsx` | **ถอดออกให้สุด** — คอลัมน์ · เซลล์ · การ์ดมือถือ · state `sectors`/`savingSite` · `changeSector` · import 3 ตัว · `colSpan` 15 → 14 |
| `src/lib/jobListTableSort.ts` | ถอดคอลัมน์ `sector` + `TableSortContext` (ไม่มีใครใช้แล้ว) · คืน signature เดิม |
| `tests/api/jobListTableSort.test.ts` | ถอดเทสต์ของคอลัมน์ที่ไม่มีแล้ว (18 → 14 เคส) |

🔴 **บันทึกไว้ว่ารู้แล้วตอนตัดสินใจ:** วัดฐานจริงก่อน push พบว่า **`sirirat.j@siamraj.com` กรอกจากตาราง
ไปแล้ว 79/138 ไซต์** (ราชการ 4 · เอกชน 75) ระหว่าง 09:56–10:33 น. ของวันเดียวกัน
⇒ แจ้งเจ้าของว่าอีก 59 ไซต์ที่เหลือจะต้องเปิดใบงานทีละใบ (ช้ากว่าเดิมมาก) และคนที่กรอกอยู่
จะหาช่องเดิมไม่เจอ · **เจ้าของยืนยันให้ย้ายอย่างเดียว** จึงถอดออกจากตารางตามสั่ง
👉 ถ้าวันหน้าจะเอากลับ: คอลัมน์ + ตัวเรียงอยู่ใน commit ก่อนหน้า (`3ec2608`) ย้อนดูได้

**กับดักตอนถอด:** regex ที่ลบก้อน state กิน `expanded` state (ของแถบกดลงมา) ติดไปด้วย —
tsc จับได้ 4 error ทันที · **ลบเป็นก้อนด้วย regex ต้องเช็ค tsc ทุกครั้ง อย่าเชื่อว่าตัดตรงที่คิด**

**ตรวจจริง:** ตาราง **หัว 14 / เซลล์ 14 ตรงกัน** · ปุ่มกางรายละเอียดยังอยู่ครบ 20 แถว ·
ใบงานมีช่อง "ราชการ / เอกชน" พร้อมค่าที่เคยบันทึก (`68LBDL0024` = ราชการ) และบรรทัดกำกับ ·
test **2,177 ผ่าน / 6 skip (211 ไฟล์)** · tsc 4 = 0 · eslint 0 error/18 warning · build ผ่าน

### รอบสี่สิบเอ็ด · 25 ส.ค. 2569 — **ย้ายลูกศร/ผู้รับผิดชอบไปหน้าใบขอ · ราชการ-เอกชนของจริง · เปิดโต๊ะดูแลหลังเริ่มงาน**

**เจ้าของสั่ง:** *"ไอลูกศรที่กดแล้วค่อยแสดงรายละเอียด ฉันหมายถึง กดเข้าใบขอไปแล้วทำไอคำว่า
ข้อมูลใบขอ ทำเป็นแบบลูกศรแล้วโชว์รายละเอียด · ผู้รับผิดชอบก็หมายถึงกดใบขอเข้าไปแล้วค่อยทำให้
เป็นบรรทัดเดียวกัน **หน้าก่อนกดเข้าไปทำเหมือนเดิม**"* + สั่งเพิ่ม 4 ข้อ (9.1/9.2 · job_category ·
aftercare · 10.3/10.5) และ *"[คิว Lumos] มันข้อมูลทดสอบ เคลียร์ออก"*

🔴 **รอบ 38 ทำถูกของ แต่ผิดที่** — แถบกางกับผู้รับผิดชอบบรรทัดเดียวควรอยู่ใน**หน้าใบขอ**
ไม่ใช่ตารางหน้ารายการ · รอบนี้ย้ายให้ถูกที่ + **คืนตารางเป็นของเดิมทุกจุด**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | หัวข้อ **"ข้อมูลใบขอ" เป็นปุ่มกาง/หุบ** (`infoOpen` · 🔴 **หุบเป็นค่าตั้งต้น** เจ้าของเคาะ) · ทั้งแถวกดได้ ไม่ใช่แค่ลูกศร · เพิ่ม 4 ช่อง: ค่าปรับต่อวัน · draw · fee · วันที่ ERP · **ผู้รับผิดชอบ `sm:grid-cols-3` = บรรทัดเดียว** ทั้งฝั่งแก้ไขและอ่านอย่างเดียว |
| `src/pages/jobs/JobListPage.tsx` | **ถอดของรอบ 38 ออกให้สุด** — ปุ่มลูกศร (เดสก์ท็อป+มือถือ) · แถวรายละเอียด · state `expanded` · `React.Fragment` · คืน `<tr key>` · **คืนผู้รับผิดชอบเป็น 3 บรรทัด** · ช่องค้นหาใช้ `jobSectorLabel` แทน `JOB_CATEGORY_LABELS` |
| `src/components/jobs/UnitRequestDetailPanel.tsx` | **ลบทิ้ง** (ไม่มีใครใช้แล้วหลังคืนตาราง — เอาออกให้สุด ไม่ทิ้ง dead code) |
| `src/lib/unitRequestDetail.ts` | เพิ่ม `moneyFieldText()` (null→undefined · **0→"0 บาท"**) · ถอด `detailSummary` (ใช้เฉพาะปุ่มที่ถอดไปแล้ว) |
| `api/_lib/unitSectorStore.ts` | **ใหม่** — `getUnitSectorMap()` + `attachUnitSector()` · อ่านตาราง 108 ที่เดียว (handler `unit-sector` ใช้ตัวเดียวกัน) · อ่านไม่ได้ = แผนที่ว่าง ไม่ล้ม feed |
| `api/_handlers/siamraj-unit-requests.ts` | แปะ `unit_sector` ทั้ง 3 เส้น (รายใบ · รายการ · `?closed=1`) |
| `src/types/index.ts` | `JobRequest.unit_sector?: UnitSector \| null` + คอมเมนต์เตือนบน `job_category` |
| `src/lib/unitRequestDisplay.ts` | **ใหม่** `jobSectorLabel()` — ที่เดียวที่ตัดสินว่าเชื่อ `unit_sector` หรือ `job_category` |
| `src/components/jobs/JobBoardView.tsx` | ป้ายประเภทใช้ `jobSectorLabel` |
| `api/_handlers/office-floor.ts` | **`loadAftercare()`** ยิงแยก (42P01 = `undefined` ไม่ล้มทั้งเส้น) → ส่ง `counts.aftercare` |
| `src/lib/officeFloor.ts` | `OfficeFloorCounts.aftercare?` · `composeOfficeFloorRaw` อ่านจาก counts ก่อน · **ป้ายโต๊ะคัดสรรขึ้นต้นด้วย "ใบขอที่…"** (Phase 10.3) |
| `api/_lib/siamraj*{Requests,Prequests,Closed}.ts` · `siamrajUnitRequests.ts` | คอมเมนต์เตือนที่ `job_category: 'private'` ว่าเป็นค่าโครงสร้าง ห้ามเอาไปแสดง |

🔴 **กติกาที่ฝังไว้รอบนี้:**
* **`job_category` ของใบขอ ERP เป็นค่าโครงสร้าง ห้ามแสดง/ค้นหา** — ฮาร์ดโค้ด `'private'`
  ทั้งสี่เส้นมาตั้งแต่วันแรก · ราชการ/เอกชนของจริงอยู่ที่ `unit_sector` ผ่าน `jobSectorLabel`
* **มี property `unit_sector` = แถวนี้มาจาก ERP** (แปะทุกใบแม้ยังไม่ระบุ = `null`)
  ไม่มี property = งานในตาราง `jobs` ของเราเอง ⇒ `job_category` เชื่อได้
* 🔴 **ห้ามขยาย `JobCategory` เป็นค่าที่ 4** — `migrations/002` และ `009` มี
  `check (job_category in ('private','government','bank'))` · เติมค่าใหม่แล้วหน้าแก้ไขงาน
  จะเซฟไม่ผ่าน 500 เงียบ ๆ (นี่คือเหตุผลที่ต้องแยกฟิลด์ใหม่ ไม่ใช่แก้ค่าเดิม)
* **โต๊ะ aftercare: แยก "ยังไม่มีตาราง" (`undefined` → *ยังไม่เปิดใช้*) ออกจาก
  "เปิดแล้วแต่ไม่มีคน"** (`{enabled:true,count:0}` → *ไม่มีคนต้องตามในรอบนี้*) — คนละความหมาย

**กับดักที่เจอตอนทำ:**
1. 🔴 **`src/types/index.ts` มี `job_category` สองที่** — `ClientWorkplace` (บรรทัด ~101)
   มาก่อน `JobRequest` (~196) · `s.index('job_category')` ไปโดนตัวแรก แล้ว tsc ฟ้อง
   `Property 'unit_sector' does not exist` **ทั้งที่เพิ่งเติมไป** — ต้องยึดจาก
   `index('export interface JobRequest {')` แล้วค่อยหาต่อ
2. **วัด `getComputedStyle(...).transform` ของลูกศรได้ identity ทั้งที่คลาส `rotate-180` มา**
   — เพราะอ่านตอน CSSTransition ยัง `currentTime: 0` · `el.getAnimations()` บอกได้
   👉 ลูกศรหมุนจริง ยืนยันด้วยภาพหน้าจอ (ชี้ขึ้น) · **อย่าตัดสินจาก computed style อย่างเดียว**
3. **หน้ารายการต้อง reload หลัง resize** — `useIsMobile` จำค่าเดิม ตารางไม่โผล่จนกว่าจะโหลดใหม่

**ตรวจจริง 25 ส.ค. 2569 (วัดจาก DOM ไม่ใช่ screenshot):**
* ตาราง **หัว 14 / เซลล์ 14** · **ปุ่มลูกศรในตาราง = 0** · ผู้รับผิดชอบกลับเป็น 3 บรรทัด
* ค้นหาบนจอจริง: **"ราชการ" → 7 ใบ · "เอกชน" → 169 ใบ · "ยังไม่ระบุ" → 116 ใบ · ว่าง → 292**
  (7+169+116 = 292 ตรงกับ API เป๊ะ) — **เดิม "เอกชน" ได้ 292 ทุกใบ**
* หน้าใบขอ: หุบเป็นค่าตั้งต้น ✅ · กดแล้วขึ้น **29 ช่อง** · ลูกศรหมุนขึ้น (ภาพยืนยัน) ·
  ราชการ/เอกชนขึ้น "ราชการ" ถูกไซต์ · draw 19,588 / fee 15,565 พร้อมป้าย ·
  **ค่าปรับ = "0 บาท"** (ศูนย์จากฐานจริงต้องโชว์ 0 ไม่ใช่ "—")
* ผู้รับผิดชอบเดสก์ท็อป: 3 คอลัมน์ **top ตรงกันทั้งสาม = บรรทัดเดียว** · มือถือ 375 ซ้อนลง
* มือถือ 375: ไม่มีของล้นขอบ (`scrollWidth` 375) · ปุ่มสูง 41px · light/dark อ่านออกทั้งคู่
* `/api/office-floor` คืน `aftercare {enabled:true, count:0}` · หน้าแรก **ไม่มีคำว่า
  "ยังไม่เปิดใช้" แล้ว** · การ์ดห้องคัดสรรขึ้นแถว **"ดูแลหลังเริ่มงาน 0 คน"**
* คิว Lumos: ยกเลิก 20 แถว (ไม่ลบ · สำรอง id ไว้) → โต๊ะ AI **"เงียบเกิน 1 วัน 0 สาย"** (เดิม 19)

**Phase 9.1 / 9.2 = ทำไปแล้วตั้งแต่ 24 ส.ค. 2569 (แผนแค่ไม่ได้ติ๊ก)** — ยืนยันในโค้ด:
`applicationRotationSql.ts` มีแหล่งที่สาม `c.ok = false` (join ทั้ง `c.job_id` และ `a.job_id`)
· `JobApplicantsDialog` เปลี่ยนเป็น `CallChoiceConfirmDialog` แบบ `embedded` แล้ว

### รอบสี่สิบสอง · 25 ส.ค. 2569 — **Phase 10.5 ปิด: SLA คู่กัน + KPI 3 ใบใหม่**

**เจ้าของเคาะ:** SLA *"โชว์ทั้งคู่ หลุดแล้ว + ใกล้หลุด"* · 2.8 เอาครบทั้ง 3 กล่อง
(ใบขอเข้าใหม่วันนี้ · นัดวันนี้แยก มา/ไม่มา · Follow แยก ต้องโทร/โทรแล้ว/สำเร็จ)

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_handlers/matching-flow-summary.ts` | คำนวณ `sla_at_risk` / `sla_breached` ด้วย **`computeJobSla` ตัวเดียวกับ Dashboard** (ห้ามเขียนสูตรใหม่) + `new_today` / `new_yesterday` / `new_by_bu` |
| `api/_handlers/home-kpis.ts` | `apptToday` (นัดถึงกำหนดวันนี้ + มา/ไม่มา) · `followToday` (ต้องโทร + โทรแล้ว/สำเร็จ) · คืน **Partial** โดยตั้งใจ |
| `src/lib/homeKpi.ts` | `KpiKey` 5 → 8 · `KpiPair.parts` (ตัวแยกย่อย) · `KpiPair.comparable` · `StandingCard.sla` · `buildOpenRequestsCard(total, urgent, sla?)` · `KpiRaw` เป็น Partial |
| `src/lib/flowSummaryApi.ts` | type ฝั่ง client ของ 5 ฟิลด์ใหม่ (optional ทั้งหมด — API รุ่นเก่าไม่ส่งมา) |
| `src/components/home/HomeKpiRow.tsx` | บรรทัด SLA บนการ์ดใบขอ · กริด `xl:grid-cols-5` (9 ใบ = 5+4) |
| `src/pages/HomePage.tsx` | `kpisWithRequests` — ยัด `newRequests` จาก flow-summary เข้าชุด KPI **ตาม BU ที่เลือก** |

🔴 **กติกาที่ฝังไว้:**
* **SLA ต้องมาคู่กันเสมอ** — รู้แค่ตัวเดียว = **ไม่วาดบรรทัดนี้เลย** · วัดจริง 25 ส.ค. 2569
  ใกล้หลุด **14** ใบ แต่หลุดไปแล้ว **202** ใบ (69% ของ 292) ⇒ โชว์ "ใกล้หลุด 14" เดี่ยว ๆ
  คนจะเข้าใจว่ามีปัญหาแค่ 14 ใบ · แต่ **0 ที่รู้จริงต้องโชว์ 0** (ต่างจากไม่รู้)
* 🔴 **`comparable: false` สำหรับยอดคงค้าง** — "Follow ต้องโทร" รวมของค้างจากวันก่อน
  ไม่ใช่เหตุการณ์ของวันนี้ · ตอนแรกปล่อยให้คิด `today - 0` แล้วได้ **ลูกศรเขียว "+1 จากเมื่อวาน"
  ที่แต่งขึ้นมา** ซึ่งผิดกติกาข้อ 1 ของ `homeKpi.ts` เอง (จับได้ตอนดูจอจริง ไม่ใช่ตอนเขียน)
* 🔴 **"มา/ไม่มา" มาจาก `follow_entries` ไม่ใช่ตารางนัดสัมภาษณ์** — วัดจริงแล้ว
  `application_contact_logs` (086) **ไม่มีช่องบันทึกว่ามาหรือไม่มาเลย** มีแต่ `appointment_at`
  ⇒ ที่เดียวที่รู้คือ `outcome_code` ของรายการติดตาม · ชุดคำสำเร็จต้องตรงกับ
  `FOLLOW_OUTCOME_SUCCESS` = `went`/`arrived`/`done` (เช็คแค่ `'done'` เคยทำเลขต่ำกว่าจริงมาแล้ว)
* **`newRequests` ไม่อยู่ใน `/api/home-kpis`** — วันที่ส่งใบขออยู่บน ERP และเส้นนั้นตั้งใจ
  ไม่แตะ MSSQL · `job_site_map` เก็บแค่ job_id/site_code ไม่มีวันที่ ⇒ ต้องมาจาก flow-summary
  และต้องส่ง `new_by_bu` มาด้วย ไม่งั้นการ์ดใบนี้ไม่ขยับตามปุ่มสลับ BU เหมือนใบอื่น
* **SLA ไปอยู่บนการ์ด "ใบขอที่ยังเปิดรับ" ไม่ใช่ stat ของโต๊ะ** — `MAX_ROWS = 4` ของ
  `officeRooms.ts` ตัดแถวทิ้ง เลขสำคัญอาจไม่โผล่เลย

**ตรวจจริง 25 ส.ค. 2569 (วัดจาก DOM):** การ์ด 9 ใบครบ ·
"ใบขอที่ยังเปิดรับ 292 ใบ · ด่วน 199 ใบ · **หลุด SLA 202 ใบ · ใกล้หลุด 14 ใบ**" ·
"ใบขอเข้าใหม่วันนี้ 1 ใบ · −9 จากเมื่อวาน" · "นัดถึงกำหนดวันนี้ · มาแล้ว 0 · ไม่มา 0" ·
"Follow ต้องโทรวันนี้ 1 ราย · **ยังไม่มีของเทียบ** · โทรแล้ววันนี้ 1 · สำเร็จ 1" ·
สลับ BU: ทั้งหมด 1/10 · LBD 0/10 · LML 0/0 (ตรงกับ `new_by_bu` เป๊ะ) ·
มือถือ 375 = 2 คอลัมน์ 165px ไม่มีของล้นขอบ บรรทัด SLA ตัดบรรทัดในการ์ด ไม่โดนตัด ·
test **2,191 ผ่าน / 6 skip** · tsc 4 = 0 · eslint 0 error/18 warning · build ผ่าน

### รอบสี่สิบสาม · 25 ส.ค. 2569 — 🔴 **"เงินคนเก่า" ที่โชว์อยู่คืออัตราตามเงื่อนไข ไม่ใช่เงินที่ได้จริง**

**เจ้าของถาม:** *"ที่บอกคนเก่าได้คือเช็คจากที่เขาได้จริงหรือแค่จากเงื่อนไข"*
→ ไปขุดฐาน ERP จริง คำตอบคือ **แค่จากเงื่อนไข** · รอบ 38 ติดป้ายผิดมาตลอด

**หลักฐานจากฐานจริง (ห้ามลืม):**
1. `hr_staff_changing` เป็นตาราง **เงื่อนไข/อัตรา** ไม่ใช่ payroll — ดูจากคอลัมน์:
   `wage_draw_divide` / `wage_fee_divide` (= หารกี่วัน ปกติ **30**) · `begin_site_date` ·
   `end_date` · `staff_status_code` · `resign_no`
2. **มีแถวรายวัน ค่าซ้ำกันเป๊ะทุกวัน** จนกว่าจะปรับอัตรา — เคส `3169900039291`
   (ปริญญา สุทธิสังข์) มีแถวทุกวัน `wage_draw_rate = 19588` เหมือนกันหมด
3. เงินที่ **ได้รับจริง** อยู่ที่ `wg2_ppayment_head` + `wg2_ppayment_detail`
   (คนเดียวกันมี **18 งวด** · `is_payment = 'Y'` · `payment_no` มีค่า)
   จ่ายจริง: ก.ค. 20,345.32 · มิ.ย. 21,220.84 · พ.ค. 20,927.38 · เม.ย. 21,368.38
   ⇒ **ไม่ตรงกับอัตรา 19,588 สักงวดเดียว**
4. 🔴 **วัดทั้ง feed: 232 ใบที่มีทั้งสองค่า — ต่างกัน 232 ใบ = 100%**
   LAO6908011 อัตรา 45,500 / จ่ายจริง 25,500 (−44%) ·
   OPL6908098 อัตรา 13,150 / จ่ายจริง **31,177.13** (+137% · เกษียณ มีเงินก้อน) ·
   OPL6908107 อัตรา 16,093 / จ่ายจริง 6,823
5. ⚠️ `wg_payment_head` (1.37 ล้านแถว) **ไม่ใช่ตารางที่ใช้** — คนตัวอย่างไม่มีสักแถว
   ของจริงอยู่ที่ `wg2_ppayment_head` (1.79 ล้านแถว)

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/siamrajSqlServerRequests.ts` | **แก้ครบ 3 จุดตามกติกา** (row type + BASE_SQL + `SELECT_COLUMNS`) + mapper · `OUTER APPLY wg2_ppayment_head` เอางวดล่าสุดที่ `is_payment='Y'` แล้ว SUM `wg2_ppayment_detail` |
| `src/types/index.ts` | `resigned_paid_amount` · `resigned_paid_from` · `resigned_paid_to` + แก้คอมเมนต์ของสามฟิลด์เดิมให้บอกว่าเป็น**อัตรา** |
| `src/lib/unitRequestDetail.ts` | `paidPeriodText()` + เปลี่ยนป้ายกลุ่มเป็น "อัตราตามเงื่อนไข (ไม่ใช่ยอดที่ได้รับจริง)" |
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | ป้ายใหม่ 5 ช่อง: อัตรา draw/fee · อัตรามีผลตั้งแต่ · **เงินที่ได้รับจริงงวดล่าสุด** · **ช่วงวันของงวดนั้น** |

🔴 **กติกาที่ฝังไว้:**
* **ป้ายเดิม "เงินที่พนักงานได้ (draw)" ผิด** — ต้องเป็น "อัตราตามเงื่อนไข ฝั่งพนักงาน (draw)"
  ของที่ได้จริงเป็นคนละฟิลด์ · **ห้ามสลับสองชุดนี้**
* 🔴 **งวดล่าสุดมักไม่เต็มเดือน** (ออกกลางเดือน) ⇒ **ต้องโชว์ช่วงวันคู่กันเสมอ**
  ไม่งั้นคนอ่านว่า "เงินเดือนเขาแค่ 6,823" ทั้งที่เป็นแค่ครึ่งงวด
* **เอาเฉพาะงวดที่ `is_payment = 'Y'`** — งวดที่ยังไม่จ่ายห้ามนับ
* ⚠️ **ห้ามใส่ backtick ในคอมเมนต์ที่อยู่ใน SQL ก้อนนั้น** — SQL อยู่ใน template literal
  เผลอใส่ `` `is_payment` `` แล้วสตริงขาดกลางคัน tsc ฟ้อง `',' expected` (เจอจริงรอบนี้)

**ตรวจจริง 25 ส.ค. 2569:** feed คืนค่าใหม่ **232/291 ใบมีเงินที่ได้รับจริง** (มากกว่าที่มีอัตรา
236 นิดหน่อย ⇒ ไม่ได้แลกความครบมาแลกความถูก) · หน้าใบขอ OPL6908098 ขึ้นครบ 5 ช่อง
"อัตรา 13,150 / จ่ายจริง **31,177.13 บาท** / งวด 2026-07-01 ถึง 2026-07-31" ·
**วัดเวลาคิวรี: ไม่มี PAY apply 885/535/625 ms · มี PAY apply 680/718/616 ms = ไม่ช้าลง** ·
test **2,195 ผ่าน / 6 skip** · tsc 4 = 0 · eslint 0 error/18 warning · build ผ่าน

### รอบสี่สิบสี่ · 25 ส.ค. 2569 — **อัตราจ่าย/อัตราเบิกจาก ERP + รายได้จริง 3 เดือนของคนที่ออก**

**เจ้าของสั่ง:** *"ถ้าบน Erp มันจะมี อัตราเบิก อัตราจ่าย เอาพวกนั้นอะมาอยู่ใน ข้อมูลใบขอด้วย
แล้วก็ค่อยบอกว่าไอคนที่ลาออก หรือ เปลี่ยนตัวไปเนี่ย 3 เดือนล่าสุดเขาได้รายได้ประมาณเท่าไหร่"*

🔴 **สิ่งที่ขุดเจอ แล้วต้องแก้ของรอบก่อนด้วย:**
รอบสี่สิบสามติดป้ายว่า draw = "ฝั่งพนักงาน" · fee = "ที่เก็บลูกค้า" — **นั่นเป็นการเดา**
ของจริงคือ **จับคู่ตรง ๆ กับคำของ ERP เอง** (พิสูจน์บนใบ `OPL6908052`):
| ใบขอ (`st_request_p3_rate`) | งวดจ่ายจริง (`wg2_ppayment_detail`) |
|---|---|
| `payment_rate` = **15,565** (อัตราจ่าย) | `fee_amount` = **15,565** |
| `draw_rate` = **19,588** (อัตราเบิก) | `draw_amount` = **19,587.9** |
⇒ **`payment_rate`/`fee_*` = ฝั่งอัตราจ่าย · `draw_rate`/`draw_*` = ฝั่งอัตราเบิก**
⇒ ป้ายบนจอใช้คำ ERP ตรง ๆ ("ฝั่งจ่าย"/"ฝั่งเบิก") **ห้ามตีความว่าฝั่งไหนเป็นของใคร**
(`total_income` ที่ประกาศเป็นรายได้ให้ผู้สมัคร = `payment_rate` = ฝั่งจ่าย)

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/siamrajSqlServerRequests.ts` | **แก้ครบ 3 จุด + mapper** — เปลี่ยน `resigned_paid_*` (งวดเดียว) เป็น `resigned_income_3m_{pay,draw,periods,from,to}` ผ่าน `OUTER APPLY PAY3` · **ใหม่** `getSiamrajSqlServerRequestRateLines()` |
| `api/_handlers/siamraj-unit-requests.ts` | เส้นรายใบแนบ `rate_lines` (เฉพาะหน้ารายละเอียด) |
| `src/types/index.ts` | `UnitRequestRateLine` + `rate_lines?` + ฟิลด์ `resigned_income_3m_*` |
| `src/lib/unitRequestDetail.ts` | **ใหม่** `amountText()` · `summarizeResignedIncome()` · `visibleRateLines()` |
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | ตาราง "อัตราตามใบขอ (ERP)" + กล่อง "รายได้จริงย้อนหลัง" (ทั้งคู่อยู่ในกล่องที่กาง/หุบ) |

🔴 **กติกาที่ฝังไว้:**
* **ใบขอหนึ่งใบมีอัตราหลายบรรทัด** — วัดจริง **4,469 แถว / 294 ใบ = เฉลี่ย 15 บรรทัด**
  (เงินเดือน · ค่าล่วงเวลา 3 เรต · เบี้ยเลี้ยง · ค่าปรับขาดงาน · มาสาย …)
  feed รายการเลือกมาแค่ `rn = 1` ⇒ **ดึงบรรทัดครบเฉพาะหน้ารายละเอียด** ไม่งั้น feed พอง 15 เท่า
* **ตัดแถวที่ทั้งจ่ายและเบิกเป็น 0 ทิ้ง แต่บรรทัดค่าจ้างหลัก (`is_wage`) โชว์เสมอ**
* 🔴 **เฉลี่ยต้องหารด้วยจำนวนงวดจริง ไม่ใช่หาร 3 ตายตัว** — คนเพิ่งเข้างานมีไม่ครบ 3 งวด
  หาร 3 แล้วค่าเฉลี่ยต่ำกว่าจริงเงียบ ๆ · **ต้องบอกจำนวนงวดบนจอด้วย**
* 🔴 **`draw` เป็น 0 อยู่ 72 / 238 ใบ (30%)** — ไม่ใช่ทุกสัญญามีบรรทัดเบิก
  ⇒ **ห้ามใช้ `draw` เป็นตัวหลัก** · `pay` มีครบ 238/238
* **งวดสุดท้ายของคนที่ออกมักไม่เต็มเดือน** ⇒ ใช้คำว่า "ประมาณ" + โชว์ช่วงวัน + จำนวนงวด
* **SQL Server ไม่ยอม SUM ซ้อน SUM** (`Cannot perform an aggregate function on an expression
  containing an aggregate`) ⇒ ต้องซ้อน derived table
* **หน่วยเงินอยู่บนหัวคอลัมน์ ไม่ใช่ต่อท้ายทุกช่อง** — บนมือถือ 375px "19,588 บาท"
  ตัดบรรทัดกลางคัน อ่านยาก (`amountText` ไม่มีหน่วย · `moneyFieldText` มีหน่วย)
* ⚠️ **ห้ามใช้ `min-w-[22rem]`** — ผิดกติกา UI (ห้าม arbitrary value) และแก้ปัญหาไม่ตรงจุด
  ของที่ถูกคือ `table-fixed` + `w-1/2` `w-1/4` `w-1/4` แล้วให้ชื่อรายการตัดบรรทัดเอา

**ตรวจจริง 25 ส.ค. 2569:** `OPL6908052` — ตาราง **14 แถว** หัว "รายการ / อัตราจ่าย (บาท) /
อัตราเบิก (บาท)" · บรรทัดค่าจ้างหลักติดป้าย "(ค่าจ้างหลัก)" 15,565 / 19,588 ·
0 ที่มาจากฐานขึ้น "0" (ไม่ใช่ "—") · กล่องรายได้: **"ประมาณเดือนละ 20,831.18 บาท ·
รวม 62,493.54 บาท จาก 3 งวด · 2026-05-01 ถึง 2026-07-31 · ฝั่งอัตราเบิกรวม 76,757.4 บาท"** ·
ทั้งสองบล็อกซ่อนตอนหุบ · มือถือ 375 **ไม่ต้องเลื่อนแนวนอน** ตัวเลขไม่ตัดบรรทัด ·
เดสก์ท็อป 1440 ตารางกว้าง 1,241px ไม่ล้น ·
test **2,205 ผ่าน / 6 skip** · tsc 4 = 0 · eslint 0 error/18 warning · build ผ่าน · registry 97

### รอบสี่สิบห้า · 25 ส.ค. 2569 — **ย้าย dropdown ราชการ/เอกชน ออกมาใต้ "ผู้รับผิดชอบ"**

**เจ้าของสั่ง:** *"[ช่องราชการ/เอกชน] เอามาไว้ใต้ [กล่องผู้รับผิดชอบ]"*

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | ถอดกล่องราชการ/เอกชนออกจากกริด "ข้อมูลใบขอ" → ทำเป็น `section` ของตัวเอง (ไอคอน `Landmark`) วางถัดจาก `</section>` ของผู้รับผิดชอบ |

🔴 **ทำไมการย้ายนี้สำคัญกว่าที่คิด:** ตั้งแต่รอบสี่สิบเอ็ด กล่อง "ข้อมูลใบขอ" **หุบเป็นค่าตั้งต้น**
⇒ ช่องนี้ถูกซ่อนไปด้วย · คนที่ต้องกรอกอีก **59 หน่วยงาน** ต้องกางกล่องก่อนถึงจะเจอ
ย้ายออกมาแล้ว **เห็นทันทีที่เปิดใบขอ** ไม่ต้องกดอะไรก่อน

**กติกาที่ฝังไว้:**
* ใบขอที่ไม่มีรหัสไซต์ (ใบล่วงหน้า) — `UnitSectorSelect` คืน "—" อยู่แล้ว
  แต่เดิม**ไม่บอกเหตุผล** · เพิ่มบรรทัด *"ใบขอนี้ยังไม่มีรหัสไซต์ จึงระบุประเภทหน่วยงานไม่ได้"*
  (กติกาเดิมของหน้านี้: ไม่มีก็บอกว่าไม่มี ห้ามให้คนเดาว่าพังหรือว่าง)
* บรรทัดกำกับใส่รหัสไซต์ลงไปด้วย — "มีผลกับทุกใบขอของหน่วยงานนี้ (69LBDL0067)"
  คนจะได้รู้ว่ากำลังแก้ของไซต์ไหน ก่อนกด (เลือกทีเดียวกระทบหลายใบ)

**ตรวจจริง 25 ส.ค. 2569:** ลำดับกล่องบนหน้า = ข้อมูลใบขอ → ผู้รับผิดชอบ → **ราชการ / เอกชน**
→ หมายเหตุ → ส่งคนแทน → สถานะทำงาน → ผู้ลาออก/ตำแหน่ง ·
เห็นได้โดย**ไม่ต้องกางกล่องข้อมูลใบขอ** ·
**ยิงเขียนจริงครบวง**: `69LBDL0067` ราชการ → เอกชน (จอ + ฐาน = `private` + toast ขึ้น)
→ **คืนค่าเดิมเป็นราชการแล้ว** (ฐาน = `government`) · ยอดรวมกลับเท่าเดิม **79 ไซต์ · ราชการ 4** ·
ใบล่วงหน้า `LBM6908001` (ไม่มีรหัสไซต์) ขึ้น "—" พร้อมเหตุผล ไม่มี dropdown ·
test **2,205 ผ่าน / 6 skip** · tsc 4 = 0 · eslint 0 error/18 warning · build ผ่าน

### รอบสี่สิบหก · 25 ส.ค. 2569 — **รายได้แยกรายงวด · รวมกล่องคนที่ออก · สามช่องแถวเดียว · ตารางไม่ตกขอบ**

**เจ้าของสั่ง 5 ข้อ:**
1. *"ไม่ได้เอาแบบเฉลี่ย ขอดูแบบย้อนหลัง 3 เดือนเลย"*
2. *"[กล่องผู้ลาออก] มันข้อมูลเหมือนกันอะ รวมกันให้ที จะกลายเป็น ชื่อ นามสกุล สาเหตุที่ลาออก รายได้ย้อนหลัง 3 เดือน"*
3. *"[ราชการ/เอกชน · ส่งคนแทน · สถานะทำงาน] ทำให้อยู่แถวเดียวกันที และทำเป็น Dropdown รูปแบบเดียวกัน ... อยู่สูงกว่าหมายเหตุ"* — ย้ำ *"รวมให้อยู่แถวเดียวกันเพื่อความสวยงาม ไม่ได้รวมข้อมูลกัน"*
4. *"หน้าก่อนจะกดเข้าใบขอ เอาราชการ/เอกชนไปบอกด้วยว่าเป็นอะไร แต่ถ้าจะเลือกต้องมาเลือกข้างใน"*
5. *"ทำให้มันเห็นครบ ๆ เพราะตอนนี้ข้อมูลตกหน้าจอ"*

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/siamrajSqlServerRequests.ts` | `PAY3` คืน **JSON รายงวด** (`FOR JSON PATH`) แทนยอดรวม · `parseIncomeMonths()` · แก้ครบ 3 จุด + mapper |
| `src/types/index.ts` | **ใหม่** `ResignedIncomeMonth` · `resigned_income_3m?: ResignedIncomeMonth[] \| null` (แทนฟิลด์รวม 5 ตัว) |
| `src/lib/unitRequestDetail.ts` | **ใหม่** `resignedIncomeRows()` · `hasDrawSide()` — ถอด `summarizeResignedIncome` (ค่าเฉลี่ย) ทิ้ง |
| `src/components/jobs/UnitRequestReplacementToggle.tsx` | **ใหม่** `UnitRequestReplacementSelect` — dropdown 3 ค่า (ยังไม่ระบุ/ส่ง/ไม่ส่ง) หน้าตาเดียวกับอีกสองช่อง |
| `src/components/jobs/UnitSectorSelect.tsx` | prop `triggerClassName` (ให้กว้างเต็มช่องในกริด) |
| `src/components/jobs/UnitRequestWorkStatusField.tsx` | prop `hideLabel` (กริดเป็นคนวางป้ายให้ ไม่ซ้ำสองชั้น) |
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | กล่อง **"คนที่ออก / เปลี่ยนตัว"** รวมชื่อ+สาเหตุ+อัตราเงื่อนไข+ตารางรายได้รายงวด · สามช่องตั้งค่าเป็นกริด `sm:grid-cols-3` เหนือ "หมายเหตุ" |
| `src/lib/jobListTableSort.ts` | คอลัมน์ `sector` กลับมา (เรียงได้) — คราวนี้อ่านจาก `job.unit_sector` ตรง ๆ **ไม่ต้องมี `TableSortContext`** เพราะ feed แปะมาให้แล้ว |
| `src/pages/jobs/JobListPage.tsx` | คอลัมน์ **ราชการ/เอกชน อ่านอย่างเดียว** + งานลดความกว้างตาราง |

🔴 **กติกาที่ฝังไว้:**
* **ไม่ยุบเป็นค่าเฉลี่ย** — `resignedIncomeRows` คืนรายงวดตรง ๆ · `null` (ไม่รู้) ต่างจากลิสต์ว่าง
* **งวดที่ `pay` เป็น `null` ห้ามแปลงเป็น 0 บาท** · ทุกงวดต้องมีช่วงวันติดไปด้วยเสมอ
* **ฝั่งเบิกเป็น 0 ทุกงวด = ไม่วาดคอลัมน์นั้นเลย** (`hasDrawSide`) — 72/238 ใบเป็นแบบนี้
* 🔴 **dropdown "ส่งคนแทน" ต้องมี "ยังไม่ระบุ" เป็นตัวเลือกจริง** — ปุ่มเดิมล้างค่าด้วยการกดซ้ำ
  ถ้าตัดทิ้ง ใบที่ยังไม่มีใครตัดสินใจจะแยกจาก "ไม่ส่งคนแทน" ไม่ออก · Radix ห้าม value ว่าง
  จึงใช้ค่าแทน `__unset__`
* **หน้ารายการเป็นอ่านอย่างเดียว ห้ามเอา dropdown กลับไป** (เคยอยู่ตรงนั้นแล้วเจ้าของสั่งย้ายออก รอบ 39)
  · "ยังไม่ระบุ" ยังถือเป็นค่าว่าง **ตกท้ายเสมอ** ตอนเรียง

**🔴 วิธีแก้ "ข้อมูลตกหน้าจอ" (วัดจริงทุกขั้น):**
ก่อนแก้ ตารางกว้าง **1,798px ในกล่อง 1,306px = ตกขอบ 492px** และยังต้องเพิ่มอีก 1 คอลัมน์
| ทำอะไร | ผล |
|---|---|
| ถอด `whitespace-nowrap` ออกจาก `<th>` (ให้ป้ายตัดบรรทัด) + `align-bottom` | ป้ายยาวอย่าง "ลักษณะงานย่อย" เลิกดันคอลัมน์กว้าง 158px |
| `px-3` → `px-1.5` ทั้ง `<th>`/`<td>` (45 จุด) | 15 คอลัมน์ × 12px = ~180px |
| ปุ่มเรียงในหัว `gap-1 px-1` → `gap-0.5` ไม่มี px | ~90px |
| ถอด `min-w-[180px]` ของคอลัมน์หมายเหตุ | ปล่อยให้ auto |
⇒ **1,798 → 1,306px พอดีกล่อง · overflow = 0** ทั้งที่**เพิ่มคอลัมน์ที่ 15 เข้าไปแล้ว**

**ตรวจจริง 25 ส.ค. 2569:** หน้ารายการ **หัว 15 / เซลล์ 15** · `overflowPx = 0` ที่ 1440px ·
ไม่มีเซลล์ไหนถูกตัด · ค่าในคอลัมน์ใหม่ตรงกับฐาน (หน้านี้ ราชการ 2 · เอกชน 16 · ยังไม่ระบุ 2) ·
หน้าใบขอ: สามช่อง **top ตรงกันทั้งสาม = แถวเดียว** (414px × 3) วางเหนือหมายเหตุ ·
มือถือ 375 ซ้อนลง 3 แถว ไม่มีของล้นขอบ ·
กล่อง "คนที่ออก / เปลี่ยนตัว" มีครบ: ชื่อ-นามสกุล · สาเหตุ · อัตราเงื่อนไขสองฝั่ง ·
**ตารางรายได้ 3 งวดแยกรายเดือน** (ก.ค. 20,345.32 / มิ.ย. 21,220.84 / พ.ค.) ·
**ยิงเขียนจริงครบวง**: ส่งคนแทน `null` → `true` (ฐานเปลี่ยนจริง) → **คืนเป็น `null` แล้ว** ·
test **2,207 ผ่าน / 6 skip** · tsc 4 = 0 · eslint 0 error/18 warning · build ผ่าน

### รอบสี่สิบเจ็ด · 25 ส.ค. 2569 — **ยุบกล่อง "คนที่ออก" เข้าไปในกล่อง "ข้อมูลใบขอ"**

**เจ้าของสั่ง:** *"[กล่องคนที่ออก/เปลี่ยนตัว] มันต้องไปอยู่รวมกับ [ข้อมูลใบขอ]"*

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | ย้ายทั้งก้อนจาก `<section>` แยก → เป็นบล็อกย่อยในกล่อง "ข้อมูลใบขอ" (อยู่ใต้ตารางอัตรา ERP) · ถอด "เบอร์ติดต่อหน่วยงาน" ทิ้งเพราะซ้ำกับ "เบอร์ติดต่อ" ในกริดเดียวกัน |

**ผลลัพธ์:** กล่อง "ข้อมูลใบขอ" (หุบเป็นค่าตั้งต้น) มี 3 ชั้นในตัวเอง
1. กริดข้อมูลใบขอ 22 ช่อง · 2. ตาราง **อัตราตามใบขอ (ERP)** · 3. บล็อก **คนที่ออก / เปลี่ยนตัว**
(ชื่อ-นามสกุล · สาเหตุ · รุ่นรถ · อัตราเงื่อนไขสองฝั่ง · **ตารางรายได้จริง 3 งวดแยกรายเดือน**)

**ลำดับกล่องบนหน้าตอนนี้:** ข้อมูลใบขอ → ผู้รับผิดชอบ → [ราชการ/เอกชน · ส่งคนแทน · สถานะทำงาน]
→ หมายเหตุ

🔴 **กับดักที่เจอตอนย้าย (จำไว้ — เสียเวลาสองรอบ):**
1. **คอมเมนต์ JSX ห้ามอยู่หลัง `cond ? (` ทันที** — `{infoOpen ? (` แล้วขึ้นบรรทัดใหม่เป็น
   `{/* ... */}` ทำให้ TS ฟ้อง `')' expected` งง ๆ · ต้องวางคอมเมนต์**ก่อน**บรรทัดเงื่อนไข
2. 🔴 **ห้ามใช้สคริปต์ไล่เยื้องบรรทัดด้วยการหาโทเคนปิด** — สคริปต์จับ `) : null}` ตัวแรกที่เจอ
   ซึ่งเป็นของ `<th>` ข้างในตาราง แล้ว**เขียนทับ `<th>` หายไปทั้งบรรทัด** · tsc จับได้ก็จริง
   แต่เสียเวลาไล่ · **จัดเยื้องด้วยมือทีละจุด หรือปล่อยไว้** (กติกาเดิมข้อ 3 ของ system-builder
   ที่ห้ามแก้หลายจุดด้วย regex — ใช้กับการจัดเยื้องด้วย)
3. **prettier ไม่ใช่ด่านของโปรเจกต์นี้** — `src/pages/jobs/` ตกทั้ง 7 ไฟล์อยู่แล้ว และ
   `package.json` ไม่มี script prettier · **อย่าเผลอรัน `prettier --write`** จะได้ diff ทั้งไฟล์

**ตรวจจริง 25 ส.ค. 2569:** `OPL6808001` — หุบอยู่ **ไม่เห็นบล็อกคนที่ออก** · กางแล้วมีครบ
(2 ตาราง: อัตรา ERP + รายได้ 3 งวด) · **"เบอร์ติดต่อ" เหลือช่องเดียวในกล่อง** (เดิมซ้ำสอง) ·
รายได้แยกรายเดือนจริง (ก.ค. 24,456 / มิ.ย. 16,804 / พ.ค. 16,804) ·
มือถือ 375 ไม่มีของล้นขอบ ตารางไม่ต้องเลื่อนแนวนอน ·
test **2,207 ผ่าน / 6 skip** · tsc 4 = 0 · eslint 0 error/18 warning · build ผ่าน

### รอบสี่สิบแปด · 25 ส.ค. 2569 — 🔴 **"งานหายเงียบ" — จอบอกว่ารอ AI โทร ทั้งที่ไม่เคยส่ง**

**ที่มา:** เจ้าของถามว่าทางเข้าคิว AI ทั้ง 3 ทางยังทำงานไหม → ไล่ฐานแล้วเจอว่ารายการติดตาม
`a4f1affe` (24 ส.ค. 16:01) **ไม่มีแถวในคิวเลย** แต่หน้าจอขึ้นว่า "รอ AI โทร" มา 5 วัน

🔴 **ต้นเหตุจริง (คนละตัวกับที่เดาไว้ตอนแรก):**
```ts
call_status: r.cancelled_at != null ? 'cancelled' : (r.call_status ?? 'pending'),
```
`call_status` มาจาก **LEFT JOIN** กับคิว ⇒ `null` แปลว่า **ไม่เคยเข้าคิว**
แต่ `?? 'pending'` **แปลงเป็น "รอ AI โทร"** ⇒ จอไม่ได้แค่เงียบ **มันบอกผิด**
คนเลยไม่มีทางรู้ว่างานไม่ได้ถูกส่ง · ตัวนับหัวหน้าก็เกินจริงตามไปด้วย

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/109_follow_dispatch_state.sql` | **ใหม่** — `follow_entries.dispatch_state` จดผลตอนพยายามส่ง (null = แถวเก่า ไม่รู้) · **ไม่ใส่ CHECK ตั้งใจ** (กับดักเดิม: CHECK ลืมแก้คู่โค้ดแล้ว 500 เงียบ) |
| `src/lib/followDispatchState.ts` | **ใหม่ · pure** — 6 สถานะ + คำไทย + `needsAction`/`retryable` · `followDispatchLabel()` · `summarizeDispatchResults()` |
| `api/_lib/lumosDispatch.ts` | 🔴 แยกถัง **`guarded`** ออกจาก `held` · `enqueueFollowReminder` คืนผลแทน `void` · `duplicated` ตัดด้วย `skippedSet` (เดิมตัดแค่ held/declined ⇒ คนถูกพักเบอร์ถูกนับเป็น "เคยส่งแล้ว") |
| `api/_handlers/follow.ts` | 🔴 เลิกเดา `'pending'` · จด `dispatch_state` ตอนสร้าง · ส่งกลับใน response |
| `src/lib/followApi.ts` | `call_status` เป็น `\| null` ตามความจริง (เดิมประกาศ non-null ทั้งที่ SQL คืน null ได้) |
| `src/components/follow/FollowDispatchBadge.tsx` | **ใหม่** — ป้ายเตือนเฉพาะตอน "ไม่ได้ส่ง" (ปกติไม่โผล่ กันจอรก) |
| `src/pages/follow/FollowPage.tsx` · `FollowMonthGrid.tsx` | กัน `call_status` null + ป้ายใหม่ + ตัวนับ "ไม่ได้ส่งให้ AI" บนหัว + เตือนตอนกดสร้าง |

🔴 **กติกาที่ฝังไว้:**
* **LEFT JOIN คืน null = "ไม่มี" ห้าม `?? ค่าปกติ`** — การเติมค่าเริ่มต้นให้ null ของ join
  ทำให้จอ**โกหก**แทนที่จะเงียบ ซึ่งแย่กว่า (ตามหา 5 วันกว่าจะเจอ)
* **"ตรวจไม่ได้" (`guarded`) ≠ "ติดเงื่อนไข" (`held`/`suppressed`)** — อันแรกกดส่งใหม่ได้
  อันหลังต้องรอคนปล่อย/แก้ข้อมูล · เดิมยัดรวมเป็น `held` แล้วรายงานโกหกว่า "เจ้าหน้าที่รับไปโทรเอง"
* **ผลของการ enqueue ต้องเดินทางถึงคนกด** ห้าม log ทิ้งอย่างเดียว
* ป้าย "ไม่ได้ส่ง" **โผล่เฉพาะเมื่อมีของค้างจริง** · ตัวนับบนหัวโชว์เฉพาะเมื่อ > 0

**ตรวจจริง 25 ส.ค. 2569:** ฐานยืนยัน `a4f1affe` ไม่มีแถวคิว (queue_id null) ·
API เดิมคืน `call_status: "pending"` → **แก้แล้วคืน `null`** ·
หน้า Follow ขึ้นหัว **"ทั้งหมด 5 · รอโทร 0 · สำเร็จ 1 · ไม่ได้ส่งให้ AI 1"** (เดิมนับ "รอโทร" เกินจริง) ·
แถว 24 ส.ค. มีป้าย **"ไม่ได้ส่งให้ AI โทร"** พร้อมคำอธิบายใน tooltip ·
คำว่า "รอ AI โทร" หายไปจากแถวที่ไม่ได้อยู่ในคิวแล้ว (นับได้ 0 จุด) ·
migration 109 **รันบนฐานจริงแล้ว** · test **2,222 ผ่าน / 6 skip (212 ไฟล์)** · tsc 4 = 0 ·
eslint 0 error/18 warning · registry 97 · build ผ่าน

⚠️ **ที่ยังไม่ได้ทดสอบ (ตั้งใจ):** ไม่ได้กดสร้างรายการติดตามจริงเพื่อทดสอบ `dispatch_state`
เพราะการสร้าง = **เข้าคิวโทรหาคนจริง** (กติกาโปรเจกต์: ห้ามรันทดสอบที่ยิงถึงคนจริง)
เส้นนั้นผ่าน tsc + เทสต์ pure logic แล้ว แต่ **ยังไม่มีการยืนยันด้วยการเขียนจริง**

### รอบห้าสิบ · 26 ส.ค. 2569 — **หน้า Follow ดันตรงไปหา Lumos (push mode) ตอนสร้าง + แจ้งยกเลิกฝั่งเขา**

**เจ้าของสั่ง:** *"หน้า Follow ให้มันไปเส้น Reminders เหมือนกัน ทำไงก็ได้ให้กรอกจากระบบเรา
แล้วไปขึ้นเขาเลย"* — เดิมเส้น Follow เป็น pull ล้วน (เข้าคิวรอ Lumos มา poll)
เลนอื่นมี autoPush อยู่แล้ว 3 จุด (application/board/irecruit) แต่ Follow ไม่มี

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/lumosDispatch.ts` | `enqueueFollowReminder` — หลังเข้าคิวสำเร็จ (`added > 0`) เรียก `pushFollowReminderToLumos()` (best-effort) · **ใหม่** `buildFollowPushRecord()` (pure — bump เวลาก่อน push) · `cancelFollowReminder` ยิง `cancelPushedReminder()` คู่กันเมื่อมี push config · หมายเหตุช่องโหว่ push mode บน `refreshFollowReminderPayload` |
| `tests/api/lumosPushClient.test.ts` | **ใหม่** — เทสต์ config/bump/รูป request ด้วย fetch จำลองทั้งหมด (8 เคส) |

🔴 **กติกาที่ฝังไว้:**
* **push ต้อง bump เวลาเองก่อนส่ง** — เส้น poll มี `bumpScheduledAtForward` ที่จุดเสิร์ฟ
  แต่ push ไม่ผ่านจุดเสิร์ฟ · เวลาใน Follow คนเลือกเอง อาจเป็นอดีต (บ่ายสองตั้งให้โทร 09:00)
  ส่งดิบ ๆ Lumos **ปัดทิ้งตอน ingest แบบเงียบ ๆ** (บทเรียน 18 ส.ค. 2569)
* **Idempotency-Key = `follow-<id>`** — หนึ่งรายการส่งครั้งเดียว กันยิงซ้ำกลายเป็นสายที่สอง
* **push ล้ม = log แล้วไปต่อ** — แถวยังอยู่ในคิว pull เป็นทางถอยเสมอ · ไม่ตั้ง env = ข้ามเงียบ
  (`getLumosPushConfig()` คืน null — local ไม่ได้ตั้ง มีแต่ .env บน server)
* **ยกเลิกฝั่งเราต้องแจ้งฝั่ง Lumos ด้วย** — record ไปอยู่ระบบเขาตั้งแต่สร้าง
  ยกเลิกแค่คิวเรา = AI ยังโทรหาคนจริงเรื่องงานที่ยกเลิกแล้ว · ยิงแม้คิวเราไม่มีแถว pending
* ⚠️ **ช่องโหว่ที่รู้แล้วตั้งใจยังไม่ปิด: แก้ไขรายการ (`refreshFollowReminderPayload`)
  ไม่ re-push** — ไม่รู้ว่า Lumos เจอ `client_contact_id` ซ้ำแล้วทับหรือสร้างซ้ำ
  (สร้างซ้ำ = โทรสองสาย แย่กว่าบทพูดเก่า) · รอยืนยันจากทีม Lumos ก่อน wire

**บริบทที่วัดจริงก่อนลงมือ (26 ส.ค. 2569):** โหมด `follow_entry` = **auto อยู่แล้ว**
(ตั้งแต่ 18 ส.ค.) · คิว follow มีแค่ 4 แถวประวัติ (completed 2 · cancelled 1 · delivered 1) ·
env push (`LUMOS_BASE_URL/CONNECTION_ID/PUSH_API_KEY`) **local ไม่ได้ตั้ง** — โค้ด push
จึงเงียบบนเครื่อง dev · บน server ใส่ใน .env ตรง ๆ · ⚠️ **push บน prod ยังติด 401**
(ของค้างเดิมที่ Wutthipong ไล่อยู่ — สคริปต์ `scripts/test-lumos-push-interviews.mts`)
⇒ จนกว่า key จะถูกแก้ push จะล้มแบบ log ไว้ แล้วถอยไป pull เหมือนเดิมโดยอัตโนมัติ

**ตรวจจริง 26 ส.ค. 2569:** เทสต์ใหม่ 8 เคสยืนยันรูป request (URL/Bearer/Idempotency-Key/
body array) + bump (อดีต → now+10 เวลาไทย · อนาคตคงเดิม · ไม่แก้ต้นฉบับ) ด้วย fetch จำลอง ·
⚠️ **ไม่ได้ยิง Lumos จริง + ไม่ได้กดสร้างรายการจริง (ตั้งใจ)** — สร้างจริง = โทรหาคนจริง
และ push จริงต้องรอ key หาย 401 · test เต็มชุดผ่าน · tsc 4 = 0 · eslint 0 error/18 warning

### รอบห้าสิบเอ็ด · 26 ส.ค. 2569 — 🔴 **ลงมือแปลงต้นแบบเป็นของจริง: เมนูสายพาน 6 ขั้น**

**เจ้าของสั่ง:** ชี้ที่ต้นแบบ *"ตอนนี้ได้แบบนี้ไหมสำหรับที่เราจะทำกัน โดยยังไม่ Commit&Push"*
+ เคาะขอบเขต **"จัดเต็มทั้ง 13 หน้า"**
🔴 **ทั้งรอบนี้อยู่ใน working tree เท่านั้น ห้าม commit/push จนกว่าเจ้าของจะเคาะ**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/soRecruitNav.ts` | **ใหม่ · pure** — โครงสายพาน 6 ขั้น + คลังข้อมูล 3 · `stepForPath()` · `isStepActive()` · `conveyorBadge()` |
| `src/lib/nextTask.ts` | **ใหม่ · pure** — คิว "งานถัดไปของคุณ" เรียงตามความเสียหาย 7 ถัง |
| `src/hooks/useConveyorCounts.ts` | **ใหม่** — ตัวนับท้ายเมนู · cache ระดับโมดูล TTL 60 วิ (เมนูอยู่ทุกหน้า ยิงซ้ำทุกคลิกไม่ได้) |
| `src/components/layout/ConveyorSidebar.tsx` | **ใหม่** — แถบเมนูติดซ้าย (lg+) · **ยุบเป็นราง 63px ได้** จำค่าใน localStorage |
| `src/components/layout/StageBanner.tsx` | **ใหม่** — แถบ "ขั้นที่ N/6 · ขั้นนี้ทำอะไร · ต่อไปคือ" วางอัตโนมัติจาก path |
| `src/components/home/NextTaskPanel.tsx` | **ใหม่** — การ์ด hero งานถัดไป + คิวที่เหลือ |
| `src/components/layout/AppLayout.tsx` | ครอบ sidebar + banner รอบ `<main>` · `lg:px-8` → `px-6` |
| `src/components/layout/AppNavDrawer.tsx` | drawer มือถือใช้โครงสายพานชุดเดียวกัน (ถอดกลุ่ม "บอร์ดรับสมัคร" ที่กดกาง) |
| `src/pages/HomePage.tsx` | เสียบ `NextTaskPanel` เหนือแถบ KPI + `buildNextTasks` จากข้อมูลที่โหลดอยู่แล้ว |
| `src/index.css` | ฟอนต์ **Anuphan → Kanit** (ตัวเดียวกับต้นแบบ · `tailwind.config` ประกาศ Kanit ไว้ตั้งแต่ต้นแต่ไม่เคยโหลดจริง) |

🔴 **กติกาที่ฝังไว้:**
* **ไม่สร้าง route ใหม่สักเส้น** — ขั้น 2/3 ใช้ `?view=` ของบอร์ดรับสมัครที่มีอยู่แล้ว
  (เพิ่ม route = ต้องตามแก้ rbac/registry อีกหลายที่ ซึ่งไม่ใช่เรื่องของการจัดเมนู)
* 🔴 **ขั้น 2 กับ 3 อยู่ path เดียวกัน ต่างที่ `?view=`** ⇒ `stepScore()` ต้องอ่าน query
  ไม่งั้นเมนูสว่างพร้อมกันสองอัน · **ไม่มี `?view=` = กล่องงาน = ขั้น 3**
* **เจาะจงชนะกว้าง** — ให้คะแนนตามความยาว prefix ไม่ใช่ลำดับในลิสต์
  (`/jobs/siamraj/x` ต้องได้ขั้น 1 ไม่ใช่ขั้น 3 · เพิ่มขั้นใหม่แล้วผลต้องไม่เปลี่ยน)
* **ตัวนับ: `null` = ยังไม่รู้ ⇒ ไม่วาดป้ายเลย · 0 ที่รู้จริง ⇒ วาด 0** (กติกาเดิมทั้งระบบ)
* **คิวงานเรียงตามความเสียหาย ไม่ใช่จำนวน** — "หลุด SLA 202 ใบ" เป็นยอดสะสมที่แก้วันนี้ไม่จบ
  ส่วน "เลยนัดโทร 1 ราย" คือคนจริงที่รอสายอยู่ตอนนี้ ⇒ **ของที่มีคนรอปลายทางมาก่อนเสมอ**
* **NextTaskPanel ไม่ยิง API ใหม่** — ประกอบจาก flow-summary + office-floor ที่หน้าแรกโหลดอยู่แล้ว

🔴 **กับดักที่เจอตอนทำ (จำไว้):**
1. 🔴 **แถบเมนูกินที่ = ตารางที่จูนไว้พอดีจอเมื่อรอบสี่สิบหก ตกขอบทันที**
   วัดจริง: ตาราง "ใบขอ" ล้นกล่อง **233px** บนจอ 1440 · แก้ด้วย **ปุ่มยุบแถบ**
   (270 → 63px) + `main` ลด `lg:px-8` → `px-6` ⇒ เหลือล้น **8px**
   ⇒ **บทเรียน: เพิ่มของถาวรในโครงหน้า ต้องวัดหน้าที่กว้างสุดก่อนเสมอ**
2. **`html { font-size: 112.5% }` ⇒ `w-60` = 270px ไม่ใช่ 240px** — คำนวณพื้นที่คืน
   ต้องคูณ 1.125 ทุกครั้ง (คลาส Tailwind ที่เป็น rem โตตามหมด)
3. **HMR ไม่พอสำหรับคลาสความกว้างที่เพิ่งเกิด** — วัดได้ `w-14` ใน DOM แต่ computed
   ยังเป็น 270px จนกว่าจะ **reload เต็ม** · อย่าสรุปว่าโค้ดผิดจากการวัดหลัง HMR อย่างเดียว
4. **`history.pushState` + `PopStateEvent` ไล่วัดหลายหน้ารวดเดียวเชื่อไม่ได้** —
   3 หน้าแรกรายงานค่าของหน้าก่อนหน้า · ต้อง `location.href` ทีละหน้าแล้ววัด
5. **วัดตอน viewport กำลังเปลี่ยนขนาด ได้ `innerWidth: 0`** แล้วตัวเลข overflow มั่วหมด
   — resize เสร็จต้อง reload ก่อนวัดเสมอ

⚠️ **ผลข้างเคียงที่รู้แล้ว รอเจ้าของเคาะ:** เมนูที่แอดมินจัดเองได้ (`navPreferences` · หน้าตั้งค่า)
ตอนนี้ **ใช้ได้แค่ "ซ่อน"** — ลำดับกับชื่อไม่รับแล้ว เพราะเลข "ขั้นที่ N" ผูกกับหัวทุกหน้า
สลับลำดับได้เมื่อไหร่เลขขั้นจะโกหกทันที

**ตรวจจริง 26 ส.ค. 2569 (วัดจาก DOM ทุกข้อ):** เมนู 10 รายการครบ ตัวเลขจริงจากฐาน
(ใบขอ 295 · จับคู่ 175 · ติดตาม 1 · ดูแล 0) · ไล่ทีละหน้า **ขั้นถูกทุกหน้า**
(ใบขอ→1 · postings→2 · board/list→3 · match→4 · follow→5 · aftercare→6 ·
คลังคน/WL/Dashboard = ไม่มีเลขขั้น ถูกต้อง) · หน้าแรกขึ้น "โทรติดตามที่เลยเวลานัดแล้ว 1 ราย"
+ คิวอีก 3 · Kanit โหลดจริง (`document.fonts.check` = true) ·
**ไม่มีของล้นขอบทุกหน้า** ทั้ง 1440 · 1280 · มือถือ 375 (`scrollWidth` = 375 เป๊ะ) ·
light/dark อ่านออกทั้งคู่ · drawer มือถือขึ้นโครงสายพานเดียวกัน

### รอบห้าสิบสอง · 26 ส.ค. 2569 — **หน้าแรกโล่งตามต้นแบบ + ฉาก JARVIS Core วาดด้วยโค้ดทั้งดวง**

**เจ้าของทักสองรอบ:** (1) *"ของ session ก่อนหน้ามันสะอาดตากว่านี้"* — เทียบจอจริงพบว่า
การ์ดงานถัดไปถูก**วางทับ**หน้าเดิม (KPI 9 ใบ + BU + ฉาก + funnel ยังอยู่ครบข้างล่าง)
= เพิ่มของ ไม่ใช่จัดให้โล่ง · (2) *"ฉากหน้าหลักเหมือนแค่เอารูปมาวางไว้เฉย ๆ —
ออกแบบใหม่ให้ดูมิติกว่านี้ได้ไหม"* + ส่งตัวอย่าง https://cayla-flax.vercel.app/
(HUD วาดด้วยโค้ดล้วน: วงแหวนหมุน เส้นบาง เลขเดินสด)
**เจ้าของเคาะผ่าน Choice: "เหลืองานถัดไป+คิว ที่เหลือซ่อน"** · 🔴 ยังห้าม commit/push

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/HomePage.tsx` | ทุกอย่างใต้คิว (KPI · BU · ฉากภาพ · funnel) **หุบเป็นค่าตั้งต้น** หลังปุ่ม "ดูภาพรวมทั้งหมด" — ไม่ได้ลบสักชิ้น · ทักทายเป็นหัวใหญ่ + วันที่ไทย (`Intl` ระดับโมดูล) · เสียบ `JarvisCoreScene` ใต้คิว |
| `src/lib/jarvisCoreScene.ts` | **ใหม่ · pure** — ผัง node ตัว U (`SCENE_NODE_SPOTS` หน่วย % แพตเทิร์น ROOM_SPOTS) · `buildSceneNodes()` · `coreStatusLine()` |
| `src/components/home/JarvisCoreScene.tsx` | **ใหม่** — ฉาก SVG ทั้งดวง: วงแหวน 4 ชั้นหมุนคนละทิศ + แสงเรือง radial + hexagon + crosshair + เส้น hub-spoke มีประจุวิ่ง + นาฬิกาเดินวินาที (`useNowTick`) + 6 node กดได้เลขจริง · < md ตกเป็นกริด 2 คอลัมน์ |
| `src/components/home/NextTaskPanel.tsx` | เสาขวา "งานนี้อยู่ขั้นไหน" (ติ๊กขั้นที่ผ่าน · วงเรืองขั้นปัจจุบัน) · แถวคิวโปร่งขึ้น (วงกลมสี 36px) · **loading = skeleton ห้ามคืน null** (หน้าโล่งอ่านเหมือนระบบพัง) |
| `src/lib/nextTask.ts` | เพิ่ม `badge` (ป้ายสั้นบนหัวการ์ด เช่น "เลยเวลานัดแล้ว") |
| `src/components/layout/StageBanner.tsx` | เลิกเป็นกล่อง — เป็นบรรทัดป้ายเปล่า (กล่องซ้อนกล่องคือต้นเหตุความรก) |
| `src/index.css` | ชุดแอนิเมชัน `jarvis-core-*` (spin 3 ความเร็ว · breathe · flow · ping) — ปิดครบใน `prefers-reduced-motion` |

🔴 **กติกาที่ฝังไว้:**
* **ฉากนี้ไม่ใช่ของที่เคยถูกตีตก** — ที่ตีตกคือ "การ์ตูน SVG วาดเองทับฉาก render"
  (ของวาดปนของ gen) · อันนี้เรขาคณิต HUD ทั้งดวง ภาษาเดียวกับ token `HUD` ที่เคาะแล้ว
* **ภาพ render เดิม (`OfficeRooms`) ไม่ได้ลบ** — อยู่ใน "ภาพรวมทั้งหมด" เป็นทางถอย
* เลขบน node มาจาก `useConveyorCounts` (cache เดียวกับเมนู) — **ไม่ยิงเส้นเพิ่ม**
* ยังไม่รู้ค่า = node เขียน "—" · จุดแดงกะพริบเฉพาะถังต้องลงมือที่ "รู้ค่าและมีของ"

🔴 **กับดักที่เจอ (จำไว้):**
1. 🔴 **class `absolute` แพ้ `.jarvis-hud-inner`** — custom class ใน `@layer utilities`
   ของ index.css ประกาศ**หลัง** utilities ของ Tailwind ⇒ `@apply relative` ข้างในชนะ
   `absolute` ที่จุดเรียกใช้แบบเงียบ ๆ (ฉากสูง 1,041px แทน 480px เพราะ node ไหลลงล่าง)
   👉 **ตัวจัดตำแหน่งต้องเป็น div แยกชั้น ห้ามใส่ position utility ปนกับ jarvis-hud-inner**
2. **จอ preview capture เพี้ยนหลัง scrollIntoView/resize** — DOM วัดได้ถูกแต่ภาพค้าง
   เฟรมเก่า · ต้อง reload + รอ 1–2 วิ ก่อนถ่าย · **อย่าสรุปว่าโค้ดพังจากภาพอย่างเดียว
   ให้เชื่อ getBoundingClientRect ก่อน**

**ตรวจจริง 26 ส.ค. 2569:** หน้าแรกเหลือ ทักทาย → งานถัดไป → คิว → ฉาก JARVIS Core →
ปุ่มภาพรวม (ตรงโครงต้นแบบ) · ฉากสูง 518px · node 6 ตัวตำแหน่งตัว U ถูก เลขจริงจากฐาน
(295/1/1/175/1/0) · นาฬิกาเดินวินาทีจริง · มือถือ 375: SVG ซ่อน กริด 6 ใบครบ overflow 0 ·
สถานะกลางแกนขึ้น "เลยนัดโทร 1 ราย — มีคนรอสายอยู่" (ถูกตามลำดับความด่วน)

### รอบห้าสิบสาม · 26 ส.ค. 2569 — 🔴 **รอบห้าสิบสองถูกตีตกทั้งดวง → Command Deck ผืนเดียว**

**เจ้าของตีตกแรง:** *"คำเดียวเลยนะ รก ไม่สวยด้วย … ใช้รูปเดิมแค่เพิ่มกล่อง …
ฉันต้องการหน้านี้แบบเปิดมาว้าว สวย ล้ำ ตัวอย่างก็มีให้ดู แค่ทำให้ดีกว่าทำไม่ได้หรอ"*

🔴 **วินิจฉัยว่าทำไมรอบก่อนพัง (จำให้ขึ้นใจ):** เอา "การ์ดมืดใบเล็กหลายใบ" ไปแปะบน
หน้าขาว = รก · ตัวอย่าง cayla สวยเพราะ**ทั้งจอเป็นผืนเดียว** — ink ทั้งหน้า ·
โฟกัสเดียว (หน้าปัดใหญ่) · ป้าย mono เล็กตัวพิมพ์ห่าง · ที่ว่างเยอะ ·
คั่น section ด้วยเส้น 1px **ไม่ใช่กล่องซ้อนกล่อง**

**ลบทิ้งให้สุด (ของรอบ 51–52 ที่ถูกตีตก):** `NextTaskPanel.tsx` · `JarvisCoreScene.tsx` ·
`jarvisCoreScene.ts` + เทสต์ — แทนด้วย:

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/home/CommandDeck.tsx` | **ใหม่** — ทั้งหน้าเป็น canvas เดียว: แถบหัว (SO RECRUIT · สถานะสด · นาฬิกาเดินวินาที) → hero (หน้าปัดวงแหวน 3 ชั้นหมุน + ขีดสเกล 72 ขีด + hexagon · ใจกลาง = เลข "ต้องลงมือ N เรื่อง") \| งานถัดไป (หัวใหญ่ + ปุ่ม gradient + เส้นความคืบ 6 ขั้น) → คิว (แถวบาง index mono 01/02) → แถบ tile 6 ขั้น |
| `src/lib/homeDeck.ts` | **ใหม่ · pure** — `buildStageTiles()` · `deckStatusLine()` (+ เทสต์ 6 เคส) |
| `src/index.css` | `.jarvis-deck` — พื้น ink + กริดจุดพิกัด (ที่เดียวตามแพตเทิร์น HUD) |
| `src/pages/HomePage.tsx` | เหลือ `<CommandDeck>` + ปุ่มภาพรวม · ตัดหัวทักทายแยก (deck รวมให้แล้ว) |

**กติกาความสวยที่สกัดจากรอบนี้ (ใช้กับหน้าอื่นต่อ):** ผืนเดียว · โฟกัสเดียว ·
ป้ายทุกป้าย = `font-mono text-[10px] tracking-[0.22em] uppercase` · เลขทุกตัว tabular ·
สองสีหลัก (teal/sky) แดงเฉพาะด่วนจริง · ปุ่มใช้ `Button asChild` (ห้าม Link แต่งเป็นปุ่มเอง)

**ตรวจจริง 26 ส.ค. 2569:** หน้าปัดขึ้น "ต้องลงมือ 4 เรื่อง" ตรงกับคิวจริง · นาฬิกาเดิน ·
tile 6 ใบเลขจริง (295/1/1/175/1/0) จุดแดงเฉพาะผู้สมัคร/ติดตาม · มือถือ 375 overflow 0
หน้าปัด 324px ไม่ล้น · ภาพรวมหุบเป็นค่าตั้งต้น (state ค้างจาก HMR เคยหลอกว่าเปิด —
reload สดยืนยัน false) · test **2,258 ผ่าน / 6 skip** · tsc 4 = 0 · eslint 0/18 · ยังไม่ commit

### รอบห้าสิบสี่ · 26 ส.ค. 2569 — **ห้องปฏิบัติการเลิกใช้ภาพ render → ผัง 2×2 วาดด้วยโค้ด**

**เจ้าของเคาะ:** deck ใหม่ *"ด้านบนโอเคและสวยนะ"* แล้วชี้ที่ฉากภาพ
(`/office/office-rooms.jpg`): *"แต่ตรงนี้มันแก้ไม่ได้หรือยังไง"* ⇒ รื้อฉากภาพเป็น
ผังวาดด้วยโค้ดภาษาเดียวกับ deck · 🔴 ยังห้าม commit/push

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/home/OpsRoomsPanel.tsx` | **ใหม่** — ผัง 2×2 บน canvas ink (คลาส `jarvis-deck` เดิม): 4 ห้องคั่นเส้นบางอ่านเป็น floor plan · เหรียญ JARVIS CORE วงแหวนหมุนทับสี่แยกกลาง (กด → /dashboard) · แถว stat กดได้ · ห้องมีของค้าง = ป้ายสถานะแดง + จุด ping · < sm ซ้อนแถวเดียว เหรียญซ่อน |
| `src/components/home/OfficeRooms.tsx` · `OfficeFloor.tsx` | **ลบทิ้ง** (ฉากภาพ + ตัววาดเก่า — OfficeFloor มีผู้ใช้เดียวคือ OfficeRooms) |
| `src/lib/officeRooms.ts` | ถอด `ROOM_SPOTS` (พิกัด % บนภาพ — ไม่มีภาพให้วางแล้ว) · **`buildRooms`/นิยามห้อง 4 ห้องคงเดิมทุกตัว** (กติกา "ห้ามคิดเลขใหม่" ยังคุม) |
| `tests/api/officeRooms.test.ts` | ตัด assert พิกัดภาพ · ที่เหลือคงเดิม |
| `src/pages/HomePage.tsx` | สลับ `OfficeRooms` → `OpsRoomsPanel` (props เดิมเป๊ะ) |

⚠️ **ไฟล์ภาพ `public/office/office-rooms.jpg` ไม่ได้ลบ** — ของที่เจ้าของ gen เอง
โค้ดแค่เลิกอ้างถึง · ความหมายห้อง/โต๊ะ (ROOM_DESKS · ROOM_LABEL · ROOM_TONE) ไม่แตะ

**ตรวจจริง 26 ส.ค. 2569:** ผัง 4 ห้องขึ้นครบ เลขจริงจากฐาน (คัดสรร 175 · Follow 1 ·
AI Call มีแถวเตือน) · เหรียญกลางหมุน · มือถือ 375 overflow 0 แถว stat กดได้ 15 จุด
เหรียญซ่อนตามตั้งใจ · test เต็มชุดผ่าน · tsc 4 = 0 · eslint 0/18
⚠️ **รอบนี้อายุสั้น — ถูกแทนด้วยบอร์ดทีมแผนก (รอบห้าสิบห้า) ในวันเดียวกัน**

### รอบห้าสิบห้า · 26 ส.ค. 2569 — 🔴 **บอร์ด "ทีม SOP รายแผนก" (คนจริง+ชื่อจริง) + ยุบหน้าแรก**

**เจ้าของส่งคลิป** (Reel ทีม Agent ของช่อง content — บอร์ดโซนแผนก + คนนั่งโต๊ะมีชื่อ +
แถบ "ใครทำอะไรอยู่") **แล้วสั่ง:** *"สิ่งที่ฉันต้องการจากคลิปนี้คือ ทีม SOP แต่ละแผนก
เอามาทำแทน office-rooms.jpg แล้วอันไหนข้อมูลเดียวกันก็ยุบ ๆ รวม ๆ ไป มันจะได้ไม่เยอะ
หมดนี่สำหรับหน้าหลักนะ"* · 🔴 ยังห้าม commit/push

**วัดฐานก่อนลงมือ (26 ส.ค. 2569):** `siamraj_unit_assignments` มีผู้รับผิดชอบ 4 บทบาท
เป็นชื่อเล่นไทย — สรรหา 9 คน · คัดสรร 9 · OPL 19 · ทีม online 1 · **แถวรวมใบปิด**
(สรรหา 899 แถว vs ใบเปิด ~292 ⇒ ต้องกรองใบเปิดก่อนนับ) · `audit_logs` 7 วันมีผู้ขยับจริง
10+ คนเป็น **email** — **คนละชุดกับชื่อเล่น ไม่มีตารางแปลง ห้ามจับคู่สองชุดนี้เด็ดขาด**

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_handlers/office-team.ts` | **ใหม่ · GET read-only** `/api/office-team` — ใบเปิดจาก `listSiamrajUnitRequests` (**ท่อเดียวกับ flow-summary** ห้ามเขียนนิยาม "เปิด" ใหม่ + จำกัด departmentScope เหมือนกัน) → join `getUnitAssignmentsMap` (pg) + audit 7 วัน · cache 30 วิ **ต่อ scope** · สองเส้นยิงขนาน ล้มแยกกัน |
| `api/_handlers/registry.ts` | ลงทะเบียน (98 routes · verify ผ่าน) |
| `src/lib/officeTeam.ts` | **ใหม่ · pure** — `buildTeamDepartments()` (นับใบเปิดต่อคน + **unassigned ต่อบทบาท**) · `auditActionLabel()` (action ดิบ→คำไทย ห้ามพ่น raw) · `displayNameFromEmail()` |
| `src/lib/officeTeamApi.ts` | **ใหม่** — client fetch |
| `src/components/home/TeamFloorPanel.tsx` | **ใหม่** — บอร์ด 5 โซนบน canvas ink: สรรหา/คัดสรร/OPL/ทีม Online (สมาชิก = อวตารอักษรแรก + ชื่อเล่น + ใบเปิดที่ถือ เรียงมาก→น้อย cap 6 คน) + โซน AI (LUMOS + เลขคิวจาก office-floor + **ทางเข้า dialog ผลโทร/รอผลที่ย้ายมาจาก funnel**) + แถบ "ขยับล่าสุด 7 วัน" (audit) · แถว "ยังไม่มีชื่ออีก N ใบ" ต่อแผนก **ห้ามซ่อน** |
| `tests/api/officeTeam.test.ts` | **ใหม่** 7 เคส |
| `src/pages/HomePage.tsx` | บอร์ดทีมอยู่ใต้ deck (เห็นเสมอ) · **ยุบ**: OpsRoomsPanel + funnel hero + LumosCallHealthPanel + HomeDigestPanels + FollowTodayPanel · overview เหลือ **KPI row เดียว** ("ดูตัวเลขวันนี้") · dialog ผลโทร/รอผล/รายละเอียดคน **ยังอยู่ครบ** (เปิดจากโซน AI) |
| ลบทิ้ง | `OpsRoomsPanel.tsx` (อายุไม่ถึงวัน) · `officeRooms.ts` + เทสต์ (buildRooms ไม่มีผู้ใช้แล้ว) |

🔴 **กติกาที่ฝังไว้:**
* **นิยาม "ใบเปิด" ห้ามมีที่สอง** — office-team ใช้ `listSiamrajUnitRequests` ตัวเดียว
  กับ flow-summary/หน้า Matching · เลขต้องตรงกันข้ามหน้า (วัดจริง: 296 ตรงกัน)
* **ชื่อเล่น (assignments) กับ email (audit) เป็นคนละจักรวาล** — บอร์ดแสดงแยกส่วน
  โซนใช้ชื่อเล่น · "ขยับล่าสุด" ใช้ชื่อหน้า @ · จับคู่เอง = ชี้ผิดคน
* **unassigned = ใบเปิดทั้งหมด − ใบที่มีชื่อ** (รวมใบที่ไม่มีแถว assignment เลย)
  — ของค้างที่มองไม่เห็นเจ้าของคือรูโหว่ที่บอร์ดนี้เกิดมาเพื่อชี้
* การยุบต้องบอก**ที่ไป**ของทุกตัวในคอมเมนต์ (LumosCallHealth→โซน AI ·
  FollowToday→deck+หน้า Follow · Digest→ขยับล่าสุด+Dashboard) — ห้ามหายเงียบ

**ตรวจจริง 26 ส.ค. 2569 (จอจริง + API จริง):** `/api/office-team` คืน 296 ใบเปิด ·
สรรหา 9 คน (คิว 52 · เล็ก 36 · แบงค์ 35…) ยังไม่มีชื่ออีก 97 ใบ · คัดสรร 9 (อ้อแอ้ 35)
ไม่มีชื่ออีก 98 · OPL 17 (เนตร 25) · online 1 (ใหม่) ไม่มีชื่ออีก 295 · ขยับล่าสุด:
sudarat.r ×87 อัปเดตสถานะ … · บอร์ดขึ้นครบ 5 โซนบนจอ · มือถือ 375 overflow 0 ·
วิธีดูคลิป: ไม่มี ffmpeg บนเครื่อง → `pip install imageio-ffmpeg` ลง scratchpad
แล้วใช้ binary ข้างในแตกเฟรม/crop (จำไว้ใช้รอบหน้า)

### รอบห้าสิบหก · 26 ส.ค. 2569 — **บอร์ดทีมจากลิสต์ชื่อ → ฉากออฟฟิศ isometric วาดด้วยโค้ด**

**เจ้าของตีตกรอบห้าสิบห้า:** *"มันก็แค่เอาชื่อมาแบ่งหนิ มันดูเป็น visual 3d office ตรงไหน"*
— คลิปอ้างอิงเป็น**ผังออฟฟิศจริง** (พื้นห้อง โต๊ะ จอ คนนั่ง) ไม่ใช่ลิสต์คอลัมน์

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/officeIso.ts` | **ใหม่ · pure** — เรขาคณิต isometric (ฉาย 2:1): `layoutIsoOffice()` ผังโซน 3+2 · โต๊ะ = กล่องนูน 3 หน้า · จอแผนกตั้ง · orb คน · ป้ายชื่อลอย · `isoScenePoints()` สำหรับเทสต์ไล่ขอบเขต |
| `tests/api/officeIso.test.ts` | **ใหม่** 5 เคส — ทุกจุดอยู่ใน viewBox · ป้ายชื่อไม่ทับกัน · ผัง 3+2 ถูกแถว · เพดานโต๊ะ/โซน |
| `src/components/home/TeamFloorPanel.tsx` | เพิ่ม `IsoOfficeScene` (จอ ≥md): SVG ฉากเดียว — พื้นกระจกขอบเรืองสีแผนก + กริดจาง + จอแผนก (ชื่อ+จำนวนคน/ใบ) + โต๊ะ+จอเล็ก + คน orb เรือง + ป้ายชื่อ+เลขใบ · ป้ายหน้าโซน "+N คน · ไม่มีชื่ออีก N ใบ" · จอ < md ใช้ลิสต์โซนเดิมเป็น fallback · ปุ่ม dialog AI ย้ายเป็น overlay มุมขวาบนของฉาก |

🔴 **กับดัก/บทเรียนเรขาคณิต iso (จำไว้):**
1. **โซนเรียงแถวเดียวบนฉาก iso = บันไดทแยงมุม** มุมจอโล่งสองข้าง — ต้องจัดกริด (3+2)
2. **ORIGIN/U ต้องวัดจากขอบเขตจริง (`isoScenePoints`) แล้วจูน ไม่ใช่เดา** — วัด 3 รอบ
   กว่าจะพอดีผืน (743px ล้น → ย่อ U → ขยายกลับหลังเปลี่ยนผัง) · เทสต์ไล่ทุกจุดคุมไว้แล้ว
3. **ป้ายชื่อลอยชนกันในแกนหน้าจอไม่ใช่แกนกริด** — แถวโต๊ะห่าง 1.75 ช่อง = ป้ายห่างแค่
   24px บนจอ ต้องถ่าง 2.0 ช่อง + เหลื่อมความสูงคอลัมน์ · มีเทสต์กันระยะป้าย
4. ลำดับวาด painter's: โซน index มาก = ใกล้กล้อง = วาดทีหลัง (แถวสองทับหน้าแถวหนึ่งถูกแล้ว)

**ตรวจจริง 26 ส.ค. 2569:** ฉากขึ้นเป็นออฟฟิศ isometric จริง — 5 โซน 3+2 จอแผนกเรืองแสง
โต๊ะ/จอ/คน orb/ป้ายชื่อ+เลขใบครบ ชื่อจริงเลขจริง (คิว 52 · เล็ก 36 …) · เทสต์เรขาคณิต 5 เคสผ่าน

### รอบห้าสิบเจ็ด · 26 ส.ค. 2569 — **คนเป็นรูปคน · โซนจุ 8 โต๊ะ · กดโต๊ะไปใบขอของคนนั้น**

**เจ้าของสั่ง 3 ข้อ (จากที่เสนอไว้ท้ายรอบก่อน):** ตัวคนให้เป็นรูปคน · โซนจุโต๊ะมากขึ้น ·
กดโต๊ะแล้วไปดูใบขอของคนนั้น · 🔴 ยังห้าม commit/push

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/officeIso.ts` | `ISO_MAX_DESKS` 6 → **8** (2 คอลัมน์ × 4 แถว) · `ZONE_D` 6.8 → 10.4 · `ISO_VIEW` 1240×620 → **1290×720** · `ORIGIN` จูนใหม่ (562,109) → **(696,96)** |
| `src/lib/officeTeam.ts` | **ใหม่** `deskJobsHref()` — map บทบาท → param ที่หน้ารายการอ่านจริง + **`f=active`** |
| `src/components/home/TeamFloorPanel.tsx` | ตัวคนจาก orb 2 วง → **pictogram** (เงาพื้น + ลำตัว path โค้ง + หัว + วงเรืองหายใจ) · โต๊ะห่อ `<a>` กดได้ (preventDefault + navigate = SPA) + `<title>` บอกปลายทาง + ป้ายชื่อ hover ขอบ teal · `MAX_SEATS` ของ fallback มือถือผูกกับ `ISO_MAX_DESKS` (เลขเดียวกันสองมุมมอง) |
| `tests/api/officeTeam.test.ts` | +4 เคส (param ถูกตัว · online = null · ชื่อว่าง = null · **บังคับมี `f=active`**) |

🔴 **กติกา/กับดักที่เจอรอบนี้:**
* 🔴 **ห้ามขยายโต๊ะเป็น 3 คอลัมน์** — ระยะคอลัมน์ 2.6 ช่อง = **79px** บนจอ แต่ป้ายชื่อ
  กว้าง **84px** ⇒ ป้ายทับกันแน่นอน (เทสต์ระยะป้ายจับได้) · เพิ่ม**แถว**ได้เพราะแถว
  เหลื่อมทั้งสองแกน (dx 61 / dy 35)
* 🔴 **ลิงก์ต้องส่ง `f=active`** — หน้ารายการตั้งต้น "ใบขอเปิด/ปิด = **ทั้งหมด**"
  วัดจริง: โต๊ะ "คิว" = 52 ใบเปิด แต่กดเข้าไปได้ **53** (มีใบปิดปน) ⇒ ใส่ `f=active`
  แล้วผลลัพธ์ตรงกัน 52 = 52 · ⚠️ เลขในวงเล็บบน**ชิปตัวกรอง**ยังเป็น 53 (นับอีกชุด
  รวมใบปิด — พฤติกรรมเดิมของหน้านั้น ไม่แตะ) · **ที่ต้องตรงคือผลลัพธ์ ไม่ใช่ชิป**
* **ทีม online กดไม่ได้ (`null`) โดยตั้งใจ** — หน้ารายการไม่มี param ของ online
  ทำลิงก์ไปเฉย ๆ จะได้ลิสต์ที่ไม่ได้กรอง = โกหกคนกด
* **ORIGIN/ISO_VIEW ต้องวัดใหม่ทุกครั้งที่แก้ ZONE_D/U** (รอบนี้วัด 2 รอบ)

⚠️ **screenshot ของ preview pane พังกลางรอบ** (คืนภาพขาวทุกแท็บ ทั้งที่ DOM มีของครบ) —
พิสูจน์ด้วยการ **serialize SVG → วาดลง canvas → นับพิกเซล** แทน: painted **49,034 px
= 21.1%** ของผืน (สีฟ้า/ม่วง 45k · teal 1.2k · แดง 2.2k) ⇒ ฉากเรนเดอร์จริงไม่ใช่ผืนเปล่า
👉 **เทคนิคนี้ใช้ซ้ำได้เมื่อ screenshot ใช้การไม่ได้**

**ตรวจจริง 26 ส.ค. 2569:** จอแผนกครบ 5 ("สรรหา · คัดสรร · OPL · ทีม Online · AI CALL") ·
ลำตัวคน 26 รูป (24 โต๊ะกดได้ + online 1 + LUMOS 1) · ป้ายหน้าโซนบอกความจริง
("+9 คน · ไม่มีชื่ออีก 129 ใบ") · **กดโต๊ะ "คิว" จริง → `/jobs/list?f=active&r=คิว`
ขึ้น "52 ใบขอจาก Siamraj · แสดง 1–20 จาก 52" ตรงกับเลขบนโต๊ะ** · test เต็มชุดผ่าน · tsc 4 = 0

### รอบห้าสิบแปด · 26 ส.ค. 2569 — 🔴 **"ดูไม่ได้อะ" — ฉากถูกซ่อนที่จอ 738px + พื้นโซนว่างมหาศาล**

**เจ้าของบอกสั้น ๆ ว่าดูไม่ได้** · ไล่แล้วเจอ **3 เรื่องคนละเรื่อง** ซ้อนกัน:

**1. dev server ชนพอร์ต** — preview_start ล้มเพราะพอร์ต **3100 (api)** ถูก chat อื่นถือ
🔴 **แก้ไม่ได้ด้วย `autoPort` ใน launch.json** เพราะพอร์ตถูกปักที่ `.env.local`
(`LOCAL_API_PORT=3100` + `VITE_API_PROXY_TARGET`) ซึ่งเป็นไฟล์ที่ **แชร์กับ chat อื่น**
👉 วิธีที่ถูก: **สตาร์ตแค่ `vite`** (`preview_start {name:'vite'}`) แล้วให้ proxy ไปที่
api ตัวที่รันอยู่ (เช็คก่อนด้วย `curl 127.0.0.1:3100/api/health` = 200) — ไม่ต้องแตะ config ที่แชร์

**2. 🔴 ฉากถูกซ่อนที่จอของเจ้าของ** — หน้าต่าง preview กว้าง **738px** แต่ผมเปิดฉากที่
`md` (≥768px) ⇒ **เจ้าของไม่เคยเห็นฉากเลย** เห็นแต่ลิสต์ fallback ตลอด
👉 บทเรียน: **วัดความกว้างหน้าต่างจริงของเจ้าของก่อนตั้ง breakpoint** (`innerWidth`)
ห้ามเดาว่า "เดสก์ท็อป = ≥768"

**3. พื้นโซนว่างมหาศาล** — `ZONE_D` ตรึง 10.4 ช่องทุกโซน ⇒ โซน "ทีม Online"/"AI Call"
ที่มีคนเดียวกลายเป็นลานว่างใหญ่กว่าโซนที่มี 8 คน อ่านเหมือนฉากพัง

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/officeIso.ts` | **ความลึกโซนปรับตามจำนวนโต๊ะ** (`zoneDepth()`) · แถวถัดไปเริ่มหลังแถวที่ลึกสุดของแถวก่อน · ป้ายชื่อขยับใกล้โต๊ะ (−64 → −46) กันล้นข้ามโซน · **ใหม่** `ISO_MIN_WIDTH_PX = 1100` · ORIGIN/VIEW วัดใหม่จากเคสแย่สุด → `{713,96}` / `1306×730` |
| `src/components/home/TeamFloorPanel.tsx` | ฉากเปิดที่ **`sm`** (ไม่ใช่ `md`) + ห่อ `overflow-x-auto` + `style={{minWidth: ISO_MIN_WIDTH_PX}}` (ค่าเรขาคณิตผ่าน inline style — กติกาห้าม arbitrary utility อย่าง `min-w-[1100px]`) · fallback ลิสต์เป็น `sm:hidden` |
| `tests/api/officeIso.test.ts` | เปลี่ยนเป็น `it.each` **4 สัดส่วนจำนวนคน** (เต็ม/จริง/ว่าง/ปะปน) + เคส "โซนคนเดียวต้องตื้นกว่าโซนเต็ม" |

🔴 **กติกา/ข้อเท็จจริงที่วัดแล้ว (อย่าลองซ้ำ):**
* **ย่อฉากให้พอดี 738px ไม่ได้** — ฉากกว้าง 1,274–1,306 หน่วย ⇒ ย่อพอดีจอ = ป้ายชื่อ
  **6.5–7.6px อ่านไม่ออก** · ที่ `minWidth 1100` ได้ **9.7px** (วัดจริง) ยังอ่านได้
  และบนโน้ตบุ๊ก 1440 (แผงกว้าง ~1,240) พอดีไม่ต้องเลื่อน
* ⚠️ **2 คอลัมน์ × 3 แถว กว้างกว่า 3 คอลัมน์ × 2 แถว** (1,475 vs 1,306) — iso กระจาย
  ทแยง **เพิ่มแถวคือเพิ่มความกว้าง ไม่ใช่ลด** (ลองแล้ว ย้อนกลับแล้ว)
* 🔴 **ห้ามเขียน `*` ติด `/` ในคอมเมนต์บล็อก** — เขียน `ZONE_*/ความลึก` แล้ว `*/`
  **ปิดคอมเมนต์กลางทาง** ทั้งไฟล์พังทันที (swc ฟ้อง `Expected ';'`) · ใช้ `·` คั่นแทน
* ⚠️ **bash กิน `${...}` ในสตริง double-quote** — `npx tsx --eval "...${x}..."` โดน
  shell expand พังเงียบ · วัดค่าให้เขียนเป็นเทสต์ใน `tests/api/` แล้วรัน vitest แทน
  (ไฟล์นอก `tests/api|demo` และ `src/**` vitest ไม่เก็บ — ดู include ใน config)

**ตรวจจริง 26 ส.ค. 2569 (จอ 738px ของเจ้าของ):** ฉากขึ้นแล้ว (`sceneVisible: true`) ·
svg กว้าง 1,100px · ป้ายชื่อ **9.7px** · เลื่อนแนวนอนได้ · **หน้าไม่ล้นขอบ** (`-6`) ·
พื้นโซน Online/AI ตื้นลงตามจำนวนคนจริงแล้ว · เทสต์เรขาคณิต **9 เคสผ่าน**
⚠️ **ที่ยังไม่ดี (บอกตรง ๆ):** ที่ 738px ฉากยัง**ล้นขวา ต้องเลื่อนดู** — โซนแถวขวา
(คัดสรร/OPL) ถูกตัดตอนเปิดมา · ถ้าเจ้าของรับไม่ได้ ทางเลือกคือลดจำนวนโต๊ะที่โชว์
หรือถอดป้ายชื่อออกจากฉาก (ให้ชื่อขึ้นตอน hover) — **รอเจ้าของเคาะ ยังไม่ลงมือ**

### รอบห้าสิบเก้า · 26 ส.ค. 2569 — **ตัวกรองราชการ/เอกชน ในหน้ารายการใบขอ**

**เจ้าของสั่ง:** *"หน้าใบขอเพิ่ม Filter ของ ราชการ เอกชน มาที"*

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/unitSector.ts` | **ใหม่** `UnitSectorFilter` (`government`/`private`/**`unset`**) · `UNIT_SECTOR_FILTER_OPTIONS` · `UNIT_SECTOR_FILTER_VALUES` · `matchesAnyUnitSectorFilter()` |
| `src/lib/jobListPageState.ts` | `sectorFilter: UnitSectorFilter[]` เข้า state + parse/serialize param **`sec`** + เข้าลิสต์ปุ่มล้างตัวกรอง |
| `src/pages/jobs/JobListPage.tsx` | `FilterMultiSelect` ป้าย **"ราชการ / เอกชน"** วางถัดจาก "ส่งคนแทน" + เงื่อนไขกรองใน pipeline + deps |
| `tests/api/unitSectorFilter.test.ts` | **ใหม่** 8 เคส (ตรรกะกรอง · unset · หลายค่า OR · URL ครบวง · ค่ามั่วถูกทิ้ง · ไม่ชน `sc`) |

🔴 **กติกาที่ฝังไว้:**
* 🔴 **param ต้องเป็น `sec` ไม่ใช่ `sc`** — `sc` ถูกใช้เป็น **เจ้าหน้าที่คัดสรร** อยู่แล้ว
  ทับแล้วตัวกรองสองตัวจะกินกันเงียบ ๆ (มีเทสต์คุมว่าสองตัวอยู่ร่วมกันได้)
* 🔴 **ต้องมีตัวเลือก "ยังไม่ระบุ" (`unset`)** — วัดฐาน 26 ส.ค. 2569: ใบเปิด 298 ใบ
  = ราชการ **7** · เอกชน **173** · **ยังไม่ระบุ 118** ⇒ ถังใหญ่อันดับสอง
  ไม่มีตัวเลือกนี้ = หา "ใบที่ยังไม่มีใครกรอกประเภท" ไม่ได้เลย ซึ่งเป็นงานที่ต้องตามจริง
* **ใบที่ไม่มี property / null / ค่ามั่ว นับเป็น `unset` เหมือนกันหมด** (กติกาเดิมของ
  `unit_sector`: ยังไม่ระบุ ≠ เอกชน — ห้ามให้ค่าใดเป็น default)

**ตรวจจริงบนจอ + เทียบฐาน 26 ส.ค. 2569:** dropdown ขึ้นครบ 4 ตัวเลือก
(ทั้งหมด/ราชการ/เอกชน/ยังไม่ระบุ) · ผลกรองตรงฐานทุกค่า:
**ราชการ 7 · เอกชน 173 · ยังไม่ระบุ 118 · เอกชน+ยังไม่ระบุ 291 · ทั้งหมด 298**
(7+173+118 = 298 ครบพอดี) · แชร์ลิงก์ `?sec=` แล้วตัวกรองยังติด

### รอบหกสิบ · 26 ส.ค. 2569 — 🔴 **หน้าหลักโทนสว่างตามธีม + บอร์ด 4 ทีมตามสเปกเจ้าของ**

**เจ้าของสั่ง (สเปกละเอียดสุดของรอบนี้):** *"หน้าหลักขอสี Tone สว่างเพราะตอนนี้เปิด
โหมดสว่าง"* + เปลี่ยนบอร์ดทีมเป็น **4 ทีม (Online/สรรหา/ปิดใบขอ/Lumos)** โดยพิมพ์
เมตริกเองทีมต่อทีม + หลัก 4 ข้อ: ห้องทำอะไร · ติดตรงไหน · **Error ไม่เงียบ** · นำทางต่อ
· สเปกเต็ม + ตารางเมตริก→แหล่งข้อมูลอยู่ `~/.claude/plans/home-team-board-redesign.md`
· *"แก้ลงนี่มาดู localhost:53322/"* ⇒ ลงมือเลยในรอบนี้ (แผนเดิมยังใช้ไล่หน้าอื่นต่อ)

| ไฟล์ | ทำอะไร |
|---|---|
| `src/index.css` | `.jarvis-deck` เป็นสองธีม: **สว่าง = glass ขาวแบบต้นแบบ** (ค่าเริ่มต้น) · `.dark .jarvis-deck` = ink เดิม (⚠️ ห้ามเติม dark: เข้าชุด HUD_* — เทสต์ designTokens ห้าม · deck เป็นคนละชุด) |
| `src/components/home/CommandDeck.tsx` | สีทุกจุดเป็นคู่ light/dark (~40 จุด: เฉด 600-700 บนสว่าง · 300 บน ink) |
| `src/lib/officeTeam.ts` | **ใหม่**: `BOARD_TEAM_META` (4 ทีม + path นำทาง) · `BOARD_TEAM_PEOPLE` (แผนกคน→โซน) · types `BoardTeams`/`LaneCounts`/`StageCounts`/... · `queueLane()` (นิยามเลนเดียวกับ SQL — มีเทสต์) |
| `api/_handlers/office-team.ts` | เพิ่ม `teams`: `loadOnlineTeam` (ประกาศแล้ว/ยัง จาก `job_public_releases` ∩ ใบเปิด · ขั้น Content/Scraping จาก `job_posting_requests` **นิยามเดียวกับ flow-summary**) · `loadRecruitTeam` (`public_job_applications` + `application_contact_logs` + `application_appointment_results`) · `loadLumosTeam` (คิวแยก 3 เลนจาก person_ref) · **ล้มแยกกลุ่ม → `teams.errors` จอวาด "วัดไม่ได้"** |
| `src/components/home/TeamFloorPanel.tsx` | เขียนใหม่: ฉาก iso 4 โซนทีม (คน = แผนกเดิม map ผ่าน BOARD_TEAM_PEOPLE · Lumos = ตัว AI) + **แถบเมตริก 4 คอลัมน์ตามสเปกเจ้าของ** + ปุ่ม "ทำต่อ →" ทุกทีม + บรรทัด OPL ไม่หายเงียบ + สีคู่ light/dark ทั้งไฟล์ |
| `src/lib/officeIso.ts` | ผัง 3+2 → **2×2** (4 โซน) · ORIGIN/VIEW วัดใหม่จากเคสแย่สุด → `{713,96}` / `1102×730` · `ISO_MIN_WIDTH_PX` 1100→1000 |
| เทสต์ | officeIso ปรับเป็นเคส 4 โซน (9 ผ่าน) · officeTeam เพิ่ม queueLane + BOARD_TEAM_META (15 ผ่าน) |

🔴 **กติกาที่ฝังไว้:**
* **นิยามเลนคิวมีสองที่โดยจำเป็น** (SQL ใน handler + `queueLane` ใน lib) — คอมเมนต์
  ชี้ถึงกันแล้ว **แก้ฝั่งไหนต้องแก้อีกฝั่ง** · เลน: `app-`=สาธารณะ · `card-`/`ir-`=match ·
  `follow-`/job_ref='follow'=Follow · อื่น = other ห้ามเดา
* **id ที่ใช้ join ฝั่ง pg คือ `item.id`** (รูป `siamraj-sql:XXX`) ไม่ใช่ request_no —
  วัดจริง: `public_job_applications.job_id`/`job_public_releases.job_id` เก็บรูปนี้
* **"ติดต่อแล้ว" ของผู้สมัคร = AI (คิว app-%) ∪ โทรมือ (contact_logs)** —นับคน union
  ห้ามบวกสองก้อน (ซ้ำ) · "มา/ไม่มา" ใช้ `application_appointment_results` (089)
  ไม่ใช่ follow_entries (ของ KPI เก่าคนละงาน)
* **ทีมไหนวัดไม่ได้ต้องขึ้น "วัดไม่ได้ — เหตุผล"** (`teams.errors`) — Promise ทีมละก้อน
  ล้มแยกกัน ห้าม 0 ปลอม ห้ามซ่อนคอลัมน์

**ตรวจจริง 26 ส.ค. 2569 (จอจริงทั้งสองธีม):** โหมดสว่าง = glass ขาวทั้งแผง หน้าปัด
ฟ้า/teal เข้มอ่านชัด · บอร์ด: Online 298/ประกาศแล้ว 176/**ยังไม่ประกาศ 122 (แดง)** ·
สรรหา: มีคนสมัคร 1/**ยังไม่มี 297 (แดง)** · ปิดใบขอ: เลยนัด 1 · Lumos แยก 3 เลน
(สาธารณะ 1 · match 59 รอผล 37 · follow 5) ตรง SQL ที่วัดมือ · โหมดมืด = ink เดิมครบ ·
ฉาก 2×2 โซนสีทีม คนสีทีม ป้ายขาวตัวเข้ม · overflow 0

### รอบหกสิบเอ็ด · 26 ส.ค. 2569 — 🔴 **บอร์ดทีมถูกถอดทั้งดวง → เหลือก้อนทีม 4 ใบกดนำทาง**

**เจ้าของสั่ง:** *"ทีมปฏิบัติการ · ใครทำอะไรอยู่ เอาออกไป เสียเวลากะมันมาเยอะและ
ไม่ถูกใจสักที แต่เอาก้อนทีมต่าง ๆ มาทำให้มันกดแล้วนำทางไปแทนละกัน"*
🔴 **คำผูกมัดถาวร: ห้ามเอาบอร์ดเมตริกทีม/ฉาก iso กลับมาบนหน้าแรกอีก** —
ตีตกแล้ว 3 รูปแบบ (ลิสต์ชื่อ · ฉาก iso · เมตริก 4 ทีม) เจ้าของเลือกจบที่ "นำทางล้วน"

| ทำอะไร | รายละเอียด |
|---|---|
| **ลบทิ้งทั้งชุด** | `TeamFloorPanel.tsx` · `officeIso.ts` (+เทสต์ 9 เคส) · `officeTeam.ts` (+เทสต์ 15 เคส) · `officeTeamApi.ts` · `api/_handlers/office-team.ts` + เส้นใน registry (**กลับเป็น 97 routes** · verify ผ่าน) |
| `src/lib/soRecruitNav.ts` | **ใหม่** `HOME_TEAM_NAV` — 4 ทีม (online/recruit/closing/lumos) label+blurb+path (+เทสต์ใน soRecruitNav.test.ts) |
| `src/components/home/TeamNavRow.tsx` | **ใหม่** — การ์ดทีม 4 ใบ กดแล้ว navigate · จุดสี+ป้าย+ลูกศร ไม่มีตัวเลข · การ์ด Lumos พ่วงปุ่ม dialog "ผลโทรวันนี้/รายชื่อรอผล" (ฟีเจอร์จองตัว 12 ส.ค. ห้ามหาย — นี่คือทางเข้าเดียวที่เหลือ) · คู่สี light/dark |
| `src/pages/HomePage.tsx` | ถอด state/loadTeam/fetchOfficeTeam ทิ้ง · แทนด้วย `<TeamNavRow>` |

⚠️ **ของที่หายไปพร้อมบอร์ด (จงใจ — เจ้าของสั่งถอด):** เมตริก 4 ทีมทั้งชุดที่เพิ่งทำ
(ประกาศแล้ว/ยัง · ใบมี/ไม่มีผู้สมัคร · เลนคิว Lumos ฯลฯ) · ฉาก iso คนนั่งโต๊ะ ·
"ขยับล่าสุด 7 วัน" · กดโต๊ะไปใบขอรายคน — **นิยาม/แหล่งข้อมูลที่วัดแล้วยังอยู่ในแผน
`~/.claude/plans/home-team-board-redesign.md` H2** ถ้าวันหน้าจะใช้ที่หน้าอื่น (เช่น
Dashboard) ไม่ต้องวัดใหม่ · commit เดียวที่เคยขึ้น main ของเรื่องนี้ = ไม่มี (ทุกอย่าง
อยู่ใน working tree ตลอด)

**ตรวจจริง 26 ส.ค. 2569:** การ์ด 4 ใบขึ้นครบ (โทนสว่าง จุดสีทีม) · กดการ์ด "ทีมสรรหา"
จริง → landing `/jobs/board?view=list` ถูกเส้น · ปุ่ม dialog 2 ตัวบนการ์ด Lumos อยู่ครบ ·
grep ทั้ง repo ไม่เหลือ ref ถึงไฟล์ที่ลบ · registry 97 · overflow 0

### รอบหกสิบสอง · 26 ส.ค. 2569 — 🔴 **"กดแล้วงง" — หน้าแรกมีปุ่มนำทางซ้ำสองชุด**

**เจ้าของ:** *"นายลองกดตามกล่องแต่ละทีมสิว่างงไหม ฉันลองกดแล้วฉันงง ฉันหมายถึง
มันแต่ละช่องมันควรกดแล้วนำทางไปหน้านั้น ๆ ไง"* ⇒ **กดจริงทีละใบแล้วเจอ 3 ปัญหาซ้อน**

🔴 **ต้นตอ (วัดจากการกดจริง ไม่ใช่อ่านโค้ด):**
| กด | ไปโผล่ | ปัญหา |
|---|---|---|
| ทีม Online | ขั้นที่ 2/6 ประกาศรับ | ซ้ำ tile ขั้น 2 **และ** ใช้คนละ path กับเมนูซ้าย (`/matching/job-postings` vs `/jobs/board?view=postings`) |
| ทีมสรรหา | ขั้นที่ 3/6 **ผู้สมัคร** | ซ้ำ tile ขั้น 3 · ชื่อที่กดไม่ตรงชื่อหน้า |
| ทีมปิดใบขอ | ขั้นที่ 4/6 **จับคู่ & โทร** | ซ้ำ tile ขั้น 4 · ชื่อไม่ตรง |
| ทีม Lumos | ขั้นที่ 4/6 จับคู่ & โทร | 🔴 **ซ้ำหน้าเดียวกับทีมปิดใบขอเป๊ะ** |

⇒ **หน้าแรกมีชุดนำทางสองชุดพาไปที่เดียวกัน** (tile 6 ขั้นบน deck + ก้อนทีม 4 ใบ)
เรียกชื่อคนละอย่าง กดแล้วเจอชื่อไม่ตรง = งง · **ข้อเท็จจริงที่เจอระหว่างทาง: ระบบ
ไม่มีหน้าของทีม Lumos เลย** (ไม่มี route — ผลโทรอยู่ใน dialog + ปนในหน้าจับคู่)

**เจ้าของเคาะ 2 ข้อ:** (1) *"เอากล่องทีมไว้ เอาตัวเลขมาใส่"* ⇒ ตัด tile 6 ขั้นทิ้ง
(2) ทีม Lumos *"กดแล้วเปิด dialog ผลโทร"* ⇒ ไม่สร้างหน้าใหม่

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/home/CommandDeck.tsx` | **ถอดแถบ tile 6 ขั้นทิ้ง** + ถอด prop `counts`/`buildStageTiles` ที่ตายตาม (เอาออกให้สุด) |
| `src/lib/soRecruitNav.ts` | `HOME_TEAM_NAV.path` เป็น `string \| null` · **Lumos = `null`** (ไม่มีหน้าจริง) · **Online เปลี่ยนเป็น `/jobs/board?view=postings`** ให้ตรงกับขั้นในเมนูซ้าย |
| `src/components/home/TeamNavRow.tsx` | รับ `stats` (2 ตัวเลขต่อทีม · `null` = "—" · `alert` = แดง) · Lumos เป็น `<button>` เปิด dialog · ทีมอื่นเป็น `<Link>` |
| `src/pages/HomePage.tsx` | ประกอบ `teamStats` จาก `conveyorCounts` + `office.counts` (**ไม่ยิง API เพิ่ม**) |
| `tests/api/soRecruitNav.test.ts` | +3 เคส: 🔴 **หนึ่งกล่องหนึ่งปลายทาง ห้ามซ้ำ** · Lumos ต้องเป็น null · **ทุก path ต้องตรงกับขั้นในสายพาน (กันลิงก์ตาย — เทสต์นี้จับ Online ชี้ผิดหน้าได้จริง)** |

🔴 **กติกาถาวร:** หน้าแรกมี**ชุดนำทางชุดเดียว** — ถ้าจะเพิ่มปุ่มไปหน้าไหน ต้องเช็คก่อน
ว่าซ้ำกับก้อนทีม/เมนูสายพานหรือยัง · ชื่อบนปุ่มควรตรงกับชื่อหน้าปลายทาง
⚠️ เลข 6 ขั้นไม่หาย — เมนูสายพานซ้ายมี badge ครบ + เลขที่ใช้บ่อยยกมาไว้บนก้อนทีม

**ตรวจจริง 26 ส.ค. 2569 (กดจริงทุกใบ):** 4 กล่องปลายทางไม่ซ้ำกันแล้ว
(`/jobs/board?view=postings` · `/jobs/board?view=list` · `/matching/match` · dialog) ·
ตัวเลขขึ้นครบ (Online 299 ใบขอ/1 คำขอ · สรรหา 0/0 · ปิดใบขอ 178/**1 เลยนัด แดง** ·
Lumos 0/0) · **กดทีม Lumos → dialog "ผลจากการโทร" เปิดจริง** (สนใจ 2 · รอโทรซ้ำ 37 ·
ไม่สนใจ 1) · tile 6 ขั้นหายจากหน้าแล้ว · โทนสว่างครบ

### รอบหกสิบสาม · 26 ส.ค. 2569 — 🔴 **เข้าใจคำสั่งผิดหนึ่งรอบเต็ม → บอร์ดเมตริกกลับมา + ทุกแถวกดนำทางได้**

**เจ้าของ clarify (หลังโดนการ์ดเปล่า):** *"กล่องแต่ละทีมตอนแรกบอกรายละเอียดหมดเลย
และฉันโอเคกะแบบนั้น เลยให้ทำเป็นกดรายละเอียดอันไหนก็นำทางไปอันนั้นสิ ...
ที่เห็นเนี่ยก็แค่กล่องโง่ ๆ ที่ไม่รู้อะไรแล้วก็ต้องไปไล่กดหาเอง"*

🔴 **บทเรียนการตีความ (สำคัญกว่าโค้ด):** คำสั่งรอบก่อน *"เอาออก...เอาก้อนทีมมาทำให้
กดนำทางไปแทน"* — สิ่งที่เจ้าของไม่เอาคือ **ฉาก/ความพยายาม visual** ไม่ใช่**เมตริก**
ผมตีความเป็น "ยุบทุกอย่างเหลือปุ่ม" = ผิด · **เมตริก 4 ทีมตามสเปกเจ้าของ = ของที่
เจ้าของยืนยันเองว่าโอเค ห้ามยุบทิ้งอีกเด็ดขาด** · ของที่ตีตกถาวรมีแค่: ฉาก isometric ·
รายชื่อคนนั่งโต๊ะ · แถบขยับล่าสุด · การ์ดเปล่าไร้ข้อมูล

⚠️ **กับดักที่เจ็บจริงรอบนี้:** ไฟล์บอร์ด/API ที่ลบไปรอบหกสิบเอ็ด **กู้จาก git ไม่ได้**
(ไม่เคย commit + stash ไม่เก็บ untracked) — รอดเพราะเนื้อโค้ดยังอยู่ในบริบท session
👉 **จะลบ untracked ไฟล์ใหญ่ ให้ stash -u หรือ copy ไป scratchpad ก่อนเสมอ**

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/officeTeam.ts` | **สร้างคืน (ตัดเหลือที่ใช้)** — types ทีม + `queueLane()` · ตัด buildTeamDepartments/activity/deskJobsHref (ของฉาก iso ที่ตีตก) |
| `api/_handlers/office-team.ts` | **สร้างคืน** — `teams` 3 ก้อน (online/recruit/lumos) ล้มแยกทีม → `errors` · ตัด departments/activity ออกจาก response (ไม่มีจอไหนใช้แล้ว) · registry 98 เส้น |
| `src/lib/officeTeamApi.ts` | สร้างคืน (โครงใหม่: `{generated_at, open_total, teams}`) |
| `src/components/home/TeamBoardPanel.tsx` | **ใหม่** — เมตริกครบตามสเปก 4 คอลัมน์ · **ทุกแถวเป็น `<Link>` หรือปุ่ม dialog** (ลูกศรจางท้ายแถว บอกว่ากดได้) · หัวคอลัมน์ label/blurb/path มาจาก `HOME_TEAM_NAV` ที่เดียว · แถว "รอผล/ได้ผล" ของ Lumos + "รอผลจาก Lumos/เงียบเกิน 1 วัน" ของทีมปิดใบขอ → เปิด dialog เดิม |
| `src/components/home/TeamNavRow.tsx` | **ลบ** (การ์ดเปล่าที่โดนด่า) |
| `src/pages/HomePage.tsx` | คืน state โหลด office-team + สลับเป็น TeamBoardPanel + คอมเมนต์เล่าลำดับคำสั่ง 3 รอบกันคนต่อไปตีความผิดซ้ำ |

**ปลายทางต่อแถว (นิยามการนำทาง):** ใบขอเปิด→`/jobs/list?f=active` · ประกาศ/ยังไม่ประกาศ→
`/jobs/board?view=postings` · Scraping/Content→`/matching/job-postings` · ฝั่งผู้สมัคร/นัด→
`/jobs/board?view=list` · คิว AI→`/matching/match` หรือ dialog · Follow→`/follow` ·
ดูแลหลังเริ่มงาน→`/aftercare` · เลนคิว Lumos→dialog ผลโทร/รอผล

**ตรวจจริง 26 ส.ค. 2569 (กดจริง):** แถวกดได้ **37 แถว** ครบทุกเมตริก · กด "เลยเวลานัดแล้ว 1"
→ landing `/follow` จริง · กด "รอผลกลับ" ของเลน Lumos → dialog เปิดจริง · เลขจริง:
Online 299/176/**123 ยังไม่ประกาศ (แดง)** · สรรหา 1/**298 ยังไม่มีใครสมัคร (แดง)** ·
ปิดใบขอ 4 รอส่ง/6 นัดวันนี้/**1 เลยนัด** · Lumos: สาธารณะ 1 · match 59 (รอผล 37) · follow 10
---

### รอบหกสิบสี่ · 26 ส.ค. 2569 — 🔴 **audit "มุมพนักงานใหม่" แล้วเจอบั๊กเลขจริง 2 ตัว → ตั้งพจนานุกรมเลข**

**ที่มา:** เจ้าของถาม *"ถ้านายเป็นพนักงานใหม่มาใช้ระบบนี้ จะเข้าใจไหมถ้าฉันไม่สอน"*
⇒ เดินจริงทุกหน้า (หน้าแรก + สายพาน 6 ขั้น) แล้วจดทุกจุดที่งง · เจ้าของสั่งต่อ:
*"แก้เลย A ก่อนแล้วไล่ไป · ฉันสนใจระบบให้นิ่งพร้อม Production ก่อน"*

#### สิ่งที่ audit เจอ (สรุป — รายการเต็มอยู่ในบทสนทนา)

เลขไม่ตรงกันข้ามจุด **9 จุด** · ศัพท์ไม่มีคำอธิบาย **21 คำ** (Lumos/OPL/Lead/คนเขียว/
กองไม่สนใจ/`wrong_person` ฯลฯ) · ไม่รู้ว่าอะไรกดได้ **7 จุด** · เข้าหน้าแล้วไม่รู้ทำอะไร **6 จุด**
🔴 สามอันดับที่ทำร้ายคนใหม่สุด: (1) แถบ ✓✓✓✓ หน้าแรกโกหกว่าขั้น 1-4 เสร็จแล้ว
(2) หน้าแรกส่งไปหน้าที่ไม่มีเลขนั้น 5 จุด (3) หน้า Follow มียอดรวม 3 ชุดขัดกันบนจอเดียว

#### 🔴 บั๊กจริงที่วัดฐานยืนยันแล้ว (ไม่ใช่เรื่องป้าย)

**บั๊ก 1 — "มีผลแล้ว" มีสองนิยาม** · `matching-flow-summary` เขียน `result is null` เอง
ส่วน `office-floor` เขียน `coalesce(last_outcome, result->>'outcome')`
วัดฐาน: `flow_delivered_waiting = 38` แต่ `floor_waiting_result = 0` และ
`has_outcome_but_no_result = 38` ⇒ **การ์ด 01 หน้าแรก "ส่ง AI ไปแล้วเงียบ 37 ราย" โกหก
ทั้ง 38 สายมีผลกลับครบแล้ว** · เหตุ: ผลที่**คนบันทึกเอง**เขียนแค่ `last_outcome` และ
ตอนตั้งโทรซ้ำระบบ**ล้าง `result` ทิ้ง** · อีก 9 ไฟล์ในระบบเขียนถูกมาตลอด ตกหล่นแค่ 2 เส้นนี้
ซึ่งดันเป็น 2 เส้นที่หน้าแรกใช้

**บั๊ก 2 — บอร์ด Lumos นับสายที่ยกเลิกรวมใน "ส่งเข้าทั้งหมด" + ใช้ `count(result)` เป็น
"ได้ผลแล้ว"** ⇒ นับพลาดสองทางพร้อมกัน วัดฐานเทียบก่อน/หลัง:

| เลน | เดิม ทั้งหมด/ได้ผล | ใหม่ ทั้งหมด/รอโทร/รอผล/ได้ผล/ยกเลิก |
|---|---|---|
| match | 59 / **3** | 40 / 0 / 0 / **40** / 19 |
| follow | 21 / 10 | 15 / 0 / 0 / **15** / 4 |
| public | **1 / 0** (ย่อยทุกช่อง 0) | 0 / 0 / 0 / 0 / **1** |

⇒ เดิมบอร์ด**ทำให้ Lumos ดูเหมือนพัง** (ได้ผล 3 จาก 59) ทั้งที่ได้ผลครบ 100%

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/lumosQueueDefs.ts` | **ใหม่** — นิยามกลางของคิวโทร: `queueOutcome/HasResult/Cancelled/Active/Waiting/Pending/SentAt/ResultAt/Stale/StalePending` · รับ alias `''` ได้ (คิวรีตารางเดียว) |
| `api/_handlers/matching-flow-summary.ts` | เลิกเขียน `result is null` เอง → ใช้นิยามกลาง (แก้บั๊ก 1) · `listActiveCalls` ด้วย |
| `api/_handlers/office-floor.ts` | ยก `QUEUE_OUTCOME/SENT_AT/RESULT_AT/WAITING/STALE` ไปอ่านจากนิยามกลาง (พฤติกรรมเท่าเดิม — เส้นนี้เขียนถูกอยู่แล้ว) |
| `api/_handlers/office-team.ts` | `loadLumosTeam` เขียนใหม่: `filter (where ...)` ต่อถัง · ตัด cancelled ออกจาก total (แก้บั๊ก 2) |
| `src/lib/metricDictionary.ts` | **ใหม่** — พจนานุกรมเลข 31 ตัว: `label/unit/what/scope/href/opens/landing/landingGap` + `metricHelp()` + `metricsWithLandingGap()` |
| `src/lib/followSchedule.ts` | **ใหม่** — `followScheduleCounts()` นิยามเดียวกับ `FOLLOW_SQL` เป๊ะ (today/pastDue/upcoming) |
| `src/lib/soRecruitNav.ts` | เพิ่ม `CONVEYOR_BADGE_MEANING` + `CONVEYOR_BADGE_SHORT` — ป้ายเลขท้ายเมนูบอกว่านับอะไร |
| `src/lib/homeDeck.ts` | `COUNT_LABEL` เลิกพิมพ์เอง → อ่านจาก `CONVEYOR_BADGE_SHORT` |
| `src/components/home/TeamBoardPanel.tsx` | `<Row>` รับ `metric` แทน `label/unit/to` · ป้าย/หน่วย/ปลายทาง/tooltip มาจากพจนานุกรม · เพิ่มแถว "ยกเลิกไป (ไม่นับรวม)" โชว์เมื่อมีจริง |
| `src/components/layout/ConveyorSidebar.tsx` | `Badge` รับ `meaning` → `title` · `titleOf()` ต่อคำอธิบายเลขเข้าไปในทูลทิปของทั้งแถว |
| `src/pages/follow/FollowPage.tsx` | **เพิ่มแถบเวลานัด** "นัดวันนี้ · เลยเวลานัดแล้ว · นัดล่วงหน้า" บนหัว (เลขชุดเดียวกับที่หน้าแรกพาดหัวส่งคนมา) |
| `tests/api/lumosQueueDefs.test.ts` | **ใหม่** 13 เทสต์ — รวม**ด่านสแกนโค้ด**ห้าม 3 handler เขียน `result is null`/`count(result)` เอง |
| `tests/api/metricDictionary.test.ts` | **ใหม่** 40 เทสต์ — ทุกเมตริกมีนิยาม · ปลายทางเป็น path/`?view=` ที่มีจริง · ด่านสแกนห้าม `<Row label=/unit=/to=>` · **เพดานหนี้ `landingGap` ≤ 10 ห้ามเพิ่ม** |
| `tests/api/followSchedule.test.ts` | **ใหม่** 7 เทสต์ |

#### 🔴 กติกาใหม่ที่ห้ามลืม

1. **ห้ามเขียน `result is null` / `count(result)` กับตารางคิวอีก** — import จาก
   `_lib/lumosQueueDefs.ts` เท่านั้น (มีเทสต์สแกนไฟล์คุม)
2. **เลขที่ขึ้นหน้าแรกต้องมี entry ในพจนานุกรม** — และต้องบอกได้ว่าไปเจอเลขนี้ตรงไหน
   ของหน้าปลายทาง (`landing`) **หรือยอมรับตรง ๆ ว่ายังไม่มี** (`landingGap`)
   🔴 ห้ามแต่ง `landing` ปลอมมากลบ — `landingGap` ทุกตัวคือคิวงานที่ยังไม่จบ
3. **เพดาน `landingGap` = 10 ห้ามเพิ่ม** ปิดได้ทีไรให้ลดเลขในเทสต์ลง

#### หนี้ที่เหลือ (landingGap 10 จุด — ปลายทางยังไม่มีเลขนั้น)

`online.scraping.*` + `online.content.*` (6) — หน้าคำขอโพสต์ไม่กรองตามใบขอที่ยังเปิด
(หน้าแรกกรอง ⇒ 1 vs 5 · 4 ใน 5 ที่เกินคือชุด DEMO) · `recruit.jobs_with_apps` ·
`recruit.jobs_without_apps` (บอร์ดไม่มีกล่อง "ยังไม่มีผู้สมัคร") · `recruit.apps_contacted`
(คนละเกณฑ์กับกล่อง "โทรแล้ว") · `closing.queue_pending` (หน้าจับคู่กรองตามสิทธิ์)

#### กับดักที่เจอรอบนี้

- 🔴 **backtick ในคอมเมนต์ SQL ปิด template literal** — เขียน ``-- ... `result is null` ...``
  ในสตริง SQL แล้ว tsc ฟ้อง `',' expected` งง ๆ · ห้ามใช้ backtick ในคอมเมนต์ที่อยู่ในสตริง
- เทสต์สแกนโค้ดต้อง**ตัดคอมเมนต์ `--` ในสตริง SQL** ด้วย ไม่ใช่แค่คอมเมนต์ JS
  (ไฟล์พวกนี้เล่าเรื่องบั๊กด้วยคำที่ตัวเองห้าม)
- **API รีสตาร์ต (tsx watch) = เบราว์เซอร์หลุดล็อกอิน** ⇒ ตรวจจอจริงต้องให้เจ้าของ
  ล็อกอินใหม่ (Claude กรอกรหัสผ่านแทนไม่ได้) · ระหว่างนั้นวัดจากฐานตรง ๆ ด้วยสคริปต์
  read-only แล้ว**ลบทิ้ง** (วางที่ repo root ชั่วคราวเพราะ scratchpad หา `pg` ไม่เจอ)

**ด่านตรวจ:** test **2,318 ผ่าน / 6 skip (219 ไฟล์)** (เดิม 2,271/217) · tsc 4 = 0 ·
eslint 0 err / 18 warn (เท่าเดิม)
⚠️ **ยังไม่ได้ตรวจบนจอจริง** — รอเจ้าของล็อกอินที่ 53322

---

### รอบหกสิบห้า · 26 ส.ค. 2569 — **B/C/D: ภาษาชุดเดียว · ถอดแถบติ๊กถูกที่โกหก · ปุ่มพูดความจริง**

ต่อจากรอบหกสิบสี่ (พจนานุกรมเลข) · เจ้าของสั่ง *"ข้ามไปก่อน ทำ B/C/D ต่อเลย"*
(ข้ามการตรวจบนจอเพราะเบราว์เซอร์หลุดล็อกอิน)

#### C — แถบ ✓ บน CommandDeck **โกหก** (อันดับ 1 ของสามข้อที่ทำร้ายคนใหม่สุด)

เดิมแถบ 6 ขั้นใต้พาดหัวติ๊กถูก (`<Check/>`) ทุกขั้นที่ `step < head.step` เพราะเขียนเป็น
stepper ⇒ งานด่วนวันนี้อยู่ขั้น 5 ⇒ จอติ๊กถูกขั้น 1-4 ⇒ คนใหม่อ่านว่า **"ใบขอ/ประกาศรับ/
ผู้สมัคร/จับคู่ เสร็จหมดแล้ว"** ทั้งที่บอร์ดใต้ลงมาบอก ยังไม่ประกาศ 123 ใบ · ยังไม่มีใครสมัคร 298 ใบ
⇒ **ถอด `Check` ทิ้ง · ขั้นก่อนหน้าเป็นเลขจาง ๆ · เส้นเชื่อมจางเท่ากันหมด** (เส้นทึบถึงขั้นนี้
คือภาษาของ progress bar) + เพิ่มบรรทัดกำกับ *"แถบนี้บอกตำแหน่งเฉย ๆ ไม่ได้แปลว่า
ขั้นก่อนหน้าทำเสร็จแล้ว"*

#### B — ภาษาชุดเดียว

| ที่ | เดิม | ใหม่ |
|---|---|---|
| `/jobs/list` | หัวเขียน "หน่วยงาน" | `conveyorLabel('requests')` = **ใบขอ** |
| `/matching/match` | "Matching — คนของเรา" | `conveyorLabel('matching')` = **จับคู่ & โทร** |
| `/follow` | "Follow" | `conveyorLabel('follow')` = **ติดตาม** |
| `/jobs/board` | "งานสรรหา" **หัวเดียวทั้งขั้น 2 และ 3** | เปลี่ยนตาม `?view=` → **ประกาศรับ** / **ผู้สมัคร** · eyebrow → "บอร์ดรับสมัคร · เจ้าหน้าที่" |
| หน้า Follow ผลโทร | พ่นรหัสดิบ `(declined)` `(wrong_person)` `(reschedule_requested)` `(unresponsive)` `(busy)` `(confirmed)` `(acknowledged)` | `callOutcomeText()` อ่านจาก **`CALL_OUTCOME_LABEL` ที่มีคำไทยครบอยู่แล้ว** · รหัสที่ไม่รู้จักคืนรหัสเดิม (ห้ามซ่อน) |

🔴 `conveyorLabel(key)` ใหม่ใน `soRecruitNav` = **แหล่งเดียวของชื่อขั้น** ทั้งเมนูและหัวหน้า

#### D — ปุ่ม/แถวพูดความจริง

- **แถวตารางใบขอ 299 แถวกดได้แต่ไม่มีสัญญาณ** → เพิ่ม `title` + `<ChevronRight>` จาง
  ท้ายเลขที่ใบขอ (แพตเทิร์นเดียวกับบอร์ดทีมหน้าแรกที่ทำถูกอยู่แล้ว)
- **ปุ่มบนหน้าคำขอโพสต์อ่านเหมือนป้ายสถานะ** → "โพสแล้ว/ตรวจรับแล้ว/ได้คนแล้ว"
  เป็น **"บันทึกว่าโพสแล้ว / บันทึกว่าตรวจรับแล้ว / บันทึกว่าได้คนแล้ว"**
  (อยู่แถวเดียวกับ "ยกเลิก" ⇒ เดิมคนใหม่ไม่กล้ากดหรือกดผิด)
- **ปุ่ม "เสร็จสิ้น" บนการ์ด Follow** → เพิ่ม `title` ว่ากดแล้ว**ยังไม่ปิดทันที** กางให้เลือกเหตุผลก่อน

⚠️ **ข้อที่ audit รายงานเกินจริง — แก้ไว้ที่นี่:** ปุ่ม "ส่ง AI โทร" **มีป๊อปยืนยันรายชื่ออยู่แล้ว**
(`CallChoiceConfirmDialog` · กติกาเจ้าของ Phase 5.12) ไม่ใช่ปุ่มที่ยิงสายทันทีอย่างที่รายงานไว้

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/soRecruitNav.ts` | เพิ่ม `conveyorLabel(key)` — แหล่งเดียวของชื่อขั้น |
| `src/components/home/CommandDeck.tsx` | ถอด `Check` + เส้นทึบ · เพิ่มบรรทัดกำกับว่าแถบนี้ไม่ใช่ progress |
| `src/pages/jobs/JobListPage.tsx` | หัว = `conveyorLabel('requests')` · แถวมี title + ChevronRight |
| `src/pages/matching/MatchingPage.tsx` · `src/pages/follow/FollowPage.tsx` | หัว = `conveyorLabel(...)` |
| `src/components/jobs/JobBoardView.tsx` | หัวเปลี่ยนตาม `?view=` |
| `src/pages/follow/FollowPage.tsx` | `callOutcomeText()` แปลผลโทรเป็นไทย |
| `src/pages/matching/JobPostingsPage.tsx` | ป้ายปุ่มเป็นคำสั่ง ไม่ใช่ชื่อสถานะ |
| `src/components/follow/FollowCompleteControls.tsx` | `title` บอกว่ากดแล้วยังไม่ปิดทันที |
| `tests/api/pageTitleParity.test.ts` | **ใหม่** 7 เทสต์ — ด่านสแกนห้ามพิมพ์ชื่อขั้นเป็นสตริงตายในหัวหน้า + ห้ามพ่นรหัสผลโทรดิบ |

**ด่านตรวจ:** test **2,325 ผ่าน / 6 skip (220 ไฟล์)** · tsc 4 = 0 · eslint 0 err / 18 warn
⚠️ **ยังไม่ได้ตรวจบนจอจริงทั้งรอบ 64 และ 65** — รอเจ้าของล็อกอินที่ 53322

---

### รอบหกสิบหก · 26 ส.ค. 2569 — 🔴 **"ทำให้ได้ 10/10" — ปิดหนี้ที่เหลือจาก audit ทั้งหมด**

เจ้าของสั่งสั้น ๆ ว่า *"ทำให้ได้ 10/10"* หลังเห็นคะแนน 7.5 / 6 / 6.5 / 7
⇒ ไล่ปิดทุกข้อที่ audit จับได้ ยกเว้นด้าน visual ที่เป็นรสนิยม (แจ้งเจ้าของแล้ว)

#### บั๊ก: หน้า Follow มี "ทั้งหมด" สามค่าที่ไม่ตรงกัน — เจอต้นเหตุจริง

🔴 **`FollowCallRoundsPanel` ยิง `listFollowEntries()` เป็นของตัวเองอีกชุด**
คนละก้อนกับที่ `FollowPage` โหลด ⇒ ยิงคนละจังหวะ ได้คนละยอด · จอเดียวจึงขึ้น
"ทั้งหมด 11" (แผงรอบ) + "ทั้งหมด 17" (หัว) + "กำลังตาม 12" (แท็บ) พร้อมกัน
⇒ **แผงรับ `entries` เป็น prop เท่านั้น ห้ามโหลดเอง** (มีเทสต์สแกนคุม)
+ ติดป้ายกำกับให้ทั้งสามชุดว่าตอบคนละคำถาม: **"ต้องโทรใครตอนนี้"** ·
**"สถานะสาย"** · **"งานจบหรือยัง"**

#### บั๊ก: การ์ด Follow ขัดกันเอง

- "ครั้งที่ 1" กับ "ติดตาม 3 รอบ" คนละบรรทัด ⇒ รวมเป็น **"วันนี้คือรอบที่ 1 จาก 3 รอบ"**
- "ไม่มีนัดโทรข้างหน้าแล้ว" คู่กับป้าย "รอ AI โทร" ⇒ เพิ่ม **`overdueRound`** ใน
  `followGrouping` (รอบที่เลยเวลาแล้วยังไม่มีผล) · การ์ดเขียน "เลยเวลานัดแล้ว (นัดไว้ …)"
  🔴 บทเรียน: **ของค้างต้องมีที่ยืน** — เดิมตกทั้ง `nextRound` และทุกช่อง เลยหายเงียบ

#### landingGap 10 → 1 จุด

| จุด | ปิดยังไง |
|---|---|
| Content/Scraping 6 จุด | หน้าคำขอโพสต์ได้ตัวเลือก **"เฉพาะใบขอที่ยังเปิดอยู่" เป็นค่าตั้งต้น** (เท่าหน้าแรก) + บอกว่าซ่อนไปกี่ใบ |
| `recruit.jobs_with_apps` / `jobs_without_apps` | เพิ่มแถบ **"ผู้สมัคร · มีคนสมัครแล้ว N · ยังไม่มีใครสมัคร M"** เหนือกล่องงานบนบอร์ด (คู่กับแถบหน้าสาธารณะเดิม) |
| `recruit.apps_contacted` | 🔴 `office-team` เลิกเขียน union เอง → ใช้ **`OVERVIEW_BUCKETS.called`** ตัวเดียวกับหน้าปลายทาง (กติกาข้อ 2 ของ office-floor ห้ามไว้อยู่แล้ว แต่เส้นนี้ละเมิด) |
| `closing.queue_pending` | **เหลือไว้ 1 จุด — รอเจ้าของเคาะ**: office-floor นับทั้งคิวของบริษัท ส่วนหน้าจับคู่กรองตามสิทธิ์ BU · แก้แล้วกระทบเลขหน้าแรกทุกตัว จึงไม่ตัดสินใจเอง |

🔴 **เพดานเทสต์ลดจาก 10 → 1 แล้ว ห้ามเพิ่ม**

#### คนใช้ไม่งง

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/glossary.ts` | **ใหม่** — ศัพท์ในบ้าน 23 คำ (`term` / `meaning` / `notThis`) · Lumos · OPL · Lead · สรรหา-คัดสรร · Scraping · Content · iRecruit · SLA · ERP · คนเขียว · กองไม่สนใจ · BU · รอดาต้า · เลขที่ใบขอ · ผ่านมา · คงเหลือ · ส่งคนแทน · สถานะทำงาน · จ่ายรายวัน · ดูแลหลังเริ่มงาน · Follow · ปล่อยขึ้นหน้าสมัคร · เก็บไปโทรเอง |
| `src/components/shared/Term.tsx` | **ใหม่** — `<Term k="lumos" />` เส้นใต้จุด + tooltip · ห้ามทำเป็นลิงก์สีฟ้าเพราะกดไม่ได้ |
| `src/lib/incomeLabel.ts` | **ใหม่** — `incomeDisplay()` เลือกหน่วย · 🔴 **ไม่รู้หน่วยห้ามเดา** คืน `period: 'unknown'` + คำเตือน (ใบรายวันมีจริง 20/200 ใบ · "400 บาท" ข้าง "45,000 บาท" ทำคนใหม่อ่านว่าเงินเดือน 400) |
| `TeamBoardPanel` · `JobListPage` · `MatchingPage` | แปะ `<Term>` บนหัวคอลัมน์/หัวกลุ่ม/ชื่อทีม Lumos |
| `MatchingPage` | ศัพท์ใน `<select>` ใส่ tooltip ไม่ได้ ⇒ **เปลี่ยนคำ**: "SLA / ด่วนก่อน" → "เลยกำหนดและงานด่วนก่อน" · "คนเขียวมากสุดก่อน" → "ใบที่มีคนตรงสเปกมากสุดก่อน" |
| `JobPostingsPage` | `genderText()` แปล M/F/O เป็นไทย · วันที่ต้องการเป็น พ.ศ. (เดิม ISO ดิบปนที่เดียว) · **ป้าย "ทดลอง"** บนชุด DEMO (ดูจาก `job_id` ที่ไม่ใช่ `siamraj-sql:`/`pre:`/`sql:`) — ติดป้าย ไม่ซ่อน |

#### ใช้งานง่าย

- **`JobListPage` ตัวกรอง 13 ช่องหุบเป็นค่าตั้งต้น** — เดิมกินจอแรกทั้งหน้า ตารางอยู่ใต้ fold
  คนใหม่เปิดมาไม่เห็นงานสักใบ · หัวกล่องบอก "เลือกอยู่ N" หรือ "แสดงทุกใบอยู่"
  ⚠️ **มีตัวกรองติดอยู่ = กางเอง** ไม่งั้นเลขน้อยลงโดยไม่มีอะไรบอกสาเหตุ
  (`activeFilterCount` ไม่นับแผนกที่ถูกล็อกด้วยสิทธิ์ — ผู้ใช้ไม่ได้เลือกเองและปลดไม่ได้)

#### ที่ **ไม่** แตะโดยตั้งใจ

- **แผงดำบนหน้าจับคู่** (`PageHeroStrip`) — เป็นภาษาดีไซน์ที่เจ้าของเคยบอกว่าชอบ
  ("เข้มใบเดียวบนพื้นสว่าง") ไม่ใช่ความไม่สม่ำเสมอ · **ห้ามเปลี่ยนเองเด็ดขาด**
- **เบอร์ "โทรกลับ" ที่ดูสลับกันบนการ์ด ปิติศักดิ์ 2 ใบ** — เป็น `staff_phone` ที่คนคีย์
  กรอกไว้ (ข้อมูล ไม่ใช่โค้ด) · การ์ดสองใบคือเบอร์ผู้รับคนละเบอร์จึงเป็นคนละกลุ่มถูกแล้ว

| ไฟล์เทสต์ใหม่ | คุมอะไร |
|---|---|
| `tests/api/glossaryAndIncome.test.ts` | ศัพท์ครบ+อ่านรู้เรื่อง · หน่วยเงินไม่เดา · หน้าคำขอโพสต์ไม่พ่นค่าดิบ · แผง Follow ไม่โหลดเอง |
| `tests/api/followGrouping.test.ts` | เพิ่ม 3 เทสต์ของ `overdueRound` |

**ด่านตรวจ:** test **2,362 ผ่าน / 6 skip (221 ไฟล์)** · tsc 4 = 0 · eslint 0 err / 18 warn
⚠️ **ยังไม่ได้ตรวจบนจอจริงทั้งรอบ 64–66** — เบราว์เซอร์หลุดล็อกอิน (Claude กรอกรหัสผ่านแทนไม่ได้)

---

### รอบหกสิบเจ็ด · 27 ส.ค. 2569 — **admin_phone เลน Follow · เมนู Burger · รายได้จริงเปลี่ยนเป็นยอด eSlip**

#### 1. `admin_phone` ในเลน Follow

เดิมมีแต่เลนสัมภาษณ์ (`resolveInterviewAdminPhone` ที่สายอื่นเพิ่ง merge เข้ามา)
ลำดับหาเบอร์ของเลน Follow: **`entry.staffPhone` ที่คนกรอกเลือกไว้กับรายการนั้น**
(เจาะจงเอง มาก่อนเสมอ) → `resolveInterviewAdminPhone(null)` → **ไม่มี = ไม่ส่งคีย์**
🔴 คนละช่องกับเบอร์ที่ AI **พูด**ให้โทรกลับ (อันนั้นอยู่ใน `steps[].message`) —
`admin_phone` คือเบอร์ที่ **AI โทรไปหา** เมื่อติดต่อผู้รับไม่ได้ · มีเทสต์คุมไม่ให้ทับกัน

#### 2-3. เมนู

- `CONVEYOR_HOME.label` **"วันนี้" → "หน้าหลัก"**
- เพิ่ม **"กล่องงาน"** (`/jobs/board` ไม่มี `?view=`) เข้ากลุ่ม **คลังข้อมูล**
  (เจ้าของทัก: *"ใน Menu ไม่เห็นมีคำไหนที่บอกว่าจะพาไปหน้ากล่องงานเลย"*)
  🔴 **เทสต์ที่เขียนคู่กันจับบั๊กได้ทันที**: `/jobs/board` เปล่า ๆ เคยสว่าง**ทั้ง**
  กล่องงานและขั้น 3 เพราะ `stepScore` ตั้ง default view เป็น `'list'`
  (ตอนนั้นยังไม่มีเมนูของกล่องงาน เลยยืมขั้น 3 เป็นทางเข้า) ⇒ เปลี่ยน default เป็น
  `'board'` ซึ่งไม่มีขั้นไหนเป็นเจ้าของ · `isVaultActive` รับ `search` เพิ่ม

#### 5. เมนูกลับเป็น Burger

*"หน้า Menu ทำเป็น Burger ไว้แบบเดิมเพราะมันจะได้ไม่กินพื้นที่"*
⇒ **ลบ `ConveyorSidebar.tsx`** และถอดออกจาก `AppLayout` · เมนูสายพานชุดเดียวกัน
อยู่ใน `AppNavDrawer` อยู่แล้วทั้งจอเล็กจอใหญ่ · ปุ่ม burger มีบนหัวทั้งสองขนาด
⇒ **ได้พื้นที่คืน 240px** · ระยะขอบ lg กลับไป `px-8` (ที่หด `px-6` ไว้เพราะแถบเมนูกินที่)

#### 4. 🔴🔴 รายได้จริง 3 งวด — ย้ายแหล่งจาก "เตรียมจ่าย" ไป "จ่ายจริง (eSlip)"

เจ้าของทัก *"เหมือนมันไม่ตรงนะ"* → ไล่ ERP จนถึงชื่อเมนู

**แหล่งเดิม** `wg2_ppayment_*` (เตรียมจ่าย) = **ยอดรวมทุกบรรทัดก่อนหักอะไรเลย**
**แหล่งใหม่** `wg2_payment_head` + `wg2_payment_tax` (จ่ายจริง) = **เงินได้ − เงินหัก = สุทธิ**
เจ้าของเคาะ: *"เอายอด eSlip เพราะต้องการยอดที่เขารับจริง ๆ ของ Site นั้น ๆ ด้วย"*

| สิ่งที่วัดจริง | ผล |
|---|---|
| `wg2_payment_head` | 1,803,541 ใบ · **payment_no ไม่ซ้ำเลย** = 1 คน + 1 ไซต์ + 1 งวด |
| `wg2_payment_tax` | 1:1 กับ payment_no |
| สุทธิติดลบ / `seq_paid` null | **0 / 0** (จาก 108,609 แถวปีนี้) |
| ความครอบคลุม (กรองไซต์) | ครบ 3 งวด **13,308** · 1-2 งวด 2,992 · ไม่มีเลย 413 |

**เหตุที่เลขเคยเพี้ยน (วัดครบ 4 ข้อ):**
1. 🔴 **ไม่กรอง site_code** — 22,946/39,041 คน (59%) มีงวดข้ามไซต์ ⇒ เอาเงินงานอื่นมาโชว์
2. 🔴 **"3 งวด" ≠ "3 เดือน"** — งวดครึ่งเดือน 71,542 vs เต็มเดือน 31,876 ⇒ 69% เป็นครึ่งเดือน
   (เจ้าของเลือกคงเป็น 3 งวด แต่ให้จอเขียนที่มาชัด)
3. ยอดเดิมเป็น**ก่อนหัก** ⇒ สูงกว่าที่เขารับจริง
4. `st_request_staff` join ไม่ dedup — 73 ใบขอมีคนมากกว่า 1 (ยังไม่แก้)

**เมนู ERP ที่เอาไปทานเลขได้** (ค้นจาก `xprogram`):
`PR-4813` ใบแจ้งเงินเดือน/eSlip ← **ตรงกับของใหม่** · `PR-3001` View การจ่ายค่าแรง [รายคน]
และ `PR-5012` ← ตรงกับของ**เดิม** (ก่อนหัก) · `PR-2610` คือขั้นที่ตีธงว่าจ่ายแล้ว

#### 🔴 กับดักที่เจอรอบนี้ (จดไว้กันซ้ำ)

- **`wg2_ms_fee` คีย์ 4 คอลัมน์** (`withdraw_type_code` + `income1_code` + `income2_code`
  + `fee_code`) **ไม่ใช่ `fee_code` เดี่ยว ๆ** — join ผิดแล้วแถวคูณ 2-3 เท่า
  ⚠️ ผมเคยรายงานเจ้าของผิดว่า "มีบรรทัดค่าแรงหักเกินปนอยู่ในยอด" ซึ่งเป็น artifact
  ของ join ผิด · **join ถูกแล้วทุกบรรทัดเป็นบวกหมด (ต่ำสุด 1 บาท)**
- **`app_eslip_head` มีข้อมูลแค่ 3 แถว 1 คน** = ตารางเปล่า/ตัวทดลอง ดึงสุทธิจากที่นั่นไม่ได้
- 🔴 **backtick ในคอมเมนต์ SQL ปิด template literal** — เจอซ้ำรอบที่สอง (ครั้งแรกรอบ 64)
  เขียนคอมเมนต์ยาวใน SQL ต้องไม่มี backtick เด็ดขาด

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/lumosDispatch.ts` | `LumosReminderPayload` เพิ่ม `admin_phone` · `buildFollowReminderPayload` รับ adminPhone · `enqueueFollowReminder` หาเบอร์ |
| `api/_lib/siamrajSqlServerRequests.ts` | คิวรี PAY3 ย้ายไป `wg2_payment_head` + `wg2_payment_tax` · กรอง site_code · คืน pay/ded/net |
| `src/types/index.ts` | `ResignedIncomeMonth` เปลี่ยน `draw` → `deduct` + `net` |
| `src/lib/unitRequestDetail.ts` | `hasDrawSide` → `hasDeductSide` · แถวมี deduct/net |
| `src/pages/jobs/SiamrajUnitRequestDetailPage.tsx` | ตาราง งวด/เงินได้/หัก/**สุทธิ** + บอกที่มาชี้เมนู PR-4813 |
| `src/lib/soRecruitNav.ts` | `หน้าหลัก` · `กล่องงาน` · `isVaultActive(…, search)` · `stepScore` default `'board'` |
| `src/components/layout/ConveyorSidebar.tsx` | **ลบ** |
| `src/components/layout/AppLayout.tsx` · `AppNavDrawer.tsx` | ถอด sidebar · `isVaultActive` ส่ง search |
| `tests/api/followSchedulePayload.test.ts` · `soRecruitNav.test.ts` · `unitRequestDetail.test.ts` | เทสต์ของทั้งสามเรื่อง |

**ด่านตรวจ:** test **2,386 ผ่าน / 6 skip (222 ไฟล์)** · tsc 4 = 0 · eslint 0 err / 18 warn · **build ผ่าน**
⚠️ **ยังไม่ได้ตรวจบนจอจริง** — เจ้าของสั่ง commit & push เลย

---

### รอบหกสิบแปด · 27 ส.ค. 2569 — **แถบ "ตัวเลขวันนี้" เลิกหุบ + เปลี่ยนเป็นโทนสว่าง**

เจ้าของสั่ง: *"ซ่อนตัวเลขวันนี้ ข้อมูลในกล่องนี้เอาขึ้นมาโชว์เลยไม่ต้องคอยกดซ่อน
และแก้สีเป็น Tone สว่างด้วย"* + ถามว่า *"ข้อมูลมันเฉพาะวันนี้หรอหรือตลอด"*

- **ถอดปุ่ม "ดูตัวเลขวันนี้" ทิ้ง** (พร้อม state `overviewOpen`) — แถบโชว์ตลอด
- **`HomeKpiRow` เลิกใช้ชุด `HUD`** ซึ่งเป็นแผง ink เข้มทั้งสองธีมโดยตั้งใจ
  ⇒ กลายเป็นแถบดำโดดกลางหน้าแรกที่สว่างทั้งหน้า · เปลี่ยนมาใช้ `DASH`/`TONE`
  ที่มีคู่ light/dark ครบ (คลาสกลาง `CARD`/`LABEL`/`FIGURE`/`UNIT` ในไฟล์นั้น)
  🔴 **ห้ามแก้ด้วยการเติม `dark:` เข้าชุด HUD_*** — เทสต์ designTokens ห้ามไว้
  (HUD ตั้งใจให้เข้มเท่ากันสองธีม · `HUD_DARK_EXEMPT_KEYS` ยกเว้นทั้งชุด)

#### 🔴 คำตอบเรื่อง "วันนี้หรือตลอด" — **ปนกัน ต้องเขียนบนจอ**

| การ์ด | เป็นอะไร |
|---|---|
| **ใบขอที่ยังเปิดรับ** (ใบแรก · `buildOpenRequestsCard`) | **ยอดคงค้างตอนนี้** ไม่ใช่ของวันนี้ |
| อีก 8 ใบ (`META` ใน `homeKpi.ts`) | **เหตุการณ์ของวันนี้ เทียบเมื่อวาน** |

เหตุที่ปน: ระบบ**ไม่เก็บ snapshot รายวัน** ⇒ ตัวที่เป็น "สถานะปัจจุบัน" เทียบวันต่อวันไม่ได้
(กติกาข้อ 1 ใน `homeKpi.ts`) · หัวข้อบนจอจึงเขียนกำกับว่าใบไหนเป็นยอดสะสม
และการ์ดใบนั้นเขียนท้ายว่า "ยอดคงค้างตอนนี้ (ไม่ใช่ของวันนี้)"

**ตรวจบนจอจริงแล้ว** — แถบขาวทั้งแถว · โชว์เลยไม่ต้องกด · ตัวกรองหน่วยธุรกิจยังอยู่
(ทั้งหมด/LBD 190/LML 82/LBA 24/DSL 8/SNJ 3) · วันที่ถ่ายเป็นวันเงียบ การ์ดส่วนใหญ่
ขึ้น "ยังไม่มีวันนี้" ตามกติกาห้ามแปะเลข 0 ตัวโต

ด่าน: test 2,386 / 6 skip · tsc 4 = 0 · eslint 0 err · build ผ่าน

---

### รอบหกสิบแปด · 27 ส.ค. 2569 — 🔴 **รื้อหน้ากล่องงานเป็น "เส้นเดียว" + แก้บทพูด AI จากหน้าตั้งค่า**

#### งาน A — เส้นทางงานบนหน้ากล่องงาน (สั่ง 3 รอบ ปรับ 3 ครั้ง)

| รอบ | เจ้าของสั่ง | ผลลัพธ์ |
|---|---|---|
| 1 | *"ทำให้มันไหลเป็นเส้น: ใบขอมา > ตรวจทาน > แก้ไข > GenLink > ขึ้นสาธารณะ / กรอกมา > Lumos โทร > แยกผลลัพธ์"* | ทำ 2 เส้น 8 ขั้น (แบบสะสม — ใบอยู่ได้หลายขั้น) |
| 2 | *"หน้ากล่องงานขอถึงแค่ขึ้นหน้าสาธารณะ แล้วบอกตัวเลขที่กรอกเข้ามาด้วยก็ดี"* | ตัดเส้นโทรทิ้ง เหลือเส้นเดียว 6 ขั้น |
| 3 | *"ตอนนี้หน้ากล่องงานเยอะแยะเละเทะไปหมด ไอ้กล่องก็ไม่ได้มารวมกับใบงาน ไม่รู้จะแยกทำไม · คิดสิ นายน่าจะเก่งกว่าฉัน"* | 🔴 **รื้อทั้งหน้า — ยุบ 4 ชั้นเหลือชั้นเดียว** |

🔴 **สิ่งที่ค้นพบตอนรอบ 3 (หัวใจของการยุบ):**
**กล่องสถานะ 6 กล่อง กับ เส้นทาง เป็นเส้นเดียวกัน** — กล่องแรก "กำลังสรรหา" (205 จาก
301 ใบ) เป็นก้อนใหญ่ที่ไม่เคยถูกแตะออก ทั้งที่ข้างในมี 4 สภาพต่างกันสิ้นเชิง
⇒ **แตะกล่องแรกออกเป็น 4 ขั้น แล้ววางต่อท้ายด้วยกล่องที่เหลือ = เส้นเดียวจบ**

**เส้นสุดท้าย (9 ขั้น · ทุกใบอยู่ขั้นเดียว):**
รอตรวจ → รอปล่อยประกาศ → รอคนสมัคร → มีคนสมัครแล้ว → กำลังคัดเลือก →
รอแจ้งเข้า/รอเริ่มงาน → เริ่มงานแล้ว → ปิดแล้ว → ยกเลิก

✅ **ผลรวมทุกขั้นของใบเปิด = จำนวนใบทั้งหมดเป๊ะ** (วัดจริง 100+1+103+1+28+57+11 = 301)
นี่คือสิ่งที่ของเดิมทำไม่ได้ — 4 ชั้นเดิมเลขซ้อนกันจนบวกไม่ลงตัว **มีเทสต์คุมข้อนี้**

**ถอดออก 3 ชุด** (ทั้งหมดพูดเลขเดียวกับขั้นบนเส้น):
- กล่องสถานะ 6 กล่อง (`OPEN_BOX_KEYS`/`CLOSED_BOX_KEYS` UI) → กลายเป็นขั้นท้ายเส้น
- แถบ "หน้าสาธารณะ · ปล่อยแล้ว 176 / ยังไม่ปล่อย 125"
- แถบ "ผู้สมัคร · มีคนสมัครแล้ว 1 / ยังไม่มีใครสมัคร 300"
⚠️ **ปุ่ม "ปล่อยทั้งหน้านี้" ไม่หาย** — ย้ายไปท้ายแถบเส้นทาง

🔴 **`openBox` ไม่มี state ของตัวเองแล้ว** — `closedBox` อนุมานจาก `stage`
(`stage === 'closed'|'cancelled'`) · `openBoxKey` เป็น `null` ถาวร
`initialBox` ที่ลิงก์เก่าส่งมาแปลงเป็นขั้นตั้งต้นให้

**นิยาม "รอตรวจ" ที่เจ้าของให้เอง:** *"ก็แค่ตรวจดูอะ ไม่มีอะไรก็ไปต่อ มีก็แจ้งไว้ว่าติดอะไร"*
⇒ **ไม่มีปุ่ม "ตรวจแล้ว"** · ใบหลุดออกจากถังเองเมื่อมันเดินต่อ · "ติดอะไร" ใช้ช่องหมายเหตุเดิม

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/boardFlow.ts` | **ใหม่** — `openJobStage()` (ตอบขั้นเดียวต่อใบ) · `buildBoardStages()` · `isEdited/hasNote/isUntouchedReview` · `BOARD_STAGE_ORDER` |
| `src/components/jobs/BoardFlowStrip.tsx` | **ใหม่** — แถบเส้น + ปุ่มลงมือท้ายเส้น + บรรทัดสรุป "บวกทุกขั้นแล้วครบพอดี" |
| `src/components/jobs/JobBoardView.tsx` | ถอด UI 3 ชุด · `stage` แทน `openBox` · หัวหน้าเป็น "กล่องงาน" เมื่อไม่มี `?view=` |
| `tests/api/boardFlow.test.ts` | **ใหม่** 14 เทสต์ — เน้นข้อ "ผลรวมทุกขั้น = ใบทั้งหมด" |

#### งาน B — แก้บทพูด AI จากหน้าตั้งค่า

เจ้าของสั่ง: *"เพิ่มที่ให้สร้าง Script ไว้หน่อยสิ ฉันแก้ Script การพูดจากฝั่งฉัน
แล้วให้มันส่งไปพร้อมกันให้ Lumos เลย สร้างไว้หน้าตั้งค่าก็ได้"* → **เอาทั้ง 3 ชุด**

**การไหล:** หน้าตั้งค่า → `PUT /api/call-scripts` → ตาราง `call_script_overrides` →
`ensureCallScriptsFresh()` (cache 30 วิ) → `setCallScriptOverrides()` ใน `lumosCallScript`
→ ประกอบ payload ⇒ **มีผลกับสายที่เข้าคิวหลังบันทึกทันที ไม่ต้อง deploy**

🔴 **`lumosCallScript.ts` ยัง pure** — ไม่แตะ DB เอง แค่อ่านค่าที่ถูก "วาง" ไว้
⇒ เทสต์เดิมทั้งชุดผ่านโดยไม่ต้องรู้จักฟีเจอร์นี้ · **ลบแถวใน DB = กลับบทมาตรฐานทันที**

**กติกาที่ validate กันไว้** (ทั้งฝั่ง API และก่อนวางใช้):
ห้ามเกิน 14 ข้อ · ห้ามว่างทั้งชุด · **ห้ามพิมพ์ตัวเลขเงินเอง** (ค่าแรงมีทั้งรายวัน/รายเดือน
ระบบเติมให้ผ่าน `{รายได้ต่อเดือน}`) · **ตัวแปรต้องอยู่ใน `KNOWN_PLACEHOLDERS`**
(พิมพ์ผิดตัวเดียว = ทั้งบรรทัดหายตอนโทรจริง)

⚠️ `ensureCallScriptsFresh()` ถูกเรียกที่ **7 จุด** (ทุก `enqueue*` + `refreshFollowReminderPayload`)
· โหลดล้ม **ห้าม throw** — สายต้องออกได้เสมอ

| ไฟล์ | ทำอะไร |
|---|---|
| `migrations/111_call_script_overrides.sql` | **รันบนฐานจริงแล้ว** — ตารางเก็บบทฉบับแก้ |
| `api/_lib/callScriptStore.ts` | **ใหม่** — โหลด/cache/validate + `invalidateCallScriptCache()` |
| `api/_lib/lumosCallScript.ts` | เพิ่ม `EDITABLE_SCRIPT_DEFAULTS` · `setCallScriptOverrides()` · `activeScriptLines()` · 3 จุดที่ประกอบบทเปลี่ยนไปอ่านจากตัวนี้ |
| `api/_handlers/call-scripts.ts` | **ใหม่** — GET/PUT/DELETE · PUT/DELETE ต้อง supervisor+ |
| `src/pages/settings/CallScriptsTab.tsx` | **ใหม่** — แก้ทีละประโยค · เพิ่ม/ลบ · คืนบทมาตรฐาน · รายการตัวแปร |
| `src/lib/settingsNav.ts` | เพิ่มแท็บ `callScripts` (แท็บที่ 13) |

#### 🔴 กับดักที่เจอรอบนี้

1. **`readJsonBody` ของ DELETE คืน `null`** — body ของ DELETE ถูกกลืนระหว่างทาง
   ⇒ **DELETE ต้องรับ key ทาง query string** (`?key=follow`) · เจอตอนยิงเขียนจริง
   ไม่ใช่ตอน tsc/เทสต์ — **ย้ำบทเรียนเดิม: ต้องยิงเส้นเขียนจริงเสมอ**
2. **regex ฉีดโค้ดกลางลายเซ็นฟังก์ชันหลายบรรทัด** — `ensureCallScriptsFresh()` ไปโผล่
   กลาง `selected: Array<{` · ต้องยึด anchor ที่บรรทัดแรกของ body ไม่ใช่ `{` ตัวแรก
3. **เทสต์นับแท็บตายตัว** (`toBe(12)`) แตกเมื่อเพิ่มแท็บ — อัปเป็น 13
4. **เทสต์อ้าง `CONVEYOR_VAULT[0]` ตามตำแหน่ง** แตกเมื่อแทรกรายการใหม่ ⇒ เปลี่ยนเป็นหาด้วยคีย์

**ด่านตรวจ:** test **2,410 ผ่าน / 6 skip (224 ไฟล์)** · tsc 4 = 0 · eslint 0 err / 18 warn
**ตรวจบนจอจริงแล้วทั้งสองงาน** — เส้นทางกดกรองได้ทุกขั้น เลขบวกลงตัว · บทพูดบันทึก/คืนค่าได้จริง
⚠️ **ยังไม่ได้ commit ทั้งสองงาน** — เจ้าของยังไม่เคาะชื่อขั้นบนเส้น

---

### รอบหกสิบเก้า · 27 ส.ค. 2569 — 🔴 **หน้ากล่องงานเลิกเด้งป๊อป — กดแล้ว "ไปหน้า" ทุกที่**

เจ้าของสั่ง: *"หน้ากล่องงานต้องโชว์พวกนี้ พอกดแล้วก็พาไปดูข้อมูล ไม่เอาแบบ Popup เด้งนะ"*

#### สิ่งที่หายไป: ป๊อปอัป 3 ขั้นของการ์ด (รายละเอียดงาน → แก้ไข → Gen link)

ป๊อปนั้นยาว ~410 บรรทัดใน `JobBoardView.tsx` และเป็น **บ้านหลังเดียว** ของ 5 อย่าง
⇒ ลบทิ้งเฉย ๆ ไม่ได้ ต้องย้ายให้ครบก่อน:

| ของในป๊อป | บ้านใหม่ |
|---|---|
| ปล่อย / ดึงลง หน้าสาธารณะ (ทีละใบ) | แท็บ "ประกาศ / ลิงก์สมัคร" ของใบขอ |
| แก้ข้อความประกาศ (`EditPostingDialog`) | แท็บเดียวกัน — ฝังในหน้า ไม่ห่อ Dialog |
| แก้ข้อมูลที่จะขึ้นประกาศ (`EditPublicJobFieldsDialog`) | แท็บเดียวกัน |
| Gen link (`GenApplyLinkDialog`) | แท็บเดียวกัน |
| ประวัติการแก้ไข "ใครแก้อะไรไป" | แท็บเดียวกัน (`UnitEditLogSection` — component ใหม่) |
| รายละเอียดงาน (เนื้อในป๊อป) | หน้ารายละเอียดใบขอตัวจริงที่มีอยู่แล้ว |

🔴 **นี่ปิดหนี้ "ชื่อหน้าซ้อน 3 ชั้น" ไปด้วย** — เดิมรายละเอียดใบขอมีสองที่
(ป๊อปบนบอร์ด + หน้าใบขอ) เนื้อไม่เท่ากัน · ตอนนี้เหลือที่เดียว

#### กดอะไรไปไหน (ทั้งหมด "เปลี่ยนหน้า" ไม่มีป๊อป)

| กดที่ | ไปที่ |
|---|---|
| การ์ดใบขอ | `/jobs/siamraj/:id` — รายละเอียดงาน |
| ปุ่ม "ดูรายชื่อ" | `/jobs/siamraj/:id/applicants` |
| แถวในแถบลิงก์เงียบ | `/jobs/siamraj/:id` |
| ปุ่ม "แก้ประกาศ" / "เพิ่มช่องทาง" ในแถบลิงก์เงียบ | `/jobs/siamraj/:id/posting` |

⚠️ **ปุ่ม "หาคนทุกกอง + ให้ AI โทร" ยังเป็นป๊อปอยู่ — โดยตั้งใจ** ป๊อปนั้นไม่ใช่
"ดูข้อมูล" แต่เป็น **ป๊อปยืนยันก่อนยิงสายจริง** (กติกา: ทุกเส้นที่โทรหาคนจริง
ต้องมีป๊อปยืนยัน) · เอาออกแล้วจะกดปุ่มเดียวโทรหาคนจริงทันที

🔴 **ทุกการนำทางต้องผ่าน `navigateToUnitRequest()` / `unitRequestTabPath()`**
ห้ามประกอบ `/jobs/siamraj/${id}/...` เอง — ใบขอล่วงหน้าจะหลุด prefix `siamraj-pre:`
แล้ว**เปิดผิดบริษัท** (บั๊กจริง 18 ส.ค. 2569 · คราวนี้จะเป็นทุกแท็บ) มีเทสต์คุม 4 ข้อ
✅ ตรวจบนจอจริงกับใบล่วงหน้า `LBM6908001` แล้ว — ได้ "อีซูซุมอเตอร์" ถูกใบ

#### ขั้นบนเส้นย้ายเข้า URL

`?stage=review` … `?stage=cancelled` — เดิมเป็น `useState` ในหน้า
⇒ ตอนนี้ส่งลิงก์ให้กันได้ · รีเฟรชไม่หาย · **กลับจากหน้าใบขอมาเจอขั้นเดิม**
(นี่คือเหตุผลจริงที่ต้องย้าย — ไม่งั้นกดการ์ดแล้วกดย้อนกลับ ขั้นที่กรองไว้หาย)
· ค่าที่ไม่รู้จักใน URL = ถือว่าไม่ได้เลือกขั้น (ไม่ throw) · ลิงก์เก่า `?view=closed` ยังใช้ได้

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/jobs/UnitRequestPostingTabPage.tsx` | **ใหม่** — แท็บ "ประกาศ / ลิงก์สมัคร" 5 บล็อก |
| `src/components/jobs/UnitEditLogSection.tsx` | **ใหม่** — ประวัติการแก้ไข (ย้ายออกจากป๊อป) |
| `src/lib/jobNavigation.ts` | เพิ่ม `unitRequestTabPath()` + `tab` ใน `navigateToUnitRequest()` |
| `src/components/jobs/UnitRequestTabs.tsx` | เพิ่มแท็บ `posting` (แท็บที่ 2 จาก 5) |
| `src/components/jobs/JobBoardView.tsx` | **ถอดป๊อป 410 บรรทัด** · กดทุกที่ = navigate · `stage` เข้า URL |
| `src/components/jobs/JobBoardSilentLinks.tsx` | `onOpen(job, target)` พาไปหน้า ไม่เปิดป๊อป |
| `src/lib/jobLinkSilence.ts` | `popupTab` → `action` (เหลือหน้าที่เลือกคำ/ไอคอนบนปุ่ม) |
| `src/pages/jobs/UnitRequestTabPage.tsx` | prop แคบลงเป็น `UnitRequestSubTab` (ไม่รับ `posting`) |
| `src/App.tsx` | route `/jobs/siamraj/:id/posting` |
| `tests/api/jobNavigationPath.test.ts` | +4 เทสต์ — แท็บต้องพก prefix ใบล่วงหน้า |
| `tests/api/jobLinkSilence.test.ts` | ตามชื่อฟิลด์ใหม่ |

#### 🔴 กับดักที่เจอรอบนี้

1. **ปุ่ม "ยกเลิก" ในฟอร์มที่ฝังกลายเป็นปุ่มตาย** — ฟอร์มพวกนี้เกิดมาเพื่ออยู่ในป๊อป
   `onClose` = "ปิดกล่อง" · ฝังในหน้าแล้วถ้าส่ง `() => undefined` ไป กดแล้วไม่เกิดอะไร
   ⇒ ต้องให้ปลายทางจริง (กลับแท็บรายละเอียด)
2. **`RecruitPosting` export จาก `recruitPostings.ts` ไม่ใช่ `recruitPostingsApi.ts`**
3. **console error ค้างจาก HMR หลอกได้** — `selected is not defined` ยังโชว์ทั้งที่คำนั้น
   ไม่มีในไฟล์แล้ว (เป็นของ build เก่าที่ค้างใน buffer) ⇒ ยืนยันด้วยการโหลดใหม่ + อ่าน DOM

**ด่านตรวจ:** test **2,414 ผ่าน / 6 skip (224 ไฟล์)** · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงครบ** — กดการ์ด/ดูรายชื่อ/แก้ประกาศ ไปหน้าจริงทั้งหมด · `?stage=` ติด URL ·
ปุ่มย้อนกลับพากลับขั้นเดิม · **ยิงเส้นเขียนจริงแล้ว** (ดึงลง→ปล่อยกลับ ใบ `OPL6808001` คืนสภาพเดิม)

#### 🔴 กับดักที่ 4 (เจอตอนตรวจจอ — ไฟล์นี้ใช้ร่วมสองหน้า)

**`JobBoardView.tsx` เป็นทั้งกล่องงาน (staff) และหน้าสมัครสาธารณะ `/apply`**
พอเปลี่ยน "กดการ์ด = navigate" แบบไม่แยกหน้า ⇒ **คนนอกกดการ์ดบน `/apply` แล้วเจอหน้าล็อกอิน**
(หน้าใบขอต้องล็อกอิน) ⇒ ต้องแยก: staff = ไปหน้าใบขอ · public = เปิดฟอร์มสมัคร
⚠️ ผลข้างเคียงที่ยอมรับไว้: `/apply` เสียหน้าอ่านรายละเอียด (ป๊อปเดิม) —
การ์ดยังโชว์ตำแหน่ง/สถานที่/รายได้/สวัสดิการ แต่ไม่มีช่วงอายุ/เพศ/ตำบล-อำเภอแยกบรรทัด

**เจอของแถมตอนไล่จอ (ยังไม่แก้ · แยกเป็นงานต่างหาก):**
`/apply` โชว์ **ชื่อคนที่ลาออก** จากตำแหน่งนั้น (`resigned_employee_name` ใน
`jobBoardCardSubtitle()` ไม่ได้กั้น `isStaff` ทั้งที่ฟิลด์ข้าง ๆ กั้นหมด)
วัดจริง: การ์ดขึ้น "ลาออก • ชนิดที่ 2 • สมชัย เอกอนงค์" บนหน้าที่ใครก็เปิดได้

---

### รอบเจ็ดสิบ · 27 ส.ค. 2569 — 🔴 **หน้า login โฉม mockup + หน้ากล่องงาน = "ปล่อยไปแล้วเท่าไหร่"**

#### งาน A — หน้า login: หน้าตาของ `tundralogin_v3.html` การทำงานของเรา

เจ้าของส่งไฟล์ mockup มาให้วิเคราะห์ แล้วสั่ง: *"ถ้าใช้ได้ก็ใช้ แต่อยากให้มีแค่แบบของเรา
เหมือนอยากได้ค่าภาพกับอะไรต่าง ๆ ของเขา แต่การทำงานเป็นแบบเรา"*

🔴 **บทเรียนที่เจ็บ:** รอบแรกผมตีความว่า "ของเรา" = ใช้ภาพของเราเอง จึงสลับภาพป่าเป็นฉาก
ออฟฟิศที่เจ้าของ gen ไว้ แล้วโดน: *"บ้าหรอ จะเอาแบบไฟล์ HTML ที่ส่งให้ดิ
ทำนอกเหนือจากที่สั่งอีกแล้ว"*
⇒ **"หน้าตาของเขา + การทำงานของเรา" หมายถึงหน้าตายกมาเป๊ะ ห้ามตีความว่าอะไรคือ "ของเรา" เอง**
(ตรงกับกติกาเดิม "ห้ามเดา ไม่ชัวร์ให้ถาม" — ผมเดาแล้วผิด)

**ยกมาเป๊ะ:** ภาพป่า Unsplash ตัวเดิม · จานกระดาษ-เขียวป่า · Instrument Sans ·
การ์ดกระจก (blur 28 + saturate 1.28) · ช่องกรอกพื้นขาวโปร่ง · ปุ่มแคปซูลเขียวไล่เฉด ·
เส้น "หรือ" ตัวพิมพ์ใหญ่ · ชั้นฉาก 6 ชั้น · เครดิต Unsplash มุมล่างขวา

**ตัดออกเฉพาะที่เป็น "การทำงาน" ไม่ใช่ "หน้าตา":** แถบเมนูขายของ · "Create an account"
(ระบบ HR สมัครเองไม่ได้) · `autocomplete="off"` (ทั้งบริษัทใช้ตัวจำรหัสผ่าน)

**3 จุดที่ปรับเพราะเป็นบั๊ก ไม่ใช่ดีไซน์** (แจ้งเจ้าของแล้ว):
1. `letter-spacing:-.045em` เป็นค่าของฟอนต์อังกฤษ — ตัวไทยสระ/วรรณยุกต์ทับกัน ⇒ คลายเป็น -0.01em
2. ตัวหนังสือเทาจาง .62 บนพื้นครีมของเขา — ทับภาพป่าที่แสงจัดแล้วจมหาย ⇒ เพิ่ม `sageStrong` + เงาขาว
3. `overflow:hidden` ที่ body — มือถือคีย์บอร์ดเด้งแล้วช่องรหัสตกจอ **เข้าระบบไม่ได้เลย** ⇒ ปลดล็อก
   · เกรนที่ขยับทุก 0.8 วิไม่หยุด ⇒ ทำเป็นภาพนิ่ง (กินแบตเปล่า ๆ)

🔴 **การ์ด "ดูประกาศงาน" ห้ามหาย** — รอบแรกผมยุบเหลือบรรทัดเล็ก ๆ เจ้าของทักทันที
(*"แล้วการ์ด ดูประกาศงานอะ"*) ⇒ กลับมาเป็นการ์ดที่สองข้างการ์ดล็อกอิน
⚠️ ต้อง `items-center` ไม่ใช่ `items-stretch` — บน production เหลือปุ่ม Microsoft ปุ่มเดียว
การ์ดล็อกอินจึงเตี้ยมาก สั่งยืดจะได้กล่องว่างสูงเปล่า ๆ (เจอตอนตรวจจอ)

⚠️ **ตรรกะเข้าระบบไม่ถูกแตะเลย** — retry 3 ครั้ง · `AUTH_ERROR_MESSAGES` ·
`shouldShowPasswordUi` · `returnTo` กัน open redirect ของเดิมทั้งหมด

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/shared/PhotoScene.tsx` | **ใหม่** — ฉาก 6 ชั้นของ mockup |
| `src/lib/designTokens.ts` | เพิ่ม `FRONT_SCENE` — จานสี + URL ภาพของ mockup (แหล่งเดียว) |
| `src/pages/LoginPage.tsx` | เปลือกใหม่ทั้งหมด · ตรรกะเดิม · การ์ดที่สอง |
| `src/index.css` | เพิ่มฟอนต์ Instrument Sans + keyframe `jarvis-breathe` |
| `tests/api/designTokens.test.ts` | +3 เทสต์ — จานสี/ภาพของ mockup ต้องไม่ถูกเปลี่ยนเงียบ ๆ |

#### งาน B — หน้ากล่องงาน: หัวหน้าจอเป็น "ปล่อยไปแล้วเท่าไหร่ เหลืออีกเท่าไหร่"

เจ้าของสั่ง: *"หน้ากล่องงาน รื้อได้นะ · อยากเปิดมาแล้วรู้ว่า อ้อ ตอนนี้มีใบขอเท่านี้นะ
เราปล่อยไปหน้าสาธารณะเท่านี้แล้วนะ เหลืออีกเท่านี้นะ แล้วพอจะปล่อยก็ไปกดดูแล้วก็ตาม
ขั้นตอน 1 2 3 4 แล้วก็ปล่อยไป"* · เคาะขั้น: **ตรวจใบขอ → แก้ข้อมูลประกาศ → สร้างลิงก์ → ปล่อย**

**3 เลนบนหัว — บวกกันครบใบเปิดทั้งหมด** (วัดจริง 104 + 102 + 95 = 301):
`เหลือปล่อย` · `ปล่อยแล้ว` · `ไม่ต้องปล่อย`

🔴 **เลน "ไม่ต้องปล่อย" มีอยู่เพราะเลขต้องไม่โกหก** — "ยังไม่ปล่อย" ตรง ๆ ได้ 127 ใบ
แต่ 23 ใบในนั้น ERP พาไปคัดเลือก/เริ่มงานแล้ว ⇒ ตัวหารที่จริงคือ **206 ใบที่ยังต้องหาคน**
**และปุ่ม "ปล่อยทีเดียว" เดิมก็เพี้ยนตามด้วย** (จะไปปล่อยประกาศหาคนของตำแหน่งที่มีคนทำอยู่แล้ว 23 ใบ)
— เจอเพราะเลขบนหัวใหม่ไม่ตรงกับเลขบนปุ๊ม **นี่คือประโยชน์ตรง ๆ ของกติกา "เลขต้องกระทบยอด"**

**ขั้น 1-4 แบ่ง "เหลือปล่อย" ได้ครบไม่ซ้ำ** (ไล่ถอยหลังจากปลายทาง · วัดจริง 100+0+2+2 = 104)
⚠️ **"ตรวจแล้ว" ไม่มีเหตุการณ์ในระบบ** (เจ้าของสั่งไว้ว่าไม่ต้องมีปุ่ม "ตรวจแล้ว")
⇒ อ่านจากร่องรอยที่คนทิ้งไว้: หมายเหตุ หรือการแก้ข้อมูลประกาศ · **ห้ามเดานอกจากสองอย่างนี้**

🔴 **เส้น 9 ขั้นไม่ได้ถูกทิ้ง** — ปลายเส้น (คัดเลือก/รอแจ้งเข้า/เริ่มแล้ว) ย้ายไปอยู่ใต้เลน
"ไม่ต้องปล่อย" ที่เป็นเจ้าของขั้นพวกนั้นจริง · ต้นเส้นกลายเป็นขั้น 1-4 ของเลน "เหลือปล่อย"
⇒ `BoardFlowStrip.tsx` **ถูกลบ** (ขึ้น production ไปแล้วเมื่อ 30 นาทีก่อนหน้า · `boardFlow.ts` ยังอยู่)

**โชว์ทีละสองแถวเท่านั้น** — แถวบน 3 เลน · แถวล่างเปลี่ยนตามเลนที่เลือก
(ห้ามกลับไปเป็นแถบกรองซ้อน 4 ชุดที่เจ้าของบอกว่า "เยอะแยะเละเทะไปหมด")

**URL:** `?lane=` + `?step=` (แทน `?stage=` ที่เพิ่งขึ้นไป) · ลิงก์เก่า `?stage=closed` ยังใช้ได้
🔴 เปลี่ยนเลนต้องล้าง `step` ทิ้ง ไม่งั้นกรองสองชั้นแล้วได้ 0 ใบ

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/boardRelease.ts` | **ใหม่** — `releaseLaneOf` · `releaseStepOf` · `buildReleaseLedger` · ป้ายทุกอัน |
| `src/components/jobs/BoardReleaseHeader.tsx` | **ใหม่** — หัวหน้าจอสองแถว |
| `src/components/jobs/JobBoardView.tsx` | หัวใหม่ · `lane/step` ใน URL · **แก้ปุ๊มปล่อยทีเดียวที่นับเกิน 23 ใบ** |
| `src/components/jobs/BoardFlowStrip.tsx` | **ลบ** — ถูกแทนที่ทั้งดวง |
| `src/lib/boardFlow.ts` | เพิ่ม `MOVED_ON_STAGE_KEYS` |
| `tests/api/boardRelease.test.ts` | **ใหม่** 24 เทสต์ — เน้น "เลขบวกกันลงตัว" 3 ข้อ |

**ด่านตรวจ:** test **2,441 ผ่าน / 6 skip (225 ไฟล์)** · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงครบ** — login ทั้งสองโหมด (รหัสผ่าน/Microsoft) บนคอมกับมือถือ ·
กล่องงานกดครบทุกเลนทุกขั้น เลขบนหัวตรงกับจำนวนการ์ดเป๊ะทุกครั้ง
⚠️ **ปุ่ม "ปล่อยทีเดียว 104 ใบ" ยังไม่ได้ยิงจริง** — จะปล่อยใบจริง 104 ใบขึ้นหน้าสาธารณะ รอเจ้าของสั่ง

#### 🔴 รอบเจ็ดสิบ (ต่อ) — **ทดสอบด้วยการให้โมเดลอ่อนสุดสวมบทพนักงานใหม่**

เจ้าของสั่ง: *"ลองเอาโมเดลที่อ่อนที่สุดมาลองเล่นหน้ากล่องงาน แล้วบอกทีว่าเข้าใจไหม"*
⇒ ส่ง Haiku เข้าไปเล่นโดย **ห้ามอ่านโค้ด** ให้ดูจากจอเท่านั้น + บังคับกดจริงหลายครั้ง
แล้วให้ตอบเป็นหัวข้อคงที่ (เข้าใจอะไร · งงอะไร · ศัพท์ไหนไม่รู้ · ให้คะแนนตัวเอง)

**🔴 วิธีนี้จับของที่คนทำเองมองไม่เห็น — เอาไปใช้กับหน้าอื่นได้เลย**

| Haiku รอบ 1 (5.5/10) บอกว่า | แก้เป็น | รอบ 2 (6/10) |
|---|---|---|
| อ่านขั้น 1-4 เป็น *"ข้อมูลสถานะ"* ไม่ใช่ขั้นตอน | ป้ายเป็น**คำกริยา** (ตรวจใบขอ/แก้ข้อมูลประกาศ/สร้างลิงก์/กดปล่อย) · สภาพย้ายไป `state` เป็นบรรทัดรอง · เลขขั้นในวงกลม · **โชว์ตั้งแต่เปิดหน้า** | ✅ ไล่ขั้นถูกครบ 4 ขั้นพร้อมลำดับ |
| *"กดแล้วมันแค่ขยายบอกความหมาย ไม่ได้เปลี่ยนหน้าไป"* | แถบ "กำลังดู: … — N ใบข้างล่าง" + ปุ่มล้างตัวกรอง + เลื่อนจอไปที่การ์ด | ✅ รู้ว่ากดแล้วกรอง |
| *"50% ของ 206 มาจากไหน (104+102=206 รึ?)"* | เขียนสมการบนจอ `(= เหลือปล่อย 104 + ปล่อยแล้ว 102)` | ✅ ตอบถูกเอง |
| *"ลิงก์เงียบ 5 ใบ กับ ปล่อยแล้ว 102 ต่างกันยังไง"* | แถบลิงก์เงียบโชว์เฉพาะเลน "ปล่อยแล้ว" (มันเป็นส่วนย่อยของเลนนั้น) | ✅ หายจากรายการงง |
| *"ไม่ต้องปล่อย 94 ทำไมยังโชว์ ควรซ่อนไหม"* | ใส่บรรทัดตอบใต้เลนนั้น (ซ่อนแล้วบวกไม่ครบ) | ✅ อธิบายได้เอง |
| ศัพท์ *ใบขอ · อัตรา · ปล่อย* อ่านไม่รู้เรื่อง | ต่อเข้า `<Term>` + เพิ่ม `unit_request` / `positions` ในพจนานุกรม | ✅ แปลถูกทั้งสาม |

**🔴🔴 บั๊กจริงที่ Haiku จับได้ (ของที่เทสต์กับตาเราจับไม่ได้):**
> *"กด 104 (เหลือปล่อย) → หน้าโหลด แต่ตัวเลขเปลี่ยนเป็น 0 ทั้งหมด"*
> *"กดปุ่มย้อนกลับ → กลับมาหน้า board แต่ตัวเลขเป็น 0 อีกครั้ง"*

เหตุ: กดการ์ดเข้าใบขอแล้วย้อนกลับ = หน้าบอร์ดถูกสร้างใหม่ · `postings`/`releases` เป็น
state ในหน้า จึงโหลดใหม่ **แต่หัวหน้าจอโชว์เลขไปเลยทั้งที่ยังไม่มีข้อมูล**
⚠️ **ช่วงที่แย่กว่า 0 คือช่วงที่ใบขอมาแล้วแต่ทะเบียนลิงก์/การปล่อยยังไม่มา** —
`hasLink`/`isReleased` false ทุกใบ ⇒ "เหลือปล่อย" เฟ้อ "ปล่อยแล้ว" = 0 ซึ่ง**ดูเหมือนเลขจริง**
จับด้วยตาไม่ได้เลย · นี่คือ "หน้าจอโกหกตัวเลข" ตรงตามที่กติกาข้อแรกห้าม

**แก้:** เพิ่ม `ledgerReady = !loading && postingsLoaded && releases !== null`
ยังไม่ครบสามเส้น ⇒ โชว์ **"กำลังอ่านตัวเลขของงานปล่อยประกาศ…"** + โครงเปล่า ไม่โชว์เลข
และ **ไม่กรองการ์ดตามเลน** ด้วย (กรองไปก็ได้ชุดผิด)
⚠️ `postingsLoaded` ต้องเป็น state จริง **ห้ามใช้ `postings.length > 0`** (0 ประกาศก็เป็นค่าที่ถูกได้)
✅ ตรวจบนจอตามเส้นทางที่ Haiku เจอเป๊ะ ๆ: กดการ์ด → ย้อนกลับ ⇒ ได้ "กำลังอ่าน" แล้วค่อยเป็น 104/101/95

**บั๊กที่สองที่โผล่ตอนย้ายขั้นมาโชว์ตั้งแต่แรก:** กดขั้นตอนที่ยังไม่ได้เลือกเลน = ไม่กรองอะไรเลย
(`?step=check` ลอยโดยไม่มี `lane`) ⇒ กดขั้น**ต้องตั้งเลนให้ด้วย** และตัวอ่านต้องถือว่า
"มี step ก็พอ" (กัน URL พิมพ์มือ)

**หนี้ใหม่ที่ Haiku ชี้ (ยังไม่แก้ · ไม่ใช่ของหน้านี้):**
`"เปิดไซด์"` · `"ST: A"` · วงกลมแดงบนการ์ด · ตัวเลือกสถานะงาน 8 ตัวไม่มีคำอธิบายว่าใช้เมื่อไหร่

**ด่านตรวจ:** test **2,446 ผ่าน / 6 skip (225 ไฟล์)** · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
เทสต์ใหม่ล็อกไว้ว่า **ป้ายขั้นห้ามขึ้นต้นด้วย "ยัง/ไม่/รอ"** (กันเปลี่ยนกลับเป็นป้ายสถานะ)

#### 🔴 รอบเจ็ดสิบ (ต่อ 2) — **ให้โมเดลอ่อนสุดทำภารกิจจริง "ไปสร้างลิงก์รับสมัคร"**

เจ้าของสั่ง: *"ให้โมเดลอ่อนสุดเล่นแบบ กว่าจะไป gen link ดู"*
⇒ ให้โจทย์ปลายทางแบบหัวหน้าสั่งจริง (*"ไปสร้างลิงก์รับสมัครให้ใบขอที่ยังไม่มีลิงก์หน่อย"*)
แล้วปล่อยให้คลำทางเอง · ห้ามอ่านโค้ด · ห้ามกดปุ่มที่เขียนของจริง (สร้างประกาศ+ลิงก์ / ปล่อย / AI โทร)

**ผล: ไปถึงฟอร์มได้ 7 คลิก 0 คลิกเสียเปล่า · ความง่าย 6/10**
เส้นทาง: หัวหน้าจอ → กดขั้น 3 "สร้างลิงก์สมัคร" (กรองได้ 2 ใบ) → กดการ์ด → แท็บ "ประกาศ / ลิงก์สมัคร" → ฟอร์ม

**🔴🔴 ตัวเลขที่สำคัญที่สุดของรอบนี้: "ความมั่นใจในการกดปุ่มสุดท้าย = 1/10"**
มันเดินถึงปลายทางได้ แต่**ไม่กล้าลงมือ** — ถึงหน้าจอนำทางดีแค่ไหน ถ้าคนไม่กล้ากดก็เท่ากับทำงานไม่ได้
เหตุผลของมันสามข้อ กลายเป็นงานแก้สามข้อ:

**1. 🔴 บั๊กจริง — หัวข้อประกาศเติมมาเป็น "ชื่อบริษัท" ไม่ใช่ตำแหน่งงาน**
> *"หัวข้อประกาศ 'ธนบุรีประกอบรถยนต์' อาจไม่ใช่ตำแหน่งที่เหมาะสม"* — **มันถูก**

`GenApplyLinkDialog` เติม `jobBoardCardTitle(job)` = `unit_name` ลงช่องหัวข้อ
แล้วค่านี้ไปเป็น `<h1>` บนหน้าสมัครสาธารณะ (`PublicPostingApplyPage.tsx`)
⇒ **คนหางานกดลิงก์มาเจอหัวเรื่องเป็นชื่อบริษัท ไม่บอกว่ารับตำแหน่งอะไร**
ทั้งที่ในฟอร์มมีช่อง "ตำแหน่งงาน" ที่เติม `staff_title_name` ถูกอยู่แล้ว แค่ไม่ได้เอามาใช้
**แก้:** ค่าตั้งต้น = `ตำแหน่ง · ชื่อหน่วยงาน` (เช่น "คนสวน · ธนบุรีประกอบรถยนต์")
+ บรรทัดใต้ช่องบอกว่า *"บรรทัดนี้คือหัวเรื่องตัวใหญ่ที่ผู้สมัครเห็น"*
⚠️ เปลี่ยนแค่**ค่าตั้งต้นของประกาศใหม่** ประกาศเก่าไม่ถูกแตะ · มีเทสต์คุมสูตร

**2. ไม่รู้ว่าช่องไหนจำเป็น** — มี `*` แค่ช่องเดียว ที่เหลือไม่มีสัญญาณ
มันเห็น "เบอร์ติดต่อ" ว่างแล้วคิดว่า *"ฟอร์มยังไม่เสร็จ"* จึงไม่กด
**แก้:** ช่องไม่บังคับติดป้าย `(ไม่ใส่ก็ได้)` ทั้ง 5 ช่อง · `*` เป็นสีแดง

**3. ลิสต์ช่องทางกินครึ่งจอ** (30+ ช่อง) — *"ยากต่อการมองหาช่องที่ต้องการ"*
**แก้:** หุบเป็นค่าตั้งต้น โชว์สรุป `(ไม่เลือกก็ได้ — จะได้ลิงก์กลาง 1 อัน)` / `เลือกไว้ N ช่อง`
⚠️ หุบได้เพราะไม่เลือกช่องทางก็สร้างได้ · ไม่ได้แก้ `ChannelPicker` ที่เป็นของกลาง (หน้าอื่นใช้ร่วม)

**บทเรียนของวิธีทดสอบ:** ถามว่า *"เข้าใจไหม"* ได้คำตอบเรื่องความอ่านออก ·
ถามว่า *"ทำภารกิจนี้ให้จบ"* ได้คำตอบเรื่อง **ความกล้าลงมือ** ซึ่งจับได้แค่วิธีหลัง
🔴 คำถาม *"ถ้าไม่มีใครห้าม จะกดปุ่มสุดท้ายด้วยความมั่นใจแค่ไหน"* เป็นคำถามที่คุ้มที่สุด — ใช้ซ้ำได้ทุกหน้า

**ผลข้างเคียงที่ยอมรับ:** ชิปขั้นเป็นคำกริยาแล้ว มันจึงคาดว่า "กดขั้น 3 สร้างลิงก์สมัคร"
คือปุ่มลงมือ แต่ได้ตัวกรอง · มันไม่เสียเวลาเพราะตัวกรองพาไปถูกใบ (นับเป็น 0 คลิกเสียเปล่า)
⇒ ยังไม่แก้ · ถ้าเจ้าของเห็นว่าสับสนค่อยเปลี่ยนเป็น "ยังไม่มีลิงก์ 2 ใบ"

**หนี้ที่ยังไม่แก้:** `"เปิดไซด์"` · `"ST: A"` · วงกลมแดงบนการ์ด · ตัวเลือกสถานะงาน 8 ตัวไม่มีคำอธิบาย

| ไฟล์ | ทำอะไร |
|---|---|
| `src/components/jobs/GenApplyLinkDialog.tsx` | หัวข้อนำด้วยตำแหน่ง · ป้าย (ไม่ใส่ก็ได้) · หุบลิสต์ช่องทาง |
| `tests/api/postingTitleDefault.test.ts` | **ใหม่** 4 เทสต์ — ล็อกว่าหัวข้อต้องนำด้วยตำแหน่ง |

**ด่านตรวจ:** test **2,450 ผ่าน / 6 skip (226 ไฟล์)** · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
ตรวจบนจอจริง (ใบ `LMO6801013`) — หัวข้อขึ้น "คนสวน · ธนบุรีประกอบรถยนต์" · ช่องทางหุบ · ป้ายครบ

---

### รอบเจ็ดสิบสอง · 28 ส.ค. 2569 — **คลังผู้สมัคร: ถอดกราฟแท่ง 12 เดือน เหลือแค่ปฏิทิน**

เจ้าของแปะ DOM ของกล่อง "ปฏิทินวันที่สมัคร · 12 เดือนล่าสุด" มาแล้วสั่ง:
*"เอากล่องนี้ออก แล้วเอาไว้แค่ calendar ไง"* (ตรงกับสเปคข้อ 8 ที่ค้างไว้)

**ถอดทิ้งทั้งดวง:** กล่องครอบ (`rounded-2xl border` + `DASH.card`) · หัวข้อ
"ปฏิทินวันที่สมัคร · 12 เดือนล่าสุด" · แท่ง 12 เดือนที่กดกรองได้ · ปุ่ม "ล้างตัวกรองเดือน" ·
บรรทัด "กดเดือนเพื่อดูเฉพาะคนที่สมัครเดือนนั้น"
**เหลือ:** `DateRangeCalendarPicker` ตัวเดียว กว้าง `w-full sm:w-64`

🔴 **ตัวกรองวันเหลือทางเดียวแล้ว** — `activeMonth` (state + สาขาใน `grouped`) ถูกลบทั้งชุด
พร้อม `monthOptions` / `maxMonth` ที่คำนวณไว้ให้แท่งเดือนอย่างเดียว
⇒ เงื่อนไขโชว์เปลี่ยนจาก `people && monthOptions.length > 0` เป็น `people` เฉย ๆ
(ไม่งั้นคนที่ไม่มีวันสมัครสักคน จะไม่มีปฏิทินให้กดเลย)
⚠️ **ห้ามเอาแท่งเดือนกลับมาโดยไม่ถาม** — จดกติกาไว้บน state `dateRange` แล้ว

ตัวปฏิทินบอกช่วงที่เลือกอยู่ในตัวเอง ("ทั้งหมด" = ไม่กรอง) และมีกากบาทล้างค่าอยู่แล้ว
จึงไม่ต้องมีป้ายกำกับหรือปุ่มล้างของตัวเอง

| ไฟล์ | ทำอะไร |
|---|---|
| `src/pages/matching/OurPeoplePage.tsx` | ถอดกล่อง+แท่งเดือน · ลบ `activeMonth`/`monthOptions`/`maxMonth` |

**ด่านตรวจ:** test **2,462 ผ่าน / 6 skip (227 ไฟล์)** · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริง:** กราฟหาย เหลือปุ่มปฏิทิน · กด "30 วันล่าสุด" แล้วเลขทุกถังขยับ
(39/104/98/64/274/209 → 22/23/33/34/63/32) · กด "ทั้งหมด" กลับมาเท่าเดิมครบ

---

### รอบเจ็ดสิบเอ็ด · 28 ส.ค. 2569 — 🔴 **เลิกใช้เลขขั้น · กล่องงาน 3 ก้อน · popup ไล่งาน 1-4**

**✅ ขึ้น main แล้ว** `996ef56` (มัด A/B/C เป็นก้อนเดียว เพราะสามก้อนแตะไฟล์เดียวกันหลายจุด
แยกแล้วจะได้ commit กลาง ๆ ที่ compile ไม่ผ่าน) · รายละเอียดเต็มอยู่ `docs/SESSION-HANDOFF.md` รอบเจ็ดสิบเอ็ด

#### A. ลำดับงานเหลือ 4 หน้า · ไม่มีเลขขั้นแล้ว

เจ้าของสั่ง: *"ไม่เอาตัวเลข ขอเป็นสัญลักษณ์ที่บ่งบอกถึงข้อนั้น ๆ ไม่ต้องแยก ขอเป็นอันเดียวกัน
ตอนนี้มันมีขีดคั่นไว้ไม่เอา"* · *"หกขั้น ตลกมาก จะมีชื่อคำนี้ทำไม ในเมื่อมันคือใบขอ ก็ใช้ชื่อใบขอสิ"*

🔴 **`ConveyorStep` ถอด `step: number` ออกทั้งดวง** — ลำดับอ่านจากลำดับใน array
⇒ ทุกที่ที่เคยอ้างเลขขั้นต้องเปลี่ยนไปอ้าง **คีย์** หรือ **ตำแหน่งใน array**

| ที่เดิมอ้างเลข | เปลี่ยนเป็น |
|---|---|
| `AppNavDrawer` กล่องเลข | `<step.icon />` |
| `StageBanner` "ขั้นที่ N/6 · ชื่อ" | ไอคอน + ชื่อ ชิ้นเดียว · หาหน้าถัดไปด้วย `findIndex(key)` |
| `CommandDeck` แถบ 1-6 | ไอคอน + หา `headAt` ด้วยคีย์ |
| `NextTask.step: number` | **`stepKey: ConveyorBadgeKey`** |
| `StageTile.step` | ถอดออก |

**ถอด 2 หน้าออกจากลำดับ** (เจ้าของ: ซ้ำกับแท็บในกล่องงาน) — ประกาศรับ · ผู้สมัคร
**เปลี่ยนชื่อ** "จับคู่ & โทร" → **จับคู่งาน** ย้ายมาอยู่ใต้ใบขอ
⇒ **ผลพลอยได้: กล่องงานเป็นเจ้าของ `/jobs/board` เต็มตัว** ไม่มีขั้นไหนมาแย่ง `match` อีก
(ปิดข้อ "หน้าเดียวสวมหมวก 3 ใบ" ที่เจอตอนไล่ Journey)
⚠️ `URGENT_KEYS` ต้องถอด `applicants` ออก ไม่งั้น `tiles.find(...)` เป็น `undefined`

#### B. กล่องงาน 3 ก้อน — เลขตรงกับหน้าหลักแล้ว

เจ้าของเคาะชื่อเอง: **ทั้งหมด · ปล่อยแล้ว · ยังไม่ปล่อย** (วัดจริง 304 = 173 + 131)
🔴 **ก้อน "ไม่ต้องปล่อย" ที่เพิ่มไปรอบเจ็ดสิบ ถูกยุบทิ้ง** — *"คำว่า ไม่ต้องปล่อย ฉันให้ใช้ว่า ยังไม่ปล่อย"*

⚠️ **แต่ความจริงเรื่องใบที่ ERP พาไปเริ่มงานแล้วห้ามหาย** — ย้ายไปเป็น `stillSourcing(job)`
ซึ่ง **ปุ่มส่งประกาศเป็นชุดต้องใช้** ⇒ ปุ่มขึ้น 107 ไม่ใช่ 131
🔴 **เลขบนปุ่มต่างจากเลขบนหัวโดยตั้งใจ ⇒ ต้องเขียนอธิบายบนปุ่ม** ไม่งั้นคนเห็นสองเลขไม่ตรงแล้วไม่เชื่อทั้งคู่

**ขั้น 1-4 เปลี่ยนชุด** (เจ้าของเคาะเอง) · คีย์เปลี่ยนจาก `check/fields/link/publish` เป็น
`info/place/benefits/publish`:
ตรวจใบขอ → ใส่สถานที่ปฏิบัติงาน → เลือกสวัสดิการ → สร้างลิงก์ + ส่งประกาศ

#### C. popup ไล่งาน — **คำสั่งล่าสุดกลับเป็น popup**

| วันที่ | คำสั่ง | ความหมาย |
|---|---|---|
| 27 ส.ค. | *"ไม่เอาแบบ Popup เด้งนะ"* | ป๊อป**เอาไว้ดูข้อมูล** — ถอดถูกแล้ว |
| 28 ส.ค. | *"ให้เด้ง Popup ทำเสร็จก็จะได้อยู่หน้าเดิม"* | ป๊อป**เอาไว้ทำงาน** — ทำเสร็จต้องได้อยู่ที่กล่องงานต่อ |

🔴 **ไม่ขัดกัน คนละเรื่อง** — ผมถามยืนยันแล้วรอบหนึ่งและได้คำตอบว่า "เอาเป็นหน้าเหมือนเดิม"
แต่พอเห็นของจริงเจ้าของสั่งกลับเป็น popup ⇒ **คำสั่งล่าสุดชนะ**

* กดการ์ด → `Dialog` บนกล่องงาน · URL ยังเป็น `/jobs/board`
* 🔴 **เริ่มขั้น 1 เสมอ** — เคยทำให้เด้งไปขั้นที่ใบนั้นค้าง โดน
  *"พอกดเข้าไปทำไมไปโผล่ กดปล่อย เลยอะ ไม่ไล่ไปจาก 1.ตรวจใบขอ ไล่ไปอะ"*
  `currentStep` ยังใช้ แต่ใช้แค่ติดป้าย "ค้างที่นี่"
* ปิดกล่อง → `loadReleases()` + `postingsRev++` ให้เลขบนหัวขยับทันที
* `BoardPostingSteps` เป็น **เนื้อชุดเดียว** ใช้ทั้ง popup (`chrome={false}`) และ deep-link page
* `EditPublicJobFieldsDialog` เพิ่ม prop **`sections`** (`place` / `income` / `benefits`)
  ⇒ ขั้น 2 โชว์แค่จังหวัด-อำเภอ-ตำบล · ขั้น 3 โชว์รายได้+สวัสดิการ
  ⚠️ ไม่ส่ง `sections` = โชว์ครบเหมือนเดิม (หน้าอื่นที่เรียกอยู่ไม่ต้องแก้)

#### D. สามข้อล่าสุด (🔴 **ยังไม่ตรวจบนจอ — ล็อกอินหมดอายุกลางทาง**)

1. **ถอด ✓ ออกจากแถบขั้น** → โชว์เลขขั้นเสมอ
   (บ้านนี้เคยถอดติ๊กถูกออกจากหน้าแรกไปแล้ว 26 ส.ค. — ติ๊กถูกคืออ้างว่าเสร็จ ทั้งที่ไม่มีหลักฐาน)
2. **"เปิดใบขอเต็ม ๆ" เลิกเด้งออกไปหน้าใบงาน → กางในกล่อง**
   *"เปิดใบขอเต็ม ๆ ก็ไม่ต้องเด้งไปหน้าใบงานสิ กดแล้วก็ขยายให้ดูเลยสิ"*
   ⇒ **ยกชุด 23 ช่องเป็น `UnitRequestInfoFields.tsx` (ไฟล์ใหม่)** ทั้งหน้าใบขอและ popup เรียกตัวเดียวกัน
   ⚠️ กติกาที่ติดมากับชุดนี้: **ห้าม fallback "รหัสไซต์" ไปชื่อหน่วยงาน** · ไม่รู้ = "—" ห้ามขึ้น 0
3. **"ใครแก้อะไรไป" เห็นแค่ Admin + แบ่งหน้า** — เดิมกั้นที่ `staff` ⇒ สรรหา/คัดสรรเห็นชื่อกันหมด
   ใช้ `ListPaginationBar` ตัวกลาง 10/หน้า · มีหน้าเดียวซ่อนแถบ

#### 🔴 กับดักที่เจอรอบนี้

1. **ถอดฟิลด์ออกจาก type กลางแล้วพังหลายที่เงียบ ๆ** — `step: number` ถูกอ้างใน 5 ไฟล์ +
   3 ไฟล์เทสต์ · tsc จับได้ทั้งหมด **แต่เทสต์ที่ assert `[1,2,3,4,5,6]` ต้องเขียนใหม่ทั้งบล็อก**
2. **`tiles.find(k)` คืน `undefined` เมื่อถอดรายการออกจาก array** — เทสต์ที่ `?.urgent` จะได้
   `undefined` แล้ว `toBe(false)` พัง (ไม่ใช่ error ที่อ่านง่าย)
3. **แยกฟอร์มเป็นส่วน ๆ ต้องปิด JSX ให้ครบทุก `) : null}`** — เปิด 3 ที่ ปิด 3 ที่ พลาดที่เดียว tsc ไม่บอกตรงจุด

**ด่านตรวจ:** test **2,462 ผ่าน / 6 skip** · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอแล้ว:** ก้อน A (เมนู/ป้าย) · ก้อน B (3 ก้อน + popup เริ่มขั้น 1)
**ยังไม่ตรวจบนจอ:** ก้อน D (✓ / กางในกล่อง / ประวัติแบ่งหน้า) — **งานแรกของ session ถัดไป**


---

## รอบเจ็ดสิบสาม — ตาราง Planning ของหน้าติดตาม (F3 · 1 ก.ย. 2569)

เจ้าของสั่ง: *"เป็นเหมือน Planning เพื่อบอกว่ามีใครบ้าง และติดตามวันไหนบ้าง
และใน Planning ก็มีบอกว่าติดตามกี่รอบด้วย และเวลาไหนบ้าง"*
⇒ **มาแทนรายการการ์ดเดิม ไม่ใช่เพิ่มอีกมุมมอง** (แผนเต็มที่ `docs/plan-follow-2569-09-01.md`)

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/followPlanning.ts` | **ใหม่ · pure** — `followRoundState()` สภาพของรอบ 6 แบบ + `buildFollowPlanningRows()` แถวของตาราง (เทสต์ 12) |
| `src/components/follow/FollowPlanningTable.tsx` | **ใหม่** — ตาราง 4 คอลัมน์ · ชิปเวลาต่อรอบ · ปุ่มรายรอบอยู่ในแถว |
| `src/pages/follow/FollowPage.tsx` | ถอดบล็อกการ์ด + ปุ่มสลับมุมมองทิ้ง · แบ่งหน้าจากแถว Planning แทนกลุ่ม |
| `src/lib/followMonthGrid.ts` · `FollowMonthGrid.tsx` · เทสต์ | **ลบ** — เจ้าของเคาะ *"เอาออก เหลือ Planning อย่างเดียว"* |
| `tests/api/pageTitleParity.test.ts` | ด่าน "ผลโทรต้องเป็นคำไทย" ย้ายไปเฝ้า `FollowPlanningTable.tsx` (ที่วาดผลจริงตอนนี้) |

**กติกาที่ติดมากับก้อนนี้ (ห้ามลืมตอนแก้ต่อ):**

1. 🔴 **สภาพของรอบต้องต่อสองที่** — เวลานัด (`scheduled_at`) + คิวโทร (`call_status`/`call_outcome`)
   + การปิดงานของคน (`completed_at`) · **ผลชนะสถานะเสมอ** (บทเรียนเดียวกับ `_lib/lumosQueueDefs`)
   ลำดับชนะ: ยกเลิก > ปิดงาน > มีผล > เลยเวลา > ส่งแล้ว > ยังไม่ถึงเวลา
2. 🔴 **เรียงก่อนแบ่งหน้า** — `buildFollowPlanningRows()` ถูกเรียกที่ `FollowPage` แล้วค่อยแบ่งหน้า
   ถ้าย้ายไปเรียงในตาราง ลำดับจะถูกแค่ภายในหน้านั้น หน้า 2 จะมีของด่วนกว่าซ่อนอยู่
3. 🔴 **ปุ่มรายรอบห้ามซ่อนหลังการกด** — เจ้าของตอบเอง *"เข้ามาหน้าการติดตามก็เห็นเลย"*
4. ไม่มีเวลานัดที่อ่านได้ = `waiting` **ห้ามเดาว่าเลยเวลา**

**ด่านตรวจ:** test 2,537 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว** (1440px · ทั้งธีมมืดและสว่าง): ตารางขึ้นครบ 10 แถว · เรียงของค้างขึ้นบนสุด ·
ปุ่มแก้ไขเปิดกล่องแก้ได้ · ปุ่มเสร็จสิ้นกางตัวเลือกได้ · ไม่มี error ใน console


### รอบเจ็ดสิบสาม (ต่อ) — Planning ต้องเป็น "ปฏิทินที่มีชื่อคน" ไม่ใช่ตารางแถวยาว

เจ้าของทักเย็นวันเดียวกัน: *"ตรง Planning ยังไม่ได้เป็นแบบปฏิทินที่มีรายละเอียด
มีชื่อคนบอกไรงี้ เหมือนเป็นตารางบอกว่าวันนี้มีใครต้องติดตาม"*

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/followPlanning.ts` | เพิ่ม `buildFollowPlanningDays()` — รวมคนต่อวัน + สภาพแรงสุดของคนนั้นในวันนั้น (เทสต์ 15) |
| `src/components/follow/FollowPlanningCalendar.tsx` | **ใหม่** — ปฏิทินเดือน ช่องวันมีชื่อคน+เวลา+จุดสี · "เลยเวลา N" · กดวัน = กรอง |
| `src/pages/follow/FollowPage.tsx` | ปฏิทินอยู่เหนือปุ่มเพิ่มคน · ย้ายกล่อง "โทรครบแล้ว" ลงท้ายหน้า |

**กติกาที่ติดมากับก้อนนี้:**

1. 🔴 **ปฏิทินห้ามโดนตัวกรองวันของตัวเอง** — สร้างจากชุดที่กรองแค่แท็บ/ช่วงเวลา/เจ้าของงาน
   ถ้าเอาชุดที่กรองวันแล้วมาวาด กดวันแรกปุ๊บปฏิทินจะเหลือวันเดียว แล้วกดวันอื่นต่อไม่ได้เลย
2. 🔴 **ตัวกรองวันมีตัวเดียว** — ปฏิทินเซ็ต `fDate` ตัวเดิมที่แผงตัวกรองใช้
   (บทเรียนเดิม: จอเดียวมีเลขที่ตอบคนละคำถามแล้วคนเลิกเชื่อทั้งหมด)
3. ในช่องวัน: คนที่มีของค้างขึ้นก่อน · โชว์ 3 คนแรกแล้วบอก "+อีก N คน" (ไม่ตัดเงียบ)

**ด่านตรวจ:** test 2,540 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** ปฏิทินขึ้นชื่อคนในช่องวัน · กดวัน 1 ก.ย. → เหลือ 7 คน · กด "ดูทุกวัน" → กลับมา 10 คน
· เลื่อนไปเดือน ส.ค. เห็น 25/8 (1 สาย) และ 26/8 (15 สาย) · ไม่มี error ใน console


### รอบเจ็ดสิบสาม (ต่อ 2) — *"ตรงปฏิทินเอาชื่อคนไปไว้ด้านซ้ายสิ"*

รอบก่อนทำเป็นช่องปฏิทิน 7 คอลัมน์แล้วยัดชื่อคนลงในช่อง — เจ้าของสั่งแก้เป็นตาราง
**แถว = คน (ชื่อตรึงซ้าย) · คอลัมน์ = วันของเดือน · ช่อง = เวลาที่ต้องโทร**
(รูปทรงเดียวกับ `FollowMonthGrid` ที่เพิ่งลบไป แต่ช่องโชว์ **เวลาจริง** ไม่ใช่จุดสี
และผูกกับตัวกรองวันของหน้า แทนที่จะเปิด dialog ของตัวเอง)

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/followPlanning.ts` | `monthDayColumns()` (กู้จากไฟล์ที่ลบ) + `buildFollowMonthRows()` · ถอด `buildFollowPlanningDays()` ที่ไม่ได้ใช้แล้วทิ้ง |
| `src/components/follow/FollowPlanningCalendar.tsx` | เขียนใหม่เป็นตารางชื่อซ้าย · เลื่อนไปวันนี้ให้เอง · มี legend สี |

**กติกาที่ติดมากับก้อนนี้:**

1. 🔴 **ชื่อคนต้อง sticky ซ้าย** — เดือนหนึ่ง 30 คอลัมน์ เลื่อนไปท้ายเดือนแล้วต้องยังรู้ว่าแถวนี้ใคร
2. 🔴 **เปิดมาต้องเลื่อนไปวันนี้เอง** — ไม่งั้นเจอต้นเดือนว่าง ๆ แล้วเข้าใจว่าไม่มีงาน
   (เดือนที่ไม่มีวันนี้ ให้ไปวันแรกที่มีนัด)
3. ช่องโชว์เวลาจริงสูงสุด 2 รอบ แล้วบอก "+N" — ไม่ตัดเงียบ

**ด่านตรวจ:** test 2,540 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** ชื่ออยู่ซ้าย · เดือน ส.ค. เลื่อนไปโชว์ 23-31 เห็นเวลาเป็นสีแดง/เขียวตามสภาพ ·
กด "วันนี้" → เดือน ก.ย. คอลัมน์วันที่ 1 ไฮไลต์ ตารางล่างเหลือ 7 คน · กด "ดูทุกวัน" กลับมา 10 คน


### รอบเจ็ดสิบสาม (ต่อ 3) — ถอดบรรทัดหัวตาราง Planning ทิ้ง

เจ้าของสั่ง: *"Planning วันที่ 1/9/2569 7 คน ดูทุกวัน — ตรงนี้ก็เอาออกไปเลย"*
⇒ ถอดบรรทัดหัวออกจาก `FollowPage.tsx` ทั้งดุ้น (รวมปุ่ม "ดูทุกวัน")

⚠️ **ทางกลับยังมีอยู่สองทาง** จึงถอดได้ไม่ตัน: ปุ่ม "ดูทั้งหมด" บนหัวปฏิทิน
(โผล่เมื่อเลือกวันอยู่) และ "ล้างตัวกรอง" ข้างปุ่มตัวกรอง · ถ้าจะถอดอีกอันต้องเช็คก่อน
ว่าเหลือทางกลับอย่างน้อยหนึ่งทางเสมอ ไม่งั้นเลือกวันแล้วออกไม่ได้

**ด่านตรวจ:** test 2,540 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน · ตรวจบนจอแล้ว


### รอบเจ็ดสิบสาม (ต่อ 4) — ถอดตารางใต้ปฏิทินทิ้ง ปุ่มย้ายเข้าป๊อป

เจ้าของสั่ง: *"คนที่ต้องติดตาม / หน่วยงาน / ติดตามวันไหน / แต่ละรอบ · เวลา · ไปถึงไหน
— หมายถึงเอากล่องพวกนี้ออกไปเลย"* แล้วเลือกเป็น Choice ว่า **กดช่องในปฏิทินแล้วเด้ง popup**

| ไฟล์ | หน้าที่ |
|---|---|
| `src/components/follow/FollowRoundsDialog.tsx` | **ใหม่** — ป๊อป "คนนี้ วันนี้": ทุกรอบ + ปุ่มแก้ไข/เสร็จสิ้น/ยกเลิก + ผลการโทร |
| `src/components/follow/FollowPlanningTable.tsx` | **ลบ** — ตารางใต้ปฏิทินหายทั้งดุ้น (พร้อมแถบแบ่งหน้า) |
| `src/components/follow/FollowPlanningCalendar.tsx` | กดช่องเวลา = เปิดป๊อป (เดิมกดแล้วกรองวัน) · กดหัวคอลัมน์วัน = กรองวันเหมือนเดิม |
| `src/pages/follow/FollowPage.tsx` | ถอด `useListPagination`/`ListPaginationBar` · ปฏิทินใช้ `planningRows` (กรองวันแล้ว) |
| `tests/api/pageTitleParity.test.ts` | ด่าน "ผลโทรต้องเป็นคำไทย" ย้ายไปเฝ้า `FollowRoundsDialog.tsx` |

**กติกาที่ติดมากับก้อนนี้:**

1. 🔴 **ห้ามซ้อน Dialog ใน Dialog** — ปุ่ม "แก้ไข" ในป๊อปสั่ง `setOpenCell(null)` ก่อน
   แล้วค่อย `setEditing(entry)` · ตรวจบนจอแล้วว่าป๊อปแรกปิดจริงก่อนกล่องแก้ไขเปิด
2. 🔴 **ป๊อปเก็บแค่คีย์ (`{key, ymd}`) ไม่เก็บก้อนข้อมูล** — ปิดงาน/ยกเลิกแล้วโหลดใหม่
   ป้ายในป๊อปต้องเปลี่ยนตาม ไม่ใช่ค้างของเก่า
3. ⚠️ **คำสั่งขัดกันในวันเดียว** — เช้าสั่ง *"ปุ่มต้องเห็นเลย ห้ามซ่อน"* เย็นสั่งถอดตาราง
   ⇒ คำสั่งล่าสุดชนะ (แพตเทิร์นเดียวกับ popup กล่องงาน 27→28 ส.ค.)

**ด่านตรวจ:** test 2,540 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** ตารางหายแล้ว เหลือปฏิทินอย่างเดียว · กดช่อง 11:12 ของวัชระ → ป๊อปขึ้นครบ
พร้อมปุ่ม · กดแก้ไข → ป๊อปปิด กล่องแก้ไขเปิด (ไม่ซ้อน) · กดหัววัน 25/8 → เหลือ 1 คน · กดดูทั้งหมด → กลับมา 7


### รอบเจ็ดสิบสี่ — เลือกเองว่า "รอบนี้คือสายที่เท่าไหร่" + เห็นบทที่จะพูด

เจ้าของสั่ง 1 ก.ย. 2569: *"ตอนเลือก Scrip ฉันอยากได้แบบเลือกวันเวลาเสร็จของรอบแรก
ก็มี Dropdown ให้เลือกเลยว่านี่คือ สาย 1 2 3 แล้วพอเพิ่มรอบก็เหมือนกัน
พอเลือกแล้วบอกหน่อยว่า Scrip นั้น ๆ จะพูดอะไรบ้าง"*

🔴 **เจอบั๊กเงียบระหว่างทำ — จอกับของจริงไม่ตรงกันมาตั้งแต่ 31 ส.ค. 2569**
โหมด "ระบุเวลาเอง" สร้าง **หนึ่งแถวต่อหนึ่งรอบ** (ไม่ใช่หนึ่งแถวหลาย `call_times`)
แถวเดี่ยวไม่มี `call_times` ⇒ `buildFollowReminderPayload` ตกไปทาง else ซึ่ง hardcode
`messageFor('first')` ⇒ **ทุกรอบพูดบทสายแรกหมด** ทั้งที่จอเขียนว่า "รอบ 2 ใช้บทรอบถัดไป"
(กติกาสลับบทเองใช้ได้เฉพาะโหมดตาราง) · คอลัมน์ใหม่ปิดช่องนี้ไปพร้อมกัน

| ไฟล์ | หน้าที่ |
|---|---|
| `migrations/113_follow_call_round.sql` | `follow_entries.call_round smallint` nullable · ไม่มี CHECK (บ้านนี้โดน CHECK ล็อกมาสองรอบ) · **รันบนฐานจริงแล้ว** |
| `api/_handlers/follow.ts` | `parseFollowInput` รับ `call_round` (1-9 · นอกช่วง = ปฏิเสธ ไม่ปัดให้) · insert · ส่งต่อ enqueue · คืนใน `toResponse` · PATCH พกรอบเดิมไปตอน refresh payload |
| `api/_lib/lumosDispatch.ts` | `FollowEntryInput.callRound` · `roundOf(stepIndex)` = `baseRound + i === 1 ? 'first' : 'repeat'` (โหมดตารางนับต่อจากรอบที่เลือก) |
| `src/pages/follow/FollowPage.tsx` | state `callRounds[]` + dropdown ต่อรอบ · แมป **เวลา → รอบ** เหมือนที่ทำกับเบอร์ |
| `src/components/follow/RoundScriptNote.tsx` | รับ `callRound` (เดิมรับ `roundIndex`) + `defaultOpen` — กางเนื้อบทให้เห็นเลย |

**กติกาที่ติดมากับก้อนนี้:**

1. 🔴 **`callRounds[]` ต้องขยับคู่กับ `scheduledAts[]` เสมอ** — กับดักเดียวกับอาร์เรย์เบอร์
   หลุดคู่ = รอบ 2 ไปใช้บทของรอบ 3 โดยไม่มีอะไรบนจอบอก
2. 🔴 **ห้ามใช้ index ของ `times` ตอนส่ง** — `times` ถูก dedup + sort แล้ว
   ต้องแมปผ่าน **เวลา → รอบ** (`roundByLocal` → `roundByIso`) เหมือนที่เบอร์ทำ
3. ตัวเลือกอย่างน้อย 3 อันเสมอ และขยายตามจำนวนรอบที่ตั้งจริง
4. บทมีสองชุดเท่านั้น — สายที่ 2 กับ 3 ใช้ชุดเดียวกัน (`follow_repeat`) จอบอกตามจริง

**ด่านตรวจ:** test 2,547 ผ่าน / 6 skip (เพิ่ม 7 ข้อ) · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** dropdown ขึ้น 3 ตัวเลือก · เพิ่มรอบแล้วรอบใหม่เดาเป็นสายที่ 2 ให้เอง ·
เปลี่ยนเป็นสายที่ 3 แล้วบทสลับเป็น "ติดตาม — รอบที่ 2 เป็นต้นไป" ทันที
🔴 **ไม่ได้กดบันทึก** (โหมด follow_entry เป็น auto = กดแล้วโทรหาคนจริง) — ตรวจเส้นเขียนด้วยการ
insert แถวทดสอบตรงฐานแล้วอ่านผ่าน `/api/follow` ว่าได้ `call_round: 2` กลับมาจริง **แล้วลบทิ้งด้วย id**


### รอบเจ็ดสิบห้า — *"ในระบบ Lumos บอกยกเลิก งี้จะเชื่อนายได้ไง"*

เจ้าของทัก 1 ก.ย. 2569 ว่านายวิศิษฐ์ จิตต์ประเสริฐ **จอเราขึ้นเสร็จสิ้น แต่ Lumos บอกยกเลิก**

**ไล่ฐานแล้วพบว่ามีสองเรื่องคนละเรื่อง — จอผิดทั้งคู่:**

1. **"เสร็จสิ้น" ที่เห็นคือ *ปุ่ม* ไม่ใช่สถานะ** — ปุ่มปิดงานเป็นวงกลมสีเขียวคำว่า "เสร็จสิ้น"
   วางอยู่ท้ายแถวรอบ อ่านผ่าน ๆ เหมือนป้ายบอกผลของสายนั้น
   ⇒ เปลี่ยนเป็น **"บันทึกว่าเสร็จสิ้น"** (ขึ้นต้นด้วยกริยา) + สีกลางแทนเขียว
   + มีหัวข้อ "จัดการรอบนี้" คั่นก่อนแถวปุ่ม
2. **สายที่ยกเลิกหายจากจอเงียบ ๆ** — คนนี้มี **3 สายในวันเดียว**:
   11:00 (ถูกยกเลิก 39 วินาทีหลังสร้าง) · 11:00 (คุยจบ acknowledged) · 11:15 (declined)
   ปฏิทินกรองรอบที่ยกเลิกทิ้ง + แท็บ "กำลังตาม" ก็กรองอีกชั้น ⇒ จอเราโชว์ 2 Lumos โชว์ 3

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/followPlanning.ts` | `buildFollowMonthRows` **เลิกกรองรอบที่ยกเลิกทิ้ง** (โชว์จาง + ขีดฆ่าแทน) |
| `src/pages/follow/FollowPage.tsx` | ป๊อปรายละเอียดอ่านจาก `allRows` = **ชุดเต็มไม่ผ่านตัวกรองใด ๆ** |
| `src/components/follow/FollowPlanningCalendar.tsx` | ชิปยกเลิก = ขีดฆ่า + จาง · เพิ่ม legend |
| `src/components/follow/FollowCompleteControls.tsx` | คำบนปุ่ม + สี |

🔴 **กติกาที่ได้จากรอบนี้:**
* **ปฏิทิน/เลขบนแท็บเคารพตัวกรอง · แต่ป๊อปรายละเอียดต้องเล่าครบเสมอ**
  ป๊อปคือที่ที่คนมาถามว่า "ตกลงเกิดอะไรขึ้น" — กรองที่นั่นคือปิดตาคนถาม
* **ของที่เกิดขึ้นจริงห้ามหายจากจอ** ต่อให้จบ/ยกเลิกไปแล้ว — ทำให้จาง ติดป้าย แต่ต้องเห็น
* **ปุ่มห้ามหน้าตาเหมือนป้ายสถานะ** (หนี้เดิมข้อ 4 ของ audit 29 ส.ค. โผล่ซ้ำในรูปใหม่)

### รอบเจ็ดสิบห้า (ต่อ) — ปฏิทินตามรอบที่เลือก + ย้ายปุ่มเพิ่มคน

เจ้าของสั่ง: *"ในตารางปฏิทิน ถ้าเลือกในการโทรของงาน Follow การโทรครั้งที่ 1
ก็โชว์ข้อมูลแค่ของครั้งที่ 1 สิ · ส่วนปุ่มเพิ่มคนที่ต้องการติดตาม ก็ย้ายไปไว้ข้าง ๆ ปุ่มเพิ่มเจ้าหน้าที่"*

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/followRoundBuckets.ts` | **`followRoundSlot()` ใหม่** — "รายการนี้อยู่ครั้งที่เท่าไหร่" นิยามเดียวใช้ทั้งแผงและปฏิทิน |
| `src/components/follow/FollowCallRoundsPanel.tsx` | prop `onRoundChange` — ยกรอบที่เลือกขึ้นให้หน้าแม่ |
| `src/pages/follow/FollowPage.tsx` | กรองแถวปฏิทินตามรอบ · ย้ายปุ่ม "เพิ่มคนที่ต้องการติดตาม" เข้า `headerExtras` |

⚠️ **ปุ่มเพิ่มคนอยู่นอก `canManageMasters`** — ปุ่มนั้นทุกคนกดได้ ต่างจากเพิ่มเรื่อง/เพิ่มเจ้าหน้าที่ (supervisor+)
⚠️ **กรองระดับคน ไม่ใช่ระดับรอบ** — แผงข้างบนนับคน ถ้าปฏิทินกรองระดับรอบ เลขกับจำนวนแถวจะเถียงกัน
⚠️ เลขบนกล่อง (28 คน) กับจำนวนแถว (7) ต่างกันโดยธรรมชาติ — กล่องนับทุกเดือน ปฏิทินเดือนเดียว
⇒ **ติดป้ายบอกบนหัวตาราง** "กำลังดู การโทรครั้งที่ N · เฉพาะเดือนนี้" ไม่ปล่อยให้คนเดา

**ด่านตรวจ:** test 2,548 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** ป๊อปของนายวิศิษฐ์โชว์ครบ 3 รอบ (มี "11:00 ยกเลิกแล้ว") ·
กดครั้งที่ 1/2/3 ปฏิทินเหลือ 7/3/0 แถวตามเลขบนกล่อง · ปุ่มเพิ่มคนอยู่แถวเดียวกับเพิ่มเจ้าหน้าที่แล้ว


### รอบเจ็ดสิบห้า (ต่อ 2) — *"ทำไมไม่มีบอกผลด้วยเลยอะว่าผลเป็นยังไง"*

ช่องปฏิทินมีแต่ **เวลา + สี** ⇒ ต้องกดเข้าไปดูถึงจะรู้ว่าคุยจบยังไง
(สีบอกได้แค่ "กลุ่มไหน" ไม่ได้บอกว่า "ไม่สนใจ" หรือ "ขอเลื่อน" — คนละความละเอียด)

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/followPlanning.ts` | **`roundResultLabel()` ใหม่** — คำสั้นบอกผลของรอบนั้น (เทสต์ 20 ข้อรวมไฟล์) |
| `src/components/follow/FollowPlanningCalendar.tsx` | ชิปในช่องเป็นสองบรรทัด: เวลา + ผล · คอลัมน์กว้างขึ้นเป็น 64px |

**กติกา:**
* 🔴 อ่านคำจากตารางกลาง (`CALL_OUTCOME_LABEL` / `FOLLOW_OUTCOME_LABEL`) **ห้ามประดิษฐ์คำเอง**
  รหัสที่ไม่มีคำแปล = โชว์รหัสไปตามตรง (มีเทสต์คุม)
* 🔴 **ยังไม่มีผลต้องเขียนว่า "ยังไม่มีผล"** ไม่ใช่ปล่อยช่องว่างให้คนเดา
  (เลยเวลา = ยังไม่มีผล · ส่งแล้ว = รอผล · ยังไม่ถึงเวลา = รอถึงเวลา)
* ลำดับการตัดสินต้องตรงกับ `followRoundState` ไม่งั้นสีกับคำบนชิปเดียวกันขัดกันเอง

**ด่านตรวจ:** test 2,552 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** ช่องขึ้น "11:05 ไม่สนใจ" · "11:13 เบอร์ผิด" · "11:00 ขอเลื่อน" ·
"11:15 รับทราบ" · "11:12 ยังไม่มีผล" ครบทุกแถว


### รอบเจ็ดสิบหก — *"ระบบเขาบอกยกเลิก ทำไมระบบเราไม่บอกยกเลิกด้วย"*

เคสนายวิศิษฐ์ (1 ก.ย. 2569) · ไล่ผลจริงในคิวแล้วพบว่า **ผลตรงกันเป๊ะ แต่คำต่างกัน**:
Lumos สรุปสาย 11:15 เป็น `declined` + สรุปไทยว่า *"ผู้รับสายแจ้งว่าไม่ไปทำงานแล้ว"*
⇒ ฝั่งเขาอ่านว่า **ยกเลิก** · จอเราแปล `declined` เป็น **"ไม่สนใจ"**

🔴 **ต้นเหตุคือคำเดียวใช้สองบริบท** — `CALL_OUTCOME_LABEL` เป็นตารางกลางที่เขียนไว้
สำหรับงาน**หาคน** ("ไม่สนใจตำแหน่งนี้") พอเอามาใช้กับงาน**ติดตาม** (คนที่รับปากแล้ว
บอกว่าไม่ไป) ความหมายเพี้ยนทันที · **ห้ามแก้ตารางกลาง** เพราะหน้าจับคู่งานใช้คำเดิมถูกอยู่

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/callOutcomeTone.ts` | **`followCallOutcomeText()` ใหม่** — ชุดคำเฉพาะบริบทติดตาม ทับเฉพาะคำที่เพี้ยน แล้วถอยไปใช้ตารางกลาง |
| `src/lib/followPlanning.ts` · `FollowRoundsDialog.tsx` | เรียกตัวใหม่แทน |
| `tests/api/pageTitleParity.test.ts` | ด่านเดิมเปลี่ยนไปเฝ้า `followCallOutcomeText(` |

**คำที่ทับ:** `declined` → "ยกเลิก — ไม่ไปแล้ว" · `confirmed` → "ยืนยันว่าไป" ·
`acknowledged` → "รับสายแล้ว" (ของเดิม "รับทราบ" อ่านเหมือนจบดี ทั้งที่หลายสาย
แค่รับสายแล้วไม่ตอบอะไร — วัดจาก transcript จริง)

⚠️ **ยังไม่ได้ทำ (รอเจ้าของเคาะ):** ผลจาก AI **ไม่ไหลไปเปลี่ยนสถานะงาน** —
คนที่ AI ได้คำตอบว่าไม่ไปแล้ว ยังค้างอยู่แท็บ "กำลังตาม" จนกว่าคนจะกดปิดเอง
(กติกาเดิม: ปิดงานแทนคน = เดาแทนคน · 22 ส.ค. 2569)

**ด่านตรวจ:** test 2,555 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** แถวนายวิศิษฐ์ขึ้น "11:00 รับสายแล้ว · 11:15 ยกเลิก — ไม่ไปแล้ว"


### รอบเจ็ดสิบเจ็ด — สีต้องแปลว่า "ดี/ร้าย" ไม่ใช่ "ข้อมูลมาถึงหรือยัง"

เจ้าของทัก 1 ก.ย. 2569: *"ไม่ไปแล้วแต่เป็นเขียวเนี่ยนะ · ไม่มีผลเป็นสีแดงเพราะอะไร
แล้วทำไมไม่มีผล"*

🔴 **ต้นเหตุ:** ชิปในปฏิทินทาสีตาม **สภาพ** (`FollowRoundState`) ไม่ใช่ตาม **ผล**
⇒ `result` = เขียวเสมอ · คนที่ตอบว่า "ไม่ไปแล้ว" จึงเป็นเขียวเพราะ "ได้ผลแล้ว"
ส่วน `overdue` = แดงเสมอ ทั้งที่แค่ยังไม่มีใครโทร **สีเลยสอนผิดทั้งกระดาน**

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/followPlanning.ts` | **`roundTone()` ใหม่** — สีจากความหมายของผล (ผลโทรใช้ `CALL_OUTCOME_TONE` ตัวกลาง) · **สภาพใหม่ `notSent`** · `roundDispatchReason()` |
| `FollowPlanningCalendar.tsx` · `FollowRoundsDialog.tsx` | ถอดตารางสีของตัวเองทิ้ง ใช้ `roundTone()` ทั้งคู่ · legend เขียนใหม่ตามความหมาย |

**สีชุดใหม่:** เขียว = จบดี (ไป/ยืนยันว่าไป) · แดง = จบไม่ดี (ยกเลิก/ไม่ไปแล้ว) ·
เหลือง = ยังไม่จบ ต้องตามต่อ (เลยเวลา/ขอเลื่อน/ไม่รับ/ลา/เลื่อน) ·
ส้ม = ไม่ได้ส่งให้ AI + เบอร์ผิด (ต้องคนจัดการ) · น้ำเงิน = สายกำลังเดิน · เทา = ยังไม่ถึงเวลา/ยกเลิกทิ้ง

**🔴 สภาพใหม่ `notSent` — ตอบคำถาม "แล้วทำไมไม่มีผล"**
`call_status` เป็น null = ไม่เคยมีแถวในคิวเลย ⇒ **ไม่มีสายไหนกำลังจะเกิดขึ้น**
ของเดิมตกไปกอง `overdue` แล้วเขียนว่า "ยังไม่มีผล" ซึ่งหลอกให้นั่งรอ
ตอนนี้เขียนว่า **"ไม่ได้ส่ง"** (สีส้ม) + เหตุผลเต็มอยู่ที่ tooltip และในป๊อป
**วัดจากฐานจริง:** รายการที่ยังไม่ยกเลิกและไม่มีแถวในคิวมี 6 รายการ —
`suppressed` (เบอร์อยู่ในบัญชีห้ามโทร) 5 · ไม่มีบันทึกเหตุผล 1

**ด่านตรวจ:** test 2,560 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** วิศิษฐ์ = 11:00 รับสายแล้ว (เขียว) · 11:15 ยกเลิก—ไม่ไปแล้ว (แดง) ·
วัชระ = ไม่ได้ส่ง (ส้ม) ทั้งสองรอบ · กิตติพันธ์ = เบอร์ผิด (ส้ม) · สุรเดช = ขอเลื่อน (เหลือง)


### รอบเจ็ดสิบเจ็ด (ต่อ) — *"สีกรอบไม่แก้ไขหรอ"*

รอบก่อนแก้สีชิปแล้ว แต่ **กรอบกล่องของแต่ละรอบในป๊อปยังเป็นเทาทุกใบ**
⇒ กวาดตาแล้วทุกรอบดูเหมือนกันหมด สีที่ชิปเลยไม่ช่วยตอนหาว่าใบไหนมีปัญหา

* `FollowRoundsDialog.tsx` — กรอบ+พื้นกล่องใช้ `TONE[roundTone(r)].soft` ชุดเดียวกับชิป
* ผลบนจอ: รับสายแล้ว = กรอบเขียว · ยกเลิก—ไม่ไปแล้ว = กรอบแดง · ยกเลิกทิ้ง = กรอบเทา
* แถมเก็บกวาด: รอบที่ยกเลิก/ปิดแล้ว **ไม่มีปุ่มให้กด** ⇒ ซ่อนหัวข้อ "จัดการรอบนี้" ไปด้วย
  (เดิมเหลือหัวข้อลอยที่ไม่มีของอยู่ข้างใต้)

**ด่านตรวจ:** test 2,560 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน · ตรวจบนจอแล้ว


### รอบเจ็ดสิบแปด — หน้าบทพูดค้างอยู่ที่ "แก้ค้างอยู่ ยังไม่ได้บันทึก"

เจ้าของทัก 1 ก.ย. 2569: *"บทพูดของ AI ตอนโทร แก้ค้างอยู่ ยังไม่ได้บันทึก แก้ไขที"*

**ไล่แล้วไม่ใช่บั๊กของตรรกะ** — เปิดหน้าใหม่ไม่ขึ้นคำเตือน (ทานกับ `/api/call-scripts`
แล้วตรงกับที่บันทึกไว้) เคสนี้คือ **แท็บที่เปิดค้างไว้ถือ draft เก่า** แล้วบทถูกบันทึกทับ
จากอีกที่ (ผมแก้คำ "คุณคุณ" ให้เมื่อ 1 ก.ย.)

🔴 **แต่จอผิดจริงตรงที่ไม่มีทางออก** — มีแต่คำเตือนลอย ๆ กับปุ่มบันทึก
ถ้าไม่อยากเอาที่พิมพ์ค้าง **ไม่มีปุ่มทิ้ง** ต้องรีเฟรชเอง และถ้าเผลอกดบันทึก
= เขียนทับของใหม่ด้วยของเก่าโดยไม่มีอะไรเตือน

* `src/pages/settings/CallScriptsTab.tsx` — เพิ่มปุ่ม **"ทิ้งที่แก้ค้าง"** (ดึงบทที่บันทึกไว้จริงกลับมา)
  + เขียนคำเตือนให้ชัดว่า *"ข้อความในช่องต่างจากบทที่ใช้จริงตอนนี้"*
* **กติกา:** สถานะ "แก้ค้าง" ต้องมีทางออกสองทางเสมอ (บันทึก / ทิ้ง) ห้ามมีทางเดียว

**ด่านตรวจ:** test 2,560 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอแล้ว:** พิมพ์แก้ → ปุ่มโผล่ + คำเตือนใหม่ · กดทิ้ง → ข้อความกลับเป็นของที่บันทึกไว้ คำเตือนหาย


### รอบเจ็ดสิบเก้า — เก็บกวาดหน้าติดตาม + เพิ่มคนจาก ERP ที่หน้าดูแลหลังเริ่มงาน

คำสั่งเจ้าของ 1 ก.ย. 2569 (สี่ข้อรวด)

| ทำอะไร | ไฟล์ |
|---|---|
| **หน้าดูแลหลังเริ่มงาน: เพิ่มคนจากบอร์ด ERP** — ปุ่มเปิด `BoardPersonPicker` **ตัวเดียวกับหน้าติดตาม** แล้ว `moveToAftercare({source:'manual'})` | `src/pages/aftercare/AftercarePage.tsx` |
| **ถอดแถบสรุปเลข** (ต้องโทรใครตอนนี้ / สถานะสาย) และ **ปุ่มรีเฟรช** | `src/pages/follow/FollowPage.tsx` |
| **ตัวกรอง → ไอคอนปฏิทิน + ช่วงเวลา** (แผง 3 ช่องพับได้ถูกถอด · ตัวกรองเจ้าของงานถูกถอดตามคำสั่ง) | `FollowPage.tsx` · `src/components/shared/DayCalendarPicker.tsx` (**ใหม่**) |

**`DayCalendarPicker` (ใหม่):** เลือก **วันเดียว** จากไอคอนปฏิทิน + เลื่อนเดือน/ปีด้วย dropdown
· กากบาทในปุ่มล้างวันได้เลย · ต่างจาก `DateRangeCalendarPicker` ที่เลือกเป็นช่วง
⚠️ `captionLayout="dropdown-buttons"` ของ react-day-picker วาดป้ายเดือน/ปีซ้ำอีกชุด
ต้องซ่อนด้วย `caption_label: 'sr-only'` + `vhidden: 'sr-only'` ไม่งั้นเห็นคำซ้ำ 2-3 รอบ

**กติกาที่ติดมา:**
1. 🔴 **ห้ามเดา `unit_name` จาก `area` ของบอร์ด** — `area` คือ "พื้นที่ที่เขาสะดวก"
   (เช่น "เขตพระโขนง กรุงเทพมหานคร") ไม่ใช่หน่วยงานที่ไปทำงาน · ปล่อยว่างให้คนกรอก
   (เจอตอนตรวจ: เพิ่มจริงแล้วหน่วยงานขึ้นเป็นชื่อเขต)
2. `FollowFilter.owner` เปลี่ยนเป็น optional — ตรรกะยังอยู่เผื่อเอาช่องกลับ
3. คนที่เพิ่งเพิ่มเข้าความดูแล **ยังไม่มีวันเริ่มงาน** ⇒ ตั้งรอบโทรไม่ได้จนกรอกวัน (กติกาเดิมของหน้านี้)

**ด่านตรวจ:** test 2,560 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว (ยิงเส้นเขียนจริง):** กดเพิ่มคนจากบอร์ด → POST ผ่าน แถวขึ้นจริงใน `/api/aftercare`
→ **ลบแถวทดสอบออกด้วยเบอร์เป๊ะ ๆ แล้ว** (เหลือ 0 แถวเท่าเดิม) · ปฏิทินเลือกวัน 2/9 → เหลือ 0 แถว ·
ล้างวัน → กลับมา 8 แถว · แถบสรุป/ปุ่มรีเฟรชหายจากจอแล้ว


### รอบเจ็ดสิบเก้า (ต่อ) — ยุบตัวกรองเหลือกล่องเดียว ไปอยู่ข้างปุ่มเพิ่มคน

เจ้าของสั่ง: *"ย้ายทุกช่วงเวลาเข้าไปไว้กับเลือกวัน · พอย้ายเสร็จ ย้ายเลือกวันไปไว้ข้าง ๆ เพิ่มคน"*

* `DayCalendarPicker` รับ prop ใหม่: `extra` (ตัวกรองอื่นใต้ปฏิทิน) · `suffix` (คำต่อท้ายบนปุ่ม)
  · `active` (ทำให้ปุ่มดู "กรองอยู่" แม้ยังไม่เลือกวัน) · `onClearAll` (ล้างทั้งกล่อง)
* `FollowPage` ย้าย picker เข้า `headerExtras` ของแผงการโทร — อยู่ติดปุ่ม "เพิ่มคนที่ต้องการติดตาม"
* ปุ่มโชว์ช่วงเวลาที่เลือกต่อท้าย เช่น **"เลือกวัน · เย็น"** — ตัวกรองซ่อนในป๊อปแล้ว
  ต้องมีอะไรบอกจากนอกป๊อปว่ากรองอยู่ ไม่งั้นเห็นแถวน้อยแล้วนึกว่าข้อมูลหาย

⚠️ ตอนตรวจ: `pop.querySelector('select')` ได้ **dropdown เดือนของปฏิทิน** ไม่ใช่ช่วงเวลา
(กล่องนี้มี select 3 ตัว) — เลือกด้วยข้อความใน option แทน

**ด่านตรวจ:** test 2,560 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** เลือก "เย็น" → ปุ่มขึ้น "เลือกวัน · เย็น" ตารางเหลือ 5 แถว ·
กดล้างตัวกรองทั้งหมด → กลับมา 8 แถว ป๊อปปิดเอง


### รอบแปดสิบ — ปฏิทิน Planning ของหน้าดูแลหลังเริ่มงาน + กรองรอบให้ถึงระดับช่อง

**1. เจ้าของสั่ง:** *"หน้าดูแลหลังเริ่มงาน ก็ขอเป็นภาพแบบ Planning ให้เห็นว่าแต่ละวัน
ต้องโทรหาใครอะไรยังไงบ้าง"*

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/aftercarePlanning.ts` | **ใหม่ · pure** — `buildAftercareMonthRows()` + `aftercareMissingStartDate()` (เทสต์ 5) |
| `src/components/aftercare/AftercarePlanningCalendar.tsx` | **ใหม่** — แถว = คน · คอลัมน์ = วัน · รูปเดียวกับหน้าติดตาม |
| `src/pages/aftercare/AftercarePage.tsx` | โหลดสายหัวข้อ `AFTERCARE_TOPIC` มาประกอบ + วางปฏิทินไว้เหนือรายการ |

🔴 **ช่องมีของสองชั้น ห้ามยุบรวม**
1. **ถึงกำหนดโทร** — คำนวณจาก `start_date` (+3/+7/+30) เป็นแค่ "วันที่ควรโทร"
2. **สายจริง** — รายการหน้าติดตามที่ `topic` = ถามความเป็นอยู่ฯ และเบอร์ตรงกัน (จับด้วยเลข 9 ตัวท้าย)

ถ้าวาดรวมเป็นก้อนเดียว จอจะบอกว่าทำแล้วทั้งที่ยังไม่มีใครโทร
⇒ ถึงกำหนดแล้วไม่มีสาย = เขียน **"ยังไม่ได้ตั้งสาย"** สีเหลือง
⚠️ ไม่รู้วันเริ่มงาน = ไม่มีแถว แต่ต้องนับไว้บอกบนหัว ("ยังไม่รู้วันเริ่มงาน N คน")
♻️ สีและคำของ "สายจริง" ใช้ `roundTone()`/`roundResultLabel()` ตัวเดียวกับหน้าติดตาม

**2. เจ้าของทัก:** *"ช่องปฏิทินหน้าติดตาม ถ้าเลือกการโทรครั้งที่เท่าไหร่
ก็โชว์ข้อมูลของการโทรรอบนั้น ๆ พอสิ"*

รอบก่อนกรองแค่ **แถว** (ใครอยู่รอบนั้น) แต่ช่องยังโชว์ทุกสายของคนนั้น
⇒ `filterPlanningRowsByRound()` ใน `followPlanning.ts` — กรองถึงระดับสาย
และ **คิดเลขสรุปของแถวใหม่** จากสายที่เหลือ (ไม่ยกของเดิมมา ไม่งั้นหัวแถวบอกจำนวนรอบที่มองไม่เห็น)
🔴 ป๊อปรายละเอียดยังอ่านจาก `allRows` ที่ไม่ผ่านตัวกรอง — กดเข้าไปต้องเห็นครบทุกรอบเสมอ

**ด่านตรวจ:** test 2,569 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** ใส่แถวทดสอบ 2 แถว (มี/ไม่มีวันเริ่มงาน) → ปฏิทินขึ้น "ครบ 7 วัน ·
ยังไม่ได้ตั้งสาย" ตรงวันที่ถูกต้อง · ป้าย "ยังไม่รู้วันเริ่มงาน 1 คน" ขึ้นครบ
**ลบแถวทดสอบด้วยเบอร์เป๊ะ ๆ แล้ว** (เหลือแต่ของจริงที่คนอื่นเพิ่งเพิ่ม 1 คน)


### รอบแปดสิบ (ต่อ) — *"ปฏิทินติดตามต้องโชว์ช่องละ 1 สายสิ"*

เลือก "การโทรครั้งที่ 1" แล้วช่องเดียวยังโชว์ทั้ง 16:36 และ 16:40

🔴 **ต้นเหตุ: `followRoundSlot` อ่านจาก `attempt_count` ของคิว**
โหมด "ระบุเวลาเอง" สร้าง **หนึ่งแถวต่อหนึ่งรอบ** แต่ละแถวมีคิวของตัวเอง
⇒ `attempt_count` ของทุกแถวเป็น **1** หมด (คิวนั้นเพิ่งโทรครั้งแรก)
**ทุกรอบจึงไปกองอยู่ "ครั้งที่ 1"** ทั้งที่ 16:40 คือสายที่ 2 ที่คนเลือกไว้เอง

⇒ `followRoundSlot` ใช้ **`call_round` ที่คนเลือก (migration 113) ก่อนเสมอ**
แล้วค่อยถอยไป `attempt_count` สำหรับแถวเก่าที่ไม่มีค่านี้
· ช่องในปฏิทินโชว์ 1 สาย เกินนั้นเป็น "+N" (ไม่ตัดเงียบ)

⚠️ **"+N" ที่ยังเหลืออยู่ไม่ใช่บั๊ก** — เป็นเคสที่ **คนละชื่อใช้เบอร์เดียวกัน**
(ข้อมูลทดลองใช้เบอร์ซ้ำ) · กติกาจัดกลุ่มคือ **เบอร์ + เรื่อง = คนเดียว**
(เจ้าของเคาะเอง 18 ส.ค. 2569) ⇒ สองงานบนเบอร์เดียวจึงรวมเป็นแถวเดียวโดยตั้งใจ

**ด่านตรวจ:** test 2,571 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** ครั้งที่ 1 = 16:36/16:38/16:40/16:50 ช่องละสายเดียว ·
ครั้งที่ 2 = 16:40/16:42/16:45/16:55 คนละชุดกัน ไม่ปนกันแล้ว


### รอบแปดสิบเอ็ด — ฝั่งเราจากลิสต์ "อัปเดต Lumos 1 ก.ย. 2569 17:00 น."

เจ้าของส่งปัญหา 10 ข้อ + บทพูดชุดใหม่ แล้วสั่งว่า *"เริ่มแก้ฝั่งเรา"*
(ข้อ 1/2/3/4/5 กับครึ่งหนึ่งของข้อ 9 เป็นฝั่ง Lumos — จดไว้ที่ `docs/plan-follow-2569-09-01.md`)

**A. บทพูดชุดใหม่ (เจ้าของเขียนคำต่อคำ — ห้ามเรียบเรียงเอง)**

| ไฟล์ | ทำอะไร |
|---|---|
| `api/_lib/lumosCallScript.ts` | **`stripThaiNamePrefix()`** ตัดนาย/นาง/นางสาว/น.ส./ด.ช./ด.ญ. ก่อนเติม "คุณ" · เพิ่มตัวแปร `{ชื่อเจ้าหน้าที่}` · ส่ง `{หน่วยงาน}` เข้าบทติดตาม |
| `api/_lib/lumosCallScript.templates.ts` | บท `ติดตาม` + `ติดตามรอบถัดไป` เขียนใหม่ทั้งสองชุด |
| `api/_lib/lumosDispatch.ts` | `FollowEntryInput` += `staffName` · `unitName` |
| `api/_handlers/follow.ts` | **`staffNameOfPhone()`** — หาชื่อเจ้าหน้าที่จาก `follow_staff_contacts` ด้วยเลข 9 ตัวท้าย (ไม่เพิ่มคอลัมน์ในใบติดตาม) |

🔴 **ของเดิมพูดว่า "คุณนายสุรเดช"** (เติม "คุณ" หน้าชื่อดิบที่มีคำนำหน้าอยู่แล้ว)
🔴 **`{ชื่อเจ้าหน้าที่}` / `{หน่วยงาน}` ส่งค่าว่างเมื่อไม่มีข้อมูล ห้ามใช้ `orDrop`** —
ไม่งั้นบรรทัดทักทายกับบรรทัดคำถามหลักหายทั้งบรรทัด เหลือสายที่ไม่ได้ถามอะไรเลย
⚠️ **บทใหม่ไม่พูด "เรื่อง" และไม่อ่านเบอร์ติดต่อกลับแล้ว** (บทของเจ้าของไม่มีสองท่อนนี้)
เบอร์เจ้าหน้าที่ยังส่งเป็น `admin_phone` เหมือนเดิม แค่ไม่ได้พูดออกไป — มีเทสต์เฝ้าว่าตั้งใจ
⚠️ **ลบ override ในฐานทิ้งแล้ว** เพื่อให้ใช้บทมาตรฐานในไฟล์ (แก้ต่อจากหน้าตั้งค่าได้เหมือนเดิม)

**B. ข้อ 10 — แก้แล้วทำต่อเนื่อง** `FollowPage` จำช่องที่เปิดอยู่ (`cellToReopen`)
ก่อนเปิดกล่องแก้ไข แล้วเปิดป๊อปเดิมกลับให้เองเมื่อกล่องแก้ไขปิด (กติกาห้ามซ้อน Dialog ยังอยู่)

**C. ข้อ 8 — ผลสายแรกทุกคน + เครื่องหมายเขียว** คอลัมน์ "ผลสายแรก" ในปฏิทิน
· `firstCallOfRow()` = สายที่ **คนตั้งว่าเป็น `call_round` 1** (ไม่ใช่สายที่เวลาน้อยสุด)
🔴 คำนวณจาก **ชุดที่ยังไม่กรองรอบ** — ไม่งั้นเลือก "ครั้งที่ 2" แล้วเอาสายที่ 2 มาแปะป้ายว่าสายแรก

**D. ข้อ 6 — บัญชีห้ามโทรมีหน้าจอแล้ว**
`api/_handlers/call-suppression.ts` (GET ดู · DELETE ปลด · supervisor+) +
แท็บ `บัญชีห้ามโทร` ที่หน้าตั้งค่า (`CallSuppressionTab.tsx`)
⚠️ จอเขียนเตือนไว้ว่า **ปลดแล้วมีผลกับสายที่สร้างใหม่เท่านั้น** สายเก่าที่เคยถูกปฏิเสธไม่เคยเข้าคิว

**ยังไม่ได้ทำ:** ข้อ 7 (แดชบอร์ดเลขไม่ถูก) — รอเจ้าของชี้ว่าเลขไหนผิด

**ด่านตรวจ:** test 2,568 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว:** บทใหม่ขึ้นที่หน้าตั้งค่า · คอลัมน์ "ผลสายแรก" ขึ้นครบทุกแถว ·
กดแก้ไขแล้วปิด → ป๊อปช่องเดิมเปิดกลับเอง · แท็บบัญชีห้ามโทรใส่เบอร์ทดสอบแล้วกดปลดได้จริง
(ลบแถวทดสอบออกแล้ว เหลือ 0)


### รอบแปดสิบสอง — ชื่อเล่น + สายงาน ย้ายมาอยู่บนบัญชีผู้ใช้

เจ้าของสั่ง 1 ก.ย. 2569: *"เอาตำแหน่งพวกนี้มาเพิ่มพร้อมเบอร์โทรในหน้าผู้ใช้งาน
จะได้กำหนดทั้ง Role คัดสรร ฯลฯ ชื่อเล่น และเบอร์โทรทีเดียว"* +
*"หน้าคัดสรร สรรหา ปล่อยไว้แบบนั้นก่อน เพราะตอนนี้ใช้งานอยู่ ถ้าลบเดี๋ยวกระทบใบขอ
แต่อนาคตให้ dropdown มาเอาชื่อเล่นจากตรงนี้แทน"*

**สภาพก่อนแก้ (วัดจริง):** คนหนึ่งคนถูกคีย์ **3 ที่** — `users` 55 บัญชี (ชื่ออังกฤษจาก
Microsoft · **ไม่มีใครมีเบอร์เลย 0/55**) · `job_staff_roster` 41 ชื่อ (ชื่อเล่นไทย
recruiter 11 · screener 9 · opl 18 · online 3) · `follow_staff_contacts` 4 ชื่อ+เบอร์
🔴 **จับคู่ชื่ออัตโนมัติได้ 0 คู่** — คนละภาษา คนละรูปแบบ

| ไฟล์ | หน้าที่ |
|---|---|
| `migrations/114_users_nickname_lanes.sql` | `users.nickname` + `users.job_lanes text[]` · ไม่มี CHECK · **รันบนฐานจริงแล้ว** |
| `src/lib/jobLanes.ts` | **ใหม่** — ชุดสายงาน + คำไทย + `jobLanesText()` (ว่าง = "ยังไม่ตั้ง") |
| `api/_handlers/app-users.ts` | PATCH รับ `nickname` / `job_lanes` (ตรวจค่าที่ handler) · GET คืนมาด้วย |
| `src/lib/userApi.ts` · `src/types/index.ts` | ให้ฟิลด์ใหม่ผ่านตัวตรวจ |
| `src/pages/settings/AdminSettings.tsx` | คอลัมน์ "ชื่อเล่น" + "สายงาน" (ติ๊กได้หลายสาย) |

🔴 **กับดักที่เจอตอนตรวจ: `parseAppUser()` ทิ้งฟิลด์ที่ไม่ได้เขียนไว้**
บันทึกผ่าน 200 · ฐานมีค่าจริง · แต่รีเฟรชแล้วช่องว่างเปล่า เพราะตัวตรวจฝั่งจอไม่ได้ส่งต่อ
⇒ **เพิ่มช่องใหม่ที่ API เมื่อไหร่ ต้องไปเติมที่ `userApi.parseAppUser` ด้วยเสมอ** (มีเทสต์คุมแล้ว)

⚠️ **ยังไม่ได้ย้าย dropdown** — ทั้งระบบยังอ่านชื่อจาก `job_staff_roster` เหมือนเดิม
ชุดใหม่ให้คนทยอยกรอกก่อน (เจ้าของสั่งเอง) · วันที่จะย้ายต้องมีคนจับคู่ชื่อเล่น↔บัญชีด้วยมือ

**ด่านตรวจ:** test 2,573 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอจริงแล้ว (ยิงเส้นเขียนจริง):** กรอกชื่อเล่น + ติ๊กสายงาน → บันทึกจริง →
รีเฟรชแล้วค่ายังอยู่ → **คืนค่าแถวทดสอบกลับเป็นว่างแล้ว**


### รอบแปดสิบสาม — feedback หน้าติดตาม 2 ก.ย. 2569 (3 ข้อ)

**1. 🔴 แดชบอร์ดการโทรไม่ถูกต้อง — เจอต้นเหตุแล้ว**

ไล่ฐานจริง: 7 สาย = สายที่ 1 สี่ราย · สายที่ 2 สามราย
แต่แผง "การโทรครั้งที่ 1/2/3" ขึ้น **7 / 0 / 0**

ต้นเหตุเดียวกับที่แก้ปฏิทินไปเมื่อ 1 ก.ย. แต่ **ยังเหลืออีกสองที่ที่ไม่ได้ตามไปแก้**:
`FollowCallRoundsPanel` (client) และ `lumos-call-funnel` (SQL ฝั่งฐาน) ยังอ่าน
`attempt_count` ตรง ๆ ⇒ โหมดระบุเวลาเองสร้างหนึ่งแถวต่อหนึ่งรอบ แต่ละแถวมีคิวของตัวเอง
`attempt_count` เลยเป็น 1 หมด **ทุกรอบไปกองที่ครั้งที่ 1**

| ไฟล์ | แก้อะไร |
|---|---|
| `src/components/follow/FollowCallRoundsPanel.tsx` | ใช้ `followRoundSlot()` แทน `callAttemptSlot()` |
| `src/components/home/FollowTodayPanel.tsx` | เหมือนกัน — ไม่งั้นหน้าแรกกับหน้าติดตามเถียงกัน |
| `api/_handlers/lumos-call-funnel.ts` | SQL join `follow_entries` แล้วใช้ `coalesce(f.call_round, q.attempt_count, 1)` · ช่องทางอื่นไม่มีแถวติดตามคู่กัน จึงใช้ `attempt_count` เหมือนเดิม |

⚠️ **join แล้วต้องใส่ alias `q.` ให้ครบ** — `created_at` มีทั้งสองตาราง (เทสต์ `callFunnelSource` เฝ้าอยู่)
✅ ทานหลังแก้: SQL คืน round 1 = 4 · round 2 = 3 ตรงกับฐานแล้ว

**2. สถานะการโทรเบอร์ฉุกเฉิน — ทำได้ครึ่งเดียว (เพราะ Lumos ยังไม่ส่งข้อมูล)**

ตรวจ `result` ทุกช่องที่ Lumos ส่งกลับอีกรอบ (2 ก.ย.) — **ยังไม่มีช่องเรื่องเบอร์ฉุกเฉิน**
⇒ ที่ทำได้คือโชว์ว่า **เราส่งเบอร์อะไรไป** (`payload->>'admin_phone'`)
· `follow.ts` คืน `emergency_phone` · ป๊อปเขียนว่า *"เบอร์ฉุกเฉินที่ส่งไป 08x · ยังไม่รู้ว่าโทรหรือยัง"*
🔴 **ห้ามเขียนว่า "โทรแล้ว"** จนกว่า Lumos จะส่งข้อมูลมา — นั่นคือจอโกหก

**3. ย้อนสถานะปิดงานได้แล้ว**

`PATCH /api/follow?id=… { action: 'reopen' }` — ล้าง `completed_at`/`outcome_code`/`outcome_note`
· ปุ่ม "ย้อนสถานะ" ในป๊อปของรอบที่ปิดไปแล้ว
🔴 **ไม่แตะคิวโทร และย้อนรายการที่ยกเลิกไม่ได้** — ปิดงานเป็นบันทึกของคน (ย้อนได้)
ส่วนสายที่โทรไปแล้วเป็นเหตุการณ์จริง (ย้อนไม่ได้) · ยกเลิกเป็นคนละเรื่องกับปิดงาน

**ด่านตรวจ:** test 2,577 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
⚠️ **ยังไม่ได้ตรวจบนจอ** — เซสชันเบราว์เซอร์ที่ใช้ตรวจหมดอายุ (`/api/follow` ตอบ 401)
และล็อกอินแทนเจ้าของไม่ได้ · ทานเลขด้วย SQL ตรงแทน (round 1 = 4 · round 2 = 3)


### รอบแปดสิบสี่ — Staff จัดการช่องทางรับสมัครได้ (2 ก.ย. 2569)

เจ้าของสั่ง: *"หน้ากล่องงานตรงพวกเพิ่มช่องทางหลัก ทางรอง ลบช่องทางหลัก ช่องทางรอง
ทำให้ Staff เข้าถึงได้ด้วย ตอนนี้ Staff น่าจะไม่เห็น"*

**สภาพก่อนแก้:** ทั้งแถบ "ตั้งค่าบอร์ด" บนกล่องงานผูกกับฟังก์ชันเดียว `recruit_postings`
(ขั้นต่ำ supervisor) ⇒ staff ไม่เห็นทั้งแถบ · และ API `recruit-channels` ก็กั้นเขียนที่ supervisor

🔴 **ไม่ลดขั้นของ `recruit_postings`** — นั่นคือสิทธิ์ปล่อยประกาศขึ้นหน้าสาธารณะ
(ของที่คนนอกเห็นทันที) ⇒ **แยกฟังก์ชันใหม่** สำหรับช่องทางซึ่งเป็นข้อมูลอ้างอิงในบ้าน

| ไฟล์ | แก้อะไร |
|---|---|
| `src/lib/roleFunctions.ts` | ฟังก์ชันใหม่ `recruit_channels_manage` (ขั้นต่ำ staff) |
| `api/_lib/roleFunctionGrants.ts` | เพิ่มตัวเดียวกันฝั่ง API + **เติม `aftercare_read` ที่ตกหล่นมานาน** |
| `api/_lib/rbac.ts` | `recruit-channels` เขียนได้ตั้งแต่ staff |
| `src/pages/recruit/RecruitChannelsPage.tsx` | `canManage` ใช้ฟังก์ชันใหม่ |
| `src/components/jobs/RecruitBoardTools.tsx` | แยกสิทธิ์รายปุ่ม — "ช่องทาง" ใช้ฟังก์ชันใหม่ · "สร้างลิงก์/เหตุผล" ยังเป็น `recruit_postings` · ปิดหมดค่อยซ่อนทั้งแถบ |
| `tests/api/roleFunctionSync.test.ts` | **ใหม่** — บังคับให้รายชื่อฟังก์ชันสองฝั่งตรงกันทุกตัว |

🔴 **กับดักที่เจอ: รายชื่อฟังก์ชันมีสองที่** (`src/lib/roleFunctions.ts` กับ
`api/_lib/roleFunctionGrants.ts`) — เพิ่มข้างเดียวแล้ว **PATCH ถูกปฏิเสธเงียบ ๆ**
admin กดสวิตช์แล้วเหมือนไม่มีอะไรเกิดขึ้น · ไล่เจอว่า `aftercare_read` ตกหล่นแบบนี้มานาน
⇒ เขียนเทสต์คุมทั้งรายชื่อและระดับขั้นต่ำแล้ว

**ด่านตรวจ:** test 2,582 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ตรวจบนจอ/ยิงเส้นจริงแล้ว:** หน้าจัดช่องทางเปิดได้ (ช่องทางหลัก 43 · ช่องทางรอง 4,345) ·
แท็บบทบาทและสิทธิ์ขึ้นฟังก์ชันใหม่พร้อมป้าย "ขั้นต่ำ: Staff" ·
`/api/role-permissions` คืน staff = true (channels) · false (postings) · opl = false


### รอบแปดสิบสี่ (ต่อ) — Staff ทำได้ทั้งแถบ (สร้างลิงก์ + เหตุผล ด้วย)

เจ้าของสั่งต่อทันที: *"Staff ก็ทำได้ แก้เลย"* (ตอบข้อที่ผมกันไว้ว่ายังเป็นหัวหน้างาน)

* `recruit_postings` ลดขั้นต่ำจาก supervisor → **staff** (ทั้ง `src/lib/roleFunctions.ts`
  และ `api/_lib/roleFunctionGrants.ts` — เทสต์ sync คุมอยู่)
* `recruit-reasons` ฝั่ง rbac: เขียนได้ตั้งแต่ staff (เดิม supervisor)

🔴 **ทานก่อนลดขั้น — ไม่ได้เปิดสิทธิ์ปล่อยประกาศใหม่ให้ใคร**
* ปุ่มปล่อยประกาศขึ้นหน้าสาธารณะบนการ์ดใบขอ **ไม่เคยผูกกับฟังก์ชันนี้** (ไล่ `isFunctionEnabled`
  ในหน้ากล่องงานแล้ว มีแค่ `unit_notes_edit` กับแถบเครื่องมือ)
* ฝั่ง API `job-public-release` ใช้คีย์ `recruit-postings` ซึ่ง rbac **เปิดถึง staff อยู่ก่อนแล้ว**
⇒ ฟังก์ชันนี้คุมแค่แถบเครื่องมือบนกล่องงาน (สร้างลิงก์ประกาศลอย + เหตุผล)

⚠️ ในฐานมี override เก่า `supervisor:recruit_postings = true` ค้างอยู่ — ไม่กระทบ
(ค่าเดิมกับค่าใหม่ตรงกัน) แต่ **override ของ role อื่นจะทับค่าตั้งต้นเสมอ**
ถ้าวันหน้าเจอ role ไหนยังไม่เห็นแถบ ให้ดูตารางนี้ก่อนโทษโค้ด

**ด่านตรวจ:** test 2,583 ผ่าน / 6 skip · tsc 4 = 0 · eslint 0 err / 18 warn · build ผ่าน
**ยิงเส้นจริงแล้ว:** `/api/role-permissions` คืน staff = เปิดทั้ง postings และ channels · opl = ปิดทั้งคู่
