# ส่งต่องาน UI Redesign (mockup rev.3) — สถานะ ณ 6 ส.ค. 2026

เอกสารนี้เขียนไว้ให้เซสชันถัดไปอ่านแล้วทำงานต่อได้ทันที โดยไม่ต้องไล่ประวัติแชตเดิม
ทุกอย่างที่เล่าในนี้ **push ขึ้น production แล้ว** (deploy ผ่าน `Deploy to Linux Server` สำเร็จทุกรอบ)

---

## 1. บริบทงาน

ยกหน้าตาแอป So Recruit (jarvis) ให้ตรง mockup rev.3 ที่เจ้าของเคาะไว้ พร้อมเก็บกวาดหนี้ทางเทคนิคด้านสี/ธีม
mockup ทั้ง 10 หน้าอยู่ที่ artifact นี้ (อ่านด้วย WebFetch ได้):
`https://claude.ai/code/artifact/1c2c98a7-626f-4f48-aeef-63ba55fa7f58`

หน้าใน mockup: 01 หน้าแรก · 02 Dashboard · 03 Matching · 04 บอร์ดรับสมัคร · 05 หน่วยงาน ·
06 ผู้สมัคร · 07 WL · 08 Follow · 09 ตั้งค่า · 10 หน้าสมัครสาธารณะ — **ทำครบทั้ง 10 หน้าแล้ว**

---

## 2. ระบบดีไซน์ที่วางไว้ (กติกาที่ต้องรักษา)

### 2.1 token กลาง — `src/lib/designTokens.ts`
- `TONE[toneKey]` 9 โทน: neutral/info/primary/success/warn/danger/violet/orange/teal
  แต่ละโทนมี `bar · tile · num · value · soft · softHover · solid · dot · onDark · chip · hex`
- `DASH.*` = พื้นผิวของหน้า Dashboard/ตาราง (`card`, `cardLg`, `hero`, `heroLabel`, `eyebrow`,
  `tableHead`, `tableRow`, `cell*`, `divider`, `muted`)
- **เทสต์บังคับ** `tests/api/designTokens.test.ts` — เพิ่มโทนใหม่แล้วลืมคู่ `dark:` จะพังที่นี่

### 2.2 สีของ "สถานะ" ประกาศที่ lib เท่านั้น — ห้ามทำตารางสีในไฟล์หน้า
มีเทสต์บังคับที่ `tests/api/statusTones.test.ts` (เช็คว่าชิปมี class จริงใน index.css + มีคู่ `.dark`
+ หน้าเว็บต้องไม่ประกาศ `STATUS_CLASS` ซ้ำ)

| ความหมาย | แหล่งเดียว |
|---|---|
| สถานะการเสนอ/จอง | `candidateProposalsApi.ts` → `PROPOSAL_STATUS_TONE` / `proposalStatusChip()` |
| คำขอโพสหางาน | `jobPostingRequestsApi.ts` → `JOB_POSTING_STATUS_TONE` / `jobPostingStatusChip()` |
| รายการติดตาม | `followApi.ts` → `FOLLOW_STATUS_TONE` / `FOLLOW_STATUS_CLASS` / `FOLLOW_STATUS_BAR` |
| อายุใบขอ 4 ระดับ | `jobUrgency.ts` → `JOB_AGE_URGENCY_META` |

### 2.3 ของกลางที่ทำไว้ใช้ซ้ำ
- `components/shared/PageHeroStrip.tsx` — แถบหัวสีเข้ม + `heroButton` / `heroButtonSolid`
  (หน้า admin ไม่ใส่ hero ตามกติกา mockup ข้อ 09)
- `components/shared/NameAvatar.tsx` + `lib/nameAvatar.ts` — ตัวย่อชื่อ สีประจำคนแบบ deterministic
- `lib/candidatePriority.ts` — เกณฑ์เรียงผู้สมัคร (ดูข้อ 4)

### 2.4 กับดักที่เจอมาแล้ว อย่าเหยียบซ้ำ
- **ห้ามใช้ `text-foreground` บนพื้นเข้ม** — ใช้ `DASH.cell*` แทน
  (branding เคยเขียน `--foreground` ทับ inline บน `<html>` ปัญหาแก้แล้วใน `a205261` แต่กติกานี้ยังคุ้มค่ารักษา)
