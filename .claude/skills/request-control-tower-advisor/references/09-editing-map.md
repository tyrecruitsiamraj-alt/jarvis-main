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
