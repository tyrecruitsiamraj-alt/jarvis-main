# Session Handoff — 4 ส.ค. 2569

เอกสารส่งต่อจาก session วันที่ 4 ส.ค. 2569 (ต่อจากฉบับ 3 ส.ค.)
สถานะโค้ด: `main` = `e7895e5` · working tree สะอาด · **deploy สำเร็จทุก commit (16 ของเรา + 3 ของทีมอื่น)**

> อ่านฉบับก่อนหน้าประกอบ: `2026-08-03-session-handoff.md` (สถาปัตยกรรม/Lumos/waterfall) และ
> `2026-07-31-session-handoff.md` (ขนาด iRecruit ข้อ 4.2 = แผนย้าย 136k)

---

## 0. ⚠️ อ่านก่อนเริ่มงาน (ยังจริงทุกข้อ)

- **`.env.local` ชี้ DB production จริงทั้ง PostgreSQL/MSSQL ไม่มี dev DB** — เขียนอะไรลงไปคือของจริง
  ทดสอบที่ต้องเขียนให้ใช้วิธี "แก้แล้วคืนค่าเดิมทันทีในคำสั่งเดียว" (ทำแบบนี้ 2 ครั้งใน session นี้ สำเร็จ
  ทั้งคู่: ตั้ง BU พนักงาน DC-030 แล้วคืนเป็นว่าง · เพิ่มสถานะทำงาน `ztest_probe_tmp` แล้วลบ)
- **auto-send "ส่ง AI โทร" ยังเปิดอยู่** — รัน AI match บนเครื่อง = เทคนจริงเข้าคิวโทร
- **Lumos ยังหยุด poll** (ตั้งแต่ ~1 ส.ค.) คิวโตขึ้นเรื่อย ๆ · ยังไม่ได้ตามทีม Lumos — **งานค้างอันดับ 1**
- **iRecruit/MSSQL อ่านอย่างเดียว ห้ามเขียนกลับ** (ทีมอื่นใช้อยู่)
- **มีทีมอื่น push ขึ้น main ระหว่างวัน** — session นี้เจอ 1 ครั้ง (4 commits: worker-status endpoint,
  refactor job loading, known-stored guard) แก้ด้วย `git pull --rebase origin main` ผ่านฉลุย
  → **ก่อน push ทุกครั้งควร fetch ดูก่อน** และ typecheck/test ซ้ำหลัง rebase

---

## 1. สิ่งที่ทำเสร็จใน session นี้ (16 commits)

### หน้าเว็บไม่รัน AI สดแล้ว — คิดที่ worker หลังบ้านอย่างเดียว (`a450b67`)
- `GET /api/matching/board-candidates?jobId=` **ไม่เรียก LLM ใน request** อีกต่อไป
  ใบที่ยังไม่มีผล → ตอบ `{pending:true}` + ส่งเข้า**หัวคิว** worker (`front:true`)
  "ค้นหาใหม่" → enqueue `refresh` แล้วโชว์ผลเดิมไปก่อน ผลใหม่มาแทนเมื่อคิดเสร็จ
- หน้า Matching มีสถานะ "AI กำลังคิดที่หลังบ้าน" + poll ทุก 15 วิ เฉพาะใบที่เปิดอยู่ · ถอด prewarm
- `applyEnqueue()` ใน worker: แทรกหัวคิว + อัปเกรด refresh (ไม่ลดระดับ) + `isMatchPrecomputeWorkerActive()`
- ถอด gate Ollama ออกจาก handler (ไม่เรียก LLM แล้ว เสิร์ฟผลที่เก็บไว้ได้แม้ไม่ตั้งค่า Ollama)

### BU (department) — แยกดู + ล็อก + ปิดรูรั่ว
- **หน้า Matching แยกดูตาม BU** (`1393956`, `5a1bb34`): dropdown BU คู่กับหน่วยงาน พร้อมยอดต่อ BU
  (SN 3 · DS 25 · LM 88 · LBA 26 · LBD 192 · รวม 338–339) · **ผู้ใช้ที่ถูกล็อก BU ไม่เห็นช่อง BU เลย**
  · BU = ขอบเขตการดู → dropdown หน่วยงาน/สรุปงานด่วนหดตาม BU ที่เลือก
