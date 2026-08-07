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
  · **ตัวหนังสือในตารางต้องใช้ `DASH.cell*` ไม่ใช้ `text-foreground`** เพราะ
  `brandingStorage.applyBrandingToDocument()` เขียน `--foreground` ทับ inline บน `<html>`
  ค่านั้นจึงไม่สลับตามธีม (bug ระดับแอป แยกไป task ต่างหาก) — ถ้าเผลอใช้ `text-foreground`
  บนพื้นเข้ม จะได้ตัวหนังสือเข้มบนการ์ดเข้มในโหมดมืด
* src/components/dashboard/request-control/ (แผงใหม่ของ parallel layer)

## ความเร็วของเส้นใบขอ (ห้ามสร้าง Intl.DateTimeFormat ในลูป)

`api/_lib/businessDate.ts` — `bangkokBusinessDateYmd()` ใช้ตัวจัดรูปที่สร้าง **ครั้งเดียว**
ระดับโมดูล เดิมสร้างใหม่ทุกครั้งที่เรียก ซึ่งแพงมาก (~0.16ms/ครั้ง):
เส้นใบขอที่ปิดแล้วเรียก `toBangkokYmd` 6 ครั้ง/แถว × 5,000 แถว = 30,000 ครั้ง → 4.7 วินาที
เป็นต้นเหตุจริงของอาการ "API ใบขอที่ปิดแล้วช้า" (ไม่ใช่ SQL — SQL ใช้แค่ 0.6 วินาที)

* `src/lib/dateTh.ts` — `toYmdBangkok()` ฝั่ง client ก็ hoist แบบเดียวกัน
* `tests/api/businessDate.test.ts` — contract: ความถูกต้องข้ามเขตเวลา/ข้ามปี ·
  ฝั่ง client กับ API ต้องให้ผลตรงกัน · **เทสต์ความเร็ว 30,000 ครั้งต้องไม่เกิน 1.5 วินาที**
  (พังแปลว่ามีคนเอา `new Intl.*` กลับเข้าไปในฟังก์ชัน)

⚠️ กติกา: `new Intl.DateTimeFormat` / `new Intl.NumberFormat` ให้ประกาศระดับโมดูลเสมอ
ห้ามสร้างในฟังก์ชันที่ถูกเรียกต่อแถว

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

### หน้า "โทรของฉัน" + บอร์ดหัวหน้า

* `src/pages/matching/MyCallsPage.tsx` (`/matching/my-calls`) — ถังงานโทรของตัวเอง
  จัดกลุ่มตามใบขอ (โทรจบเป็นเรื่อง ๆ) · ไฮไลต์แถวที่ใกล้คายภายใน 2 ชม. ·
  แผนผังบอกปลายทางของผลแต่ละแบบ + ยอดวันนี้
* `src/pages/matching/CallTeamBoardPage.tsx` (`/matching/call-team`) — เฉพาะ supervisor/admin
  แถบภาระเทียบเพดาน 10 คน/คน · แดงเมื่อมีงานค้างเกิน 20 ชม. · โอนรายคน · คืน AI ทั้งกอง · เทกอง
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

### หน้า Follow — funnel การโทร + ถัง "ต้องคนตาม"

* `api/_handlers/lumos-call-funnel.ts` — `GET /api/lumos/call-funnel` (rbac `follow`)
  นับด้วย **group by ในฐาน** ไม่ดึงแถวมานับที่ node (คิวมี 5,300+ แถว)
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
* `tests/api/callBatch.test.ts`

⚠️ **ชื่อ/เบอร์อ่านใหม่ตอนปล่อย ไม่ใช่ snapshot ตอนกดเลือก** — คนอาจย้ายถัง/เปลี่ยนเบอร์
ระหว่างรออนุมัติ ใช้ค่าเก่าจะโทรผิดเบอร์ · ใช้ `resolveBoardSelection` ชุดเดียวกับการส่งเอง

⚠️ **ไม่มี cron** — `releaseDueCallBatches()` ถูกเรียกตอน `takePendingLumosItems()`
(Lumos ดึงคิวเป็นระยะอยู่แล้ว) และตอนอ่านรายการชุด · ล้มก็ไม่กระทบการเสิร์ฟคิวเดิม

⚠️ ปล่อยชุดใช้ **claim-then-work**: `update ... where status='approved' returning`
+ `for update skip locked` — 2 request พร้อมกันจะไม่ปล่อยชุดเดียวกันซ้ำ (DB ตัดสิน)

⚠️ **หนึ่งชุด = หนึ่งช่อง** (board→reminder · iRecruit→interview) ผสมกันไม่ได้
เพราะสถานะ/การยกเลิกจะกำกวม — handler ตอบ 400

⚠️ **อนุมัติได้เฉพาะ supervisor/admin** (สมมติฐาน — เจ้าของยังไม่ยืนยัน)
แก้ที่ `canApprove()` ใน handler ที่เดียว

### โหมด assist — ระบบจัดชุด คนอนุมัติ

* `src/lib/lumosDispatchMode.ts` — เพิ่มค่า `assist` + `TRIGGERS_WITH_ASSIST` + `modesForTrigger()`
* `api/_lib/lumosDispatchMode.ts` — `isAssistDispatchEnabled()`
* จุดที่รองรับ: `board_match` · `irecruit_search` (ระบบเป็นคนเริ่ม)
  **`follow_entry` ไม่มี assist** เพราะคนกรอกเอง = อนุมัติแล้วในตัว
* `src/components/follow/CallBatchPanel.tsx` — อนุมัติ/ยกเลิก/ถอนคนออก + นับถอยหลังช่วงถอนคำ
  (ซ่อนตัวเองเมื่อไม่มีชุด)

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
* `docs/erp-request-fields.md` — เอกสารแมปช่องบนหน้าจอ ↔ คอลัมน์ ERP + เงื่อนไขกรอง
  (เขียนไว้ส่งให้ทีม ERP อ่าน — แก้ฟิลด์แล้วอัปเดตด้วย)

⚠️ **`work_place` กับ `location_address` ไม่ใช่ตัวเดียวกัน ห้ามยุบรวม**
`location_address` = `work_place1+2+3` ต่อกันแล้วผ่าน `normalizeSiamrajWorkAddress()`
เป็นตัวที่ **ตัวกรองจังหวัด/อำเภอและการจับคู่พื้นที่ฝั่ง Matching ใช้** (`useJobBoardFilters`,
`inferProvinceFromAddress`, `MatchingPage` `jobArea`) — เปลี่ยนรูปเมื่อไหร่ตัวกรองเพี้ยนทันที
`work_place` = `work_place1` เดี่ยว ๆ = ชื่อสถานที่ที่ไปประจำ **ไว้อ่านอย่างเดียว ไม่เอาไปกรอง**

⚠️ `cleanErpText()` ตัดค่าที่คนกรอกใส่ขีดทิ้งไว้ (`-` `--` `.`) ออกเป็น `undefined`
แต่ **ไม่ตัด "ไม่ระบุ"** เพราะนั่นคือคำตอบจริง ไม่ใช่ช่องว่าง
(ข้อมูลจริง 2 ปี: `boss_nationality` กรอกมา 1,949/4,924 ใบ ในนั้นเป็น `-` อีก 408 ใบ)

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