- codemod เติมคู่ dark ต้อง**ยก variant prefix ไปด้วย** (`hover:bg-x-100` → `dark:hover:bg-x-900/40`)
  ไม่งั้นได้ `dark:bg-*` ซ้อนทับพื้นปกติ — เคยพลาดมาแล้วรอบหนึ่ง

---

## 3. งานที่ทำเสร็จแล้ว (ไล่ตาม commit)

| commit | เรื่อง |
|---|---|
| `3e0bfd2` | funnel หน้าแรกแบ่งสีต่อขั้น + การ์ด Matching สองคอลัมน์ (รอบแรก) |
| `c689d66` | token กลางของสี + ยก Dashboard มาใช้ |
| `813a004` | Dashboard hero "ต้องลงมือตอนนี้" + layout ตาม mockup |
| `3b51696` | บอร์ดรับสมัคร · ผู้สมัคร · WL · Follow · ตั้งค่า · หน้าสมัครสาธารณะ |
| `6dea4c1` | หน้าหน่วยงาน (ตัวกรองแถบบน + ชิปอายุ 4 ระดับ) |
| `908e9b7` | ชิปก้าวถัดไปข้างชื่อหน่วยงาน · ครึ่งขวาเป็นแถบผลโทร · หน้าแรกเข้า hero |
| `1da9811` | ยุบสีสถานะเหลือแหล่งเดียว + เทสต์กันทำซ้ำ |
| `a205261` | **โหมดมืดกลับมาทำงานจริงทั้งแอป** + สี success/warning/info ของธีมมืด |
| `833b115` | หน้ารองเข้า token — Role Hub · Matching Dashboard · Monthly Planner · Login |
| `98e5607` | หน้าหน่วยงานตาม feedback (ค้นหาขึ้นหัวหน้า · สถานะเป็นช่องกรอง · ตัดช่องติ๊กแท็บใหม่) |
| `d25c57b` | Matching + Pre-Check เติมคู่ dark 306 จุด (codemod) |
| `10cc2bf` | เอาตัวกรอง "ปี พ.ศ." ออกจากหน้าหน่วยงาน |
| `9fd1819` | Dashboard — แยกคอลัมน์สรรหา/คัดสรร · ยอดปิดรายคนโหมดทั้งหมด · ตัด SLA/งานที่ต้องติดตาม |
| `5d0419c` | Matching เรียงตามลำดับความสำคัญที่เจ้าของกำหนด |
| `1dd2b07` | Settings › น้ำหนักเรียงผู้สมัคร + แบ่งหน้าบอร์ดรับสมัคร |

---

## 4. เกณฑ์เรียงผู้สมัคร (เจ้าของกำหนดเอง)

ลำดับความสำคัญ: **อายุ → ที่อยู่ → ประสบการณ์ → เหล้า/บุหรี่ → ประวัติคดี → รายได้**
- อายุ/ที่อยู่ = **เกณฑ์แข็ง** ไม่ผ่าน = ตกท้ายลิสต์ · ที่เหลือ = flexible แค่ลดอันดับ ไม่ตัดใครทิ้ง
- น้ำหนักเริ่มต้น 30/25/20/5/10/10 — **ปรับได้ที่ Settings › น้ำหนักเรียงผู้สมัคร** (เก็บที่ server)
  `migration 066` + `/api/match-priority-weights` (GET ทุก role · PUT admin + audit log)
- `unknown` (ไม่มีข้อมูล) ไม่ถูกนับทั้งตัวตั้งและตัวหาร — คนข้อมูลไม่ครบไม่ถูกลงโทษ

**ข้อมูลที่ยังไม่มีในระบบ (สำคัญ):**
- **เหล้า/บุหรี่** — มี field เฉพาะผู้สมัครฝั่ง Jarvis (`Candidate.drinking/smoking`)
  แต่บอร์ด iRecruit ที่หน้า Matching ใช้ **ไม่มี**
- **ประวัติคดี** — ไม่มีเก็บที่ไหนในระบบเลย

ทั้งคู่วางโครงรอไว้แล้วใน `candidatePriority.ts` — พอมี field จริงส่ง verdict เข้ามาก็ติดเกณฑ์ทันที

---

## 5. ข้อมูลปฏิบัติการที่ต้องรู้ก่อนลงมือ

- **DB ของ local ชี้ production ตัวจริง** — ทดสอบอะไรที่เขียนข้อมูล ต้องคืนค่าเดิมให้เรียบร้อย
  (รอบที่แล้วทดสอบ PUT น้ำหนักแล้วคืนค่าเริ่มต้นกลับ)