- **ปิดรูรั่ว BU 7 เส้นทาง** (`6ed8d3d`) — ตรวจทั้งระบบด้วย agent แล้วพบว่า **การกรอง BU เป็นความรับผิดชอบ
  ของแต่ละ handler เอง ไม่มีอะไรบังคับ** handler ใหม่ที่ลืมกรองจะรั่วเงียบ ๆ ที่ปิดแล้ว:
  | เส้นทาง | เดิมรั่วอะไร | ผลทดสอบ admin→staff(LBD) |
  |---|---|---|
  | `/api/jobs?id=siamraj:` | ประตูหลังอ่านใบขอทุก BU | 200 → **404** |
  | `matching-parse-branch-demand-job` | ข้อความใบขอเต็ม + ผลแมทสาขา | 200 → **404** |
  | `job-applications` (counts/list/PATCH) | ชื่อ-เบอร์-ที่อยู่ผู้สมัครทุก BU (PDPA) | 6→**4**, counts 4→**2** |
  | `job-application-document` | ดาวน์โหลด CV ข้าม BU ด้วยการเดา uuid | เช็ค job_id ก่อนส่งไฟล์ |
  | `matching-job-postings` (list/PATCH) | snapshot ใบขอทุก BU + แก้ของ BU อื่น | 9 → **4** |
  | `employees` (GET+PATCH) | รายชื่อ/แก้พนักงานทุก BU | ใช้ `department_code` ที่มีอยู่ |
  | `siamraj/unit-notes?history=1` | autocomplete หมายเหตุทุก BU | 100 → **76** |
  - เพิ่ม helper `loadScopedJobIdSet()` (ตารางที่เก็บ `job_id` = `siamraj-sql:<เลขใบขอ>`)
  - **RBAC คุมแค่ role ไม่มีมิติ BU** — ข้อเสนอเชิงโครงสร้าง: ทำ `withRbac(..., {requireScope:true})`
    ให้ scope เป็น opt-out ไม่ใช่ opt-in (ยังไม่ได้ทำ)

### pagination — ทุกหน้าเลือกจำนวนต่อหน้าได้ (ตามที่เจ้าของสั่ง)
- **Matching**: ปุ่ม 20/40/60/100 จำค่าใน `localStorage` key `jarvis:matching-page-size`
- **Users (Settings)**: 10/หน้า เลือก 10–50 · **ยกบล็อก "จัดการสิทธิ์ผู้ใช้" ที่ซ้ำกับตารางออก**
  เหลือตารางเดียว (ชื่อ/Username/Email/Role/แผนก/สถานะ/Actions)
- **Audit Log**: 20/หน้า เลือกได้
- **หน้าผู้สมัคร**: เปลี่ยนจาก fix 20 มาใช้ `ListPaginationBar` กลาง (10–50)
- component กลางที่ใช้ซ้ำได้: `src/components/shared/ListPaginationBar.tsx` + `src/lib/pagination.ts`

### หน้า Matching — visual control
- **สีบอกอายุใบขอ** (`64e8580`): แถบสีซ้ายการ์ด + ป้ายระดับ+จำนวนวัน + คู่มือสีเหนือลิสต์
  เกณฑ์ที่เจ้าของกำหนด: **≤7 ยังไม่ด่วน(เขียว) · 8–30 เริ่มด่วน(เหลือง) · 31–60 ด่วน(ส้ม) · 60+ ด่วนมาก(แดง)**
  ไม่รู้อายุ = เทา (ไม่เดาเป็นเขียว) · helper: `ageUrgencyLevelFromDays()`, `JOB_AGE_URGENCY_META` ใน `jobUrgency.ts`
  · **คนละมิติกับป้าย "ด่วน/ล่วงหน้า" ของ ERP และคนละเรื่องกับ SLA** — แสดงคู่กันได้
- **เรียงลิสต์ 5 แบบ** (`ea6afd9`): SLA/ด่วนก่อน (default ห้ามเปลี่ยน) · ค้างนานสุด→ใหม่สุด ·
  ใหม่สุด→ค้างนานสุด · มีคนแนะนำก่อน · ยังไม่มีคนแนะนำก่อน (ทำใน `matchingListFilter` = โค้ดชุดเดียว 2 ฝั่ง)
- **กล่องสรุป 5 ใบกดกรองได้** (`a9ff779`): ใบขอทั้งหมด 338 · ด่วน 242 · เขียว 180 · **เหลือง 20** ·
  ยังไม่มีคน 138 — กดแล้วตั้งฟิลเตอร์ตรงเลข · เปลี่ยนฐานนับจาก "เฉพาะใบด่วน" เป็น "ทั้งชุดตาม BU"
  (เขียวจึงขึ้น 112→180) · **เหลือง = มีเหลืองแต่ไม่มีเขียว** (ไม่ซ้อนกับเขียว ตัวเลขบวกกันได้)
- **ชิป "→ ก้าวถัดไป" บนการ์ด** (`8ebfd2a`): มีคนสนใจ N–กดจองตัว > ไม่รับสาย N–ควรโทรซ้ำ >
  AI แนะนำ N–เลือกคนส่ง AI โทร > รอผลโทร N สาย > ไม่มีคนแนะนำ–ส่งคิด Content/Scraping
  (ใบที่ AI ยังไม่ประเมิน = ไม่ขึ้นชิป ไม่เดา) · helper `cardNextAction()` ใน MatchingPage
- **หาคนไม่ครบเป้า → ปุ่มส่งคิด Content/Scraping ในแถบคำแนะนำเลย** (`6f32b1f`)
  + ขยายเงื่อนไขให้ขึ้นทุกครั้งที่ไม่ถึงเป้า (เดิมขึ้นเฉพาะเมื่อ fallback รันแล้ว)
- **กล่องผลโทรโฉม Apple** (`8ebfd2a`): พื้นจางชิ้นเดียวไม่มีเส้นแบ่ง ค่า 0 จางทั้งช่อง
- **แก้ back/สลับเมนูแล้วหน้าค้าง** (`8ebfd2a`): เดิมกลับเข้าหน้าโหลดใหม่จากศูนย์ ~4–6 วิ เห็นแต่ skeleton
  จนคนกด refresh · แก้ด้วย **cache ระดับ module** (`lastServerList` ใน MatchingPage) กลับเข้ามาเห็นทันที
  (<1 วิ) แล้วโหลดสดมาแทนเงียบ ๆ

### ถัง In process เข้ามาใช้ได้ (`06f97d6`)
- `boardInProcessColumnId()` (env `BOARD_IN_PROCESS_COLUMN_ID` default 3) — **54 คน**
- เห็นได้ 3 ที่: picker เลือกคนส่ง AI โทร (เรียงท้ายสุด) · หน้าผู้สมัคร · tile บน Matching Dashboard
- **ไม่เข้า auto เด็ดขาด** เหมือน Re Use (auto pool ยังเป็น To do 89 → fallback ไม่มีงาน 53)
  เหตุ: คนกลุ่มนี้กำลังถูกเสนอใบอื่น เสี่ยงเสนอซ้อน · ป้ายเตือน "กำลังเสนอใบอื่น — เช็คก่อนว่าใบเดิมจบแล้วหรือยัง"
- ยอดถังปัจจุบัน: To do 89 · ไม่มีงาน 53 · Re Use 136 · In process 54

### สถานะทำงานย้ายมาเก็บใน DB — Admin เพิ่ม/ลบเองได้ (`9b3d8f1`)
- เดิม hardcode 3 ที่ (CHECK constraint + array ฝั่ง API + labels ฝั่ง client) → มี migration 039/053/054/056
  ที่เขียนขึ้นมาเพื่อเพิ่มสถานะทีละตัว
- `migrations/062_work_status_master.sql`: ตาราง `work_status_master` + seed 9 ค่า built-in +
  **เปลี่ยน CHECK → FK** (`on delete restrict` กันลบสถานะที่มีใบขออ้าง) · seed ก่อนผูก FK · idempotent
- `/api/work-status-master`: GET ทุก role (dropdown ใช้) · POST/PATCH/DELETE **admin เท่านั้น** (403 สำหรับ
  staff/supervisor ยืนยันแล้ว) · คืนจำนวนใบขอที่ใช้แต่ละสถานะ
- แท็บ **"สถานะทำงาน"** ใน Settings (admin only) · `useWorkStatusOptions()` cache ระดับ module +
  `invalidateWorkStatusOptions()` · fallback เป็นค่า built-in เมื่อ API ล่ม/ยังไม่ migrate