- **dev server**: ใช้ `preview_start` ชื่อ `vite` (port 8080) และ `api` (port 3100) — ห้ามรันด้วย Bash
- **auth ตอนทดสอบ**: `POST /api/auth/dev-role {"role":"admin"}` แล้ว reload ·
  cookie หมดอายุราว 30 นาที ถ้าจู่ ๆ เจอหน้า login ให้ยิงซ้ำ
- **navigation**: โหลดหน้าใหม่ตรง ๆ บางทีเด้งกลับ `/dashboard` — ถ้าเจอ ให้คลิกผ่านเมนู burger แทน
- **API ที่ช้ามาก**: ใบขอที่ปิดแล้วช่วงเต็ม `/api/siamraj/unit-requests?closed=1&from=…&to=…`
  ใช้เวลา **~20 วินาที / 2,721 แถว** — Dashboard จึงโหลดตอนกางแผง "ภาระงานตามผู้รับผิดชอบ" เท่านั้น
  (ถ้าจะให้เร็วต้องทำ API สรุปยอดต่อคนฝั่ง server)
- **deploy**: push ขึ้น `main` แล้ว GitHub Actions deploy อัตโนมัติ (~1 นาที)
  เช็คด้วย `gh run list` / `gh run watch <id>` (gh อยู่ที่ `$HOME/.npm-global/bin/gh`)
- **baseline ที่ถือว่าปกติ**: `npm run test` = 439 ผ่าน / 4 skipped ·
  `npx tsc --noEmit -p tsconfig.app.json` = **7 error เดิมของ requestControl** (ไม่ใช่ของใหม่) ·
  eslint มี warning เดิม 2 ตัวใน MatchingPage/PreCheckPage

---

## 6. งานที่ยังเหลือ (เรียงตามที่แนะนำ)

1. **Matching ส่วนที่ไม่ใช่สถานะ** — ไฟล์ 4,100 บรรทัด ยังมีสีเขียนมือของปุ่ม/พื้นหลัง/แผงย่อย
   (คู่ dark เติมครบแล้ว เหลือเรื่อง "ความหมายสีควรมาจาก TONE")
2. **หน้ารองที่ audit เจอแต่ยังไม่แตะ** — JobPostingsPage · ReservationsPage ·
   OurPeoplePage (bucket map ยังเป็นจานสีของตัวเอง) · JobDashboard · หน้ารายละเอียดต่าง ๆ
3. **API สรุปยอดปิดต่อคน** — ทำให้ Dashboard โหมด "ทั้งหมด" ไม่ต้องรอ 20 วิ
4. **เก็บข้อมูลเหล้า/บุหรี่ + ประวัติคดี** ให้เกณฑ์เรียงผู้สมัครใช้งานได้ครบ
5. ปุ่ม "แก้ไข" บนการ์ดประกาศ (mockup ข้อ 04) — ยังไม่ทำเพราะไม่มี API แก้ประกาศ
   (มีแค่ create / setStatus) ถ้าจะทำต้องเพิ่ม endpoint ก่อน

---

## 7. สไตล์การทำงานที่เจ้าของชอบ (สรุปจากที่ร่วมงานมา)

- สั่งงานเป็น bullet ภาษาไทยสั้น ๆ ทีละหลายข้อ — ทำให้ครบทุกข้อแล้วค่อยสรุปทีเดียว
- ตรวจงานเองในเบราว์เซอร์เสมอ อย่าให้เจ้าของไปกดเอง แล้วรายงานสิ่งที่วัดได้จริง
- **ห้าม push จนกว่าจะสั่ง** — เจ้าของจะบอกว่า "push เลย" เอง
- commit แยกก้อนตามเรื่อง เขียน commit message ยาวได้ บอกเหตุผลและสิ่งที่ตรวจ
- ถ้าเจ้าของบอกว่า "ทำแบบเดิม" ให้ **เช็ค git history ก่อนว่าเคยมีจริงไหม** แล้วค่อยลงมือ —
  เคยพลาดสร้างปฏิทินใหม่ทั้งชุดแล้วต้องถอยทิ้งเพราะของเดิมไม่เคยมี
- เอาฟีเจอร์ออก = เอาออกให้สุด (UI + state + URL param) ไม่ใช่แค่ซ่อน —
  ไม่งั้นเหลือของที่ทำงานอยู่เบื้องหลังแต่คนใช้มองไม่เห็นและปิดไม่ได้