- **กติกา**: built-in 9 ตัวลบไม่ได้ (dashboard/KPI อ้าง code ตรง ๆ) ปิดใช้งานได้ · ที่เพิ่มเองลบได้เมื่อไม่มีใบขอใช้
  · สถานะที่ปิดแล้วบันทึกใหม่ไม่ได้ แต่ใบขอเก่ายังแสดงและยังอยู่ในลิสต์ของใบนั้น
- ยอดใช้จริง: รอแจ้งเข้า 74 · ดำเนินการ 16 · เริ่มประเมิน 15 · รอเริ่มงาน 15 · รอสัมภาษณ์ 8 · อื่น ๆ

### WL — ตั้ง BU ให้พนักงานได้ (`fb4c206`)
- **พบว่าพนักงาน 36 คนไม่มี `department_code` เลย → หน้าพนักงาน WL แสดง 0 คนทั้งหน้า** (ตัวกรองตัดทิ้งหมด)
- เพิ่มถัง **"ยังไม่ระบุ BU (n)"** + ตั้ง BU (LBD/LBA) ได้จากคอลัมน์ BU ในตาราง (หัวหน้างานขึ้นไป)
- `PATCH /api/employees` **อ่าน `id` จาก body ไม่ใช่ query** (เจอตอนดีบัก) + เพิ่มเช็คสิทธิ์ BU
- WL มีแค่ 2 BU: LBD, LBA (`WL_BU_CODES`)

### หน้าแรก + Dashboard
- **funnel เพิ่ม "ส่งคิด Content" / "ส่ง Scraping"** (`64e8580`) — แถวใต้ funnel หลัก
  `flow-summary` แยก `postings.content` / `postings.scraping` จาก `request_type` ใน query เดิม
  (ข้อมูลจริง: content 7 / scraping 2 แต่ปิดงานแล้วทั้งหมด จึงนับ active = 0 ถูกต้อง)
- **Dashboard โฉมพาสเทล** (`e11e836`): "วันผ่านมา" → **"งานไหนด่วนแค่ไหน"** 5 ช่องสีภาษาเดียวกับ Matching
  (รอได้ 17 · ยังไม่ด่วน 80 · เริ่มด่วน 17+44 · ด่วนมาก 243) · KPI พาสเทลตามความหมาย
  (เข้ามา=ฟ้า ปิดแล้ว=เขียว ยกเลิก=เทา คงเหลือ=เหลือง) · ถอดเส้นขอบใช้เงานุ่ม+มุมโค้งใหญ่
  · **ถอด DemandForecastPanel (พยากรณ์ตามประเภท) ออกตามคำสั่ง** → ตาราง Life Cycle เดิมกลับมาแทน
    (ไฟล์ component ยังอยู่ rollback = git revert)
- **แก้บั๊ก "ปิด" เป็น 0 ทุกคน** (`e7895e5`): เส้น `?closed=1` ไม่ได้เรียก `attachAssignments`
  ใบปิดจึงไม่มีชื่อผู้รับผิดชอบ ยอดไปกองที่ "ยังไม่มอบหมาย" · แก้บรรทัดเดียว → น้ำหวาน ปิด 3 · คิว ปิด 1

### Dark mode / Light mode (`05a1bdd`)
- ปุ่ม 🌙/☀️ ใน header ทั้ง 2 breakpoint · จำค่าต่อเครื่อง (`jarvis:theme`) · **ค่าเริ่มต้น = ตามเครื่อง (system)**
  และตามเครื่องแบบสดเมื่อยังไม่เคยเลือก · `initTheme()` ใน `main.tsx` ก่อน render กันกะพริบ
- **tailwind ตั้ง `darkMode:["class"]` ไว้ตั้งแต่แรกแต่ไม่เคยมีชุดสีมืด** → เพิ่ม `.dark {}` ครบทุก token
- dark variant ของ class กลางครบ: glass-card / jarvis-frost / jarvis-soft-field / jarvis-warm-bg /
  jarvis-stat-tile / jarvis-chip 6 โทน / jarvis-btn 4 ระดับ + header/Matching/Dashboard
- ⚠️ **หน้ารองที่ hardcode พื้นขาวยังไม่กวาด** (ตาราง WL, กราฟบางตัวใน dashboard) — แสดงเป็นการ์ดสว่าง
  บนพื้นมืด อ่านได้ ไม่ผิดเพี้ยน

### ถอดของไม่ใช้
- **Vercel IP ออกทั้งชุด** (`fb4c206`): VercelOutboundIpTab, แท็บใน Settings,
  `/api/diagnostics/outbound-ip`, `outboundIpLogs.ts`, `outboundIpProbe.ts`, resource ใน rbac

---

## 2. ความรู้ระบบที่ค้นพบเพิ่ม (สำคัญ)

### 🔴 บั๊ก server pagination ที่ยังไม่แก้ (คำถามค้างข้อ 1)
`api/_handlers/matching-list.ts:59` — `listSiamrajUnitRequests({ limit: 500 })` แล้วค่อยกรอง/เรียง/slice
ในหน่วยความจำ **แต่เพดานจริงของชั้นข้อมูลคือ 2000** (`SIAMRAJ_UNIT_REQUESTS_MAX_LIMIT`)
- ถ้าใบขอเปิดเกิน 500 ใบ **ใบที่ 501+ เข้าถึงไม่ได้เลย ไม่มี warning** และ `total` ที่คืนก็ผิด
- ทิศทางการตัด: `ORDER BY ... DESC` → **ใบเก่าสุดหายก่อน = ใบที่ SLA เกินหนักสุด** (ตรงข้ามเจตนา)
- ตอนนี้ 338–339 ใบ ยังไม่ชน แต่มีใบปี 2558 ค้างอยู่ (อายุ 3,876 วัน) ความเสี่ยงสูง
- บั๊กเดียวกันที่ `matching-flow-summary.ts:129` (ตัวเลข funnel หน้าแรก) และ
  `src/hooks/useUnitRequestsFeed.ts` `UNIT_REQUESTS_FETCH_LIMIT = 500` (กระทบ JobList/PreCheck/JobBoard/Dashboard)
- **ฝั่ง PostgreSQL กรอง BU หลัง LIMIT** (`siamrajUnitRequests.ts:226-241`) → staff BU เล็กได้ข้อมูลไม่ครบ
  (ฝั่ง SQL Server ทำถูก — กรองใน WHERE ก่อน TOP) สองฐานพฤติกรรมไม่ตรงกัน
- MatchingPage ยังยิง `useUnitRequestsFeed()` ซ้อนใน server mode (ประโยชน์ payload หายไปเกือบหมด)

### สถานะ pagination ทั้งระบบ
ครบแล้ว 4 หน้า (Matching, JobList, Users, ผู้สมัคร) · **ไม่มีเลย ~15 หน้า** ที่หนักสุด:
คนของเรา `?people=1` (2000), ผู้สมัคร `/api/candidates` (500), พนักงาน WL (500+500),
JobBoardView (500), PreCheck (500 + คำนวณระยะทางทุกแถว)
**4 endpoint ไม่มี limit ใน SQL เลย**: job-postings, proposals, job-staff roster, app-users

### 6 component ที่เขียนเสร็จแต่ไม่เคยถูก render (ของฟรีรอต่อสาย)
`src/components/dashboard/analytics/` — `DashboardFlowView` (การ์ดสมการงานค้าง),
`DashboardSlaSummary` (5 ถัง SLA), `DashboardCohortSummary`, `DashboardClosedBreakdown`,
`DashboardExecutiveInsights` (สรุปผู้บริหาร), `DashboardPriorityQueue` ("ต้องแก้วันนี้")
- ข้อมูลคำนวณเสร็จทุก render แล้วถูกโยนทิ้ง ~11 dataset (`buildDashboardData.ts:1191-1215` return ครบ
  แต่ `DashboardShell` หยิบไปใช้แค่บางส่วน)
- prop ที่ส่งมาแล้วแต่ Shell ไม่ใช้: `onCohortClick`, `onSlaClick`, `onFilledBreakdownClick`,
  `onFullyClosedBreakdownClick` (handler ฝั่งเพจเขียนครบแล้วที่ `SupervisorDashboard.tsx:420-449`)
- `priorityWorkQueue` ถูก hard-code เป็น `[]` ที่ `buildDashboardData.ts:1124` ทั้งที่ `buildPriorityWorkQueue()` มีแล้ว
- `dataQualitySummary` มีใน type แต่ไม่ได้ใส่ใน return · **`snapshot_fallback` ไม่แสดงที่ไหนเลย**
  (กติกา CLAUDE.md บอกต้องแสดง — ช่องว่างเสี่ยงสุดของงาน visual control)

### ข้อมูลที่มีแล้วแต่ยังไม่ได้โชว์
- `lumos.outcomes_month` = **ทุก outcome** แต่หน้าแรกใช้แค่ 3 ตัว → ทำ donut ได้ทันที
- `proposals.contacted_month`, `postings.active` คืนมาแต่ไม่โชว์
- **`lumos_dispatch_queue.result` มี transcript เต็ม + recording_url + call_attempts + ended_reason ทุกสาย**
  แต่ `listLumosCallStatusForJob` (`api/_lib/lumosDispatch.ts:317-320`) select แค่ `outcome`+`summary`
  → **ผลโทรระดับ 2/3 ต้องแก้ SQL select + type ฝั่ง client ก่อน**
- lead time การโทร: `created_at → delivered_at → updated_at` มีครบ ยังไม่มีใครคำนวณ
- `board_match_results` เป็น **upsert 1 แถว/job** → ทำ trend ตามเวลาไม่ได้ ต้องเพิ่มตาราง history ก่อน

### อื่น ๆ
- **recharts ใช้แค่ 3 ที่ ทั้งหมดอยู่หน้า `/dashboard`** · `src/components/ui/chart.tsx` (shadcn wrapper)
  ติดตั้งแล้วแต่ไม่มีใครใช้
- หน้า `/dashboard` **ไม่ใช้ class ภาษากลาง `jarvis-*`** ใช้สไตล์ enterprise ของตัวเอง (ยังไม่ได้ตัดสินว่าจะรวม)
- `/dashboard` คำนวณ ledger ทั้งชุดบน client จาก 3 ก้อนข้อมูล — เพิ่มกราฟมากจะหนืด
- **โหมด "ทั้งหมด" ไม่ดึงชุดใบปิด** (ใช้ throughput แทน) → ยอด "ปิด" ต่อคนเป็น 0 by design
  ต้องเลือกช่วงเวลาก่อน · ถ้าอยากให้เห็นในโหมดทั้งหมดต้องเพิ่ม API สรุปยอดปิดต่อคน (นับที่ DB)
- session cookie TTL 30 นาที — ทดสอบ local ใช้ `POST /api/auth/dev-role {role}` (เจอหมดอายุกลาง session บ่อย)
- typecheck ค้างเท่าเดิม: app **10** · api **40** (pre-existing ทั้งคู่ — ฉบับ 3 ส.ค. เขียน 37 คลาดไป)
- เทสต์: **403 ผ่าน / 4 skipped** (65 ไฟล์) เพิ่มใน session นี้ 12 เทสต์
- Browser tool: พิกัดจาก screenshot ถูกย่อครึ่ง — **ใช้ `ref` จาก read_page เสมอ** หรือคำนวณจาก
  `getBoundingClientRect()` แล้วคลิกด้วย coordinate

---

## 3. งานค้าง — เรียงตามที่ควรทำ

### 3.1 คำถาม 2 ข้อที่รอเจ้าของตอบ (blocking)
1. **server pagination** จะเอาทางไหน
   - **(ก)** ปลดเพดาน 500→2000 + ใส่ธง `truncated` เตือนเมื่อข้อมูลถูกตัด + cache ฝั่ง server
     (เร็ว ทำวันเดียวจบ แก้บั๊กที่รออยู่ แต่ยังตันที่ 2000)
   - **(ข)** ทำ SQL-level `OFFSET/FETCH NEXT` + `COUNT(*)` จริง (ถาวรไม่มีเพดาน แต่ต้องย้ายการกรอง/เรียง
     ลง SQL → กติกา "โค้ดกรองชุดเดียวรัน 2 ฝั่ง" ที่ `matchingListFilter` ยึดอยู่ต้องรื้อ)
   - แนะนำ (ก) ก่อนทันที แล้วทำ (ข) เป็นงานแยกพร้อมสร้าง `usePaginatedList` hook + helper ฝั่ง API
2. **ปรับ Dashboard ตามรูป reference ที่เจ้าของส่งมา** (dashboard พาสเทล + บล็อกสีอิ่ม + การ์ดดำ + donut)
   — วิเคราะห์แล้ว เสนอ 2 รอบ:
   - **รอบ 1 (คุ้มสุด ไม่แตะ API):** บล็อกสีอิ่มสำหรับตัวเลข act-now ("ด่วนมาก 243" เป็นบล็อกแดงอิ่ม) +
     **การ์ดดำ = ต่อสาย `DashboardFlowView` / `DashboardExecutiveInsights` ที่เขียนเสร็จแล้ว** +
     ยุบ KPI สถานะทำงาน 11 ใบเป็นชิปจิ๋วสีจาง (ประหยัดที่มาก)
   - **รอบ 2:** การ์ดฮีโร่ผู้รับผิดชอบ + donut (`recruiterOverview` มีครบ) · กราฟผสมแท่ง+เส้น
     tooltip ป้ายดำ · การ์ดไอคอนทางลัดแถวล่าง
   - **ไม่แนะนำให้ลอก**: sidebar เมนูซ้าย (แอปใช้ header+drawer ทั้งระบบ) · rail ขวา (มีคอลัมน์ฟิลเตอร์ซ้ายแล้ว)
     · การ์ด CTA การตลาด (ใช้ `DashboardPriorityQueue` "ต้องแก้วันนี้" แทนมีประโยชน์กว่า)

### 3.2 งานค้างเดิมที่ยังไม่ได้ทำ
1. **ตามทีม Lumos ด่วน**: ทำไมหยุด poll ตั้งแต่ 1 ส.ค. + ทำไม cancelled 93% (คิวบวมทุกวัน)
2. **เฟส 1 ย้าย iRecruit**: import ทางเดียว 136k คน (69 ฟิลด์ + ที่อยู่) → ตาราง jarvis + หน้า list/ค้นหา
   (แผนเต็มในฉบับ 31 ก.ค. ข้อ 4.2) · **อ่านอย่างเดียว ห้ามเขียนกลับ MSSQL**
3. **ผลโทรระดับ 2/3**: หน้ารวมผลการโทร + transcript/recording (ต้องแก้ SQL select ก่อน — ดูข้อ 2) + funnel
4. **BU scope ที่เหลือ** (ต้อง migration ก่อน):
   - `follow_entries` — ไม่มีทั้ง `department_code` และ `job_id` → staff เห็นรายการติดตามทั้งบริษัท
     (ทางชั่วคราว: scope ด้วย `created_by`)
   - `candidates` / `clients` — ไม่มี BU ไม่มี job link
   - **pool "คนของเรา" — เจ้าของสั่ง "ปล่อยไว้"** (ตารางไม่มี BU ผูกไม่ได้ทางเทคนิค) ✅ ตัดสินแล้ว
   - **พนักงาน WL 36 คนยังไม่มีรหัส BU** — ต้องให้หัวหน้าเข้าไปตั้งในหน้า WL ก่อน การกรองจึงมีผลจริง
     (ปัจจุบันแถวที่ไม่มีรหัสยังให้ทุกแผนกเห็น ไม่ให้ข้อมูลหายเงียบ ๆ)
5. **กวาด dark mode หน้ารอง** (ตาราง WL, กราฟใน dashboard, Follow/Reservations/PreCheck/JobBoard)
6. ค้างเก่า: ใบขอปี 2558 ท่วมคิวด่วน (กติกา archive) · `DELETE /api/candidate-interviews` ยัง hard delete ·
   api strict mode · e2e spec · **error boundary (แอปยังไม่มี — หน้า crash = จอขาว)** ·
   test/typecheck gate ก่อน deploy

---

## 4. คำสั่ง/ท่าที่ใช้บ่อย

```bash
npm run test            # 403 ผ่าน / 4 skipped
npx tsc --noEmit -p tsconfig.app.json   # 10 errors ค้าง (pre-existing)
npx tsc --noEmit -p api/tsconfig.json   # 40 errors ค้าง (pre-existing)
npm run db:migrate      # migration ล่าสุด = 062_work_status_master.sql
npm run db:migrate:status
"$HOME/.npm-global/bin/gh" run list --limit 1   # เช็ค deploy (PATH ไม่มี gh)
git fetch origin main && git log --oneline HEAD..origin/main   # เช็คก่อน push (ทีมอื่นก็ push)
```

- dev server ใน Claude Code: `preview_start` ชื่อ `"api"` (3100) + `"vite"` (8080) — **ห้ามใช้ Bash รัน**
- login ทดสอบ: `fetch('/api/auth/dev-role',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'admin'})})`
- ทดสอบเขียน production แบบปลอดภัย: แก้ + verify + คืนค่าเดิม **ในคำสั่ง JS ก้อนเดียว** แล้วรายงานผลทั้งคู่
