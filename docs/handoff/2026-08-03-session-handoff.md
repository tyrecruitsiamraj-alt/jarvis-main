# Session Handoff — 3 ส.ค. 2569

เอกสารส่งต่อจาก session วันที่ 3 ส.ค. 2569 (ต่อจากฉบับ 31 ก.ค.)
สถานะโค้ด: `main` = `00e8868` · working tree สะอาด · **deploy สำเร็จทุก commit (20 commits วันนี้)**

---

## 1. สิ่งที่ทำเสร็จใน session นี้

### Lumos → "ส่ง AI โทร" (คำนี้ใช้ทั้งระบบแล้ว)
- **auto-send ยังเปิดอยู่ตามเดิม** (เจ้าของตัดสินใจคงไว้) + เพิ่ม**เส้นเลือกส่งเอง**:
  `POST/GET/DELETE /api/lumos/dispatch` — ติ๊กเลือกผู้สมัครแล้วส่ง, client ส่งได้แค่ id
  (ชื่อ/เบอร์ประกอบฝั่ง server จาก pool สด) เพดาน 50 คน/ครั้ง, dialog ยืนยันเห็นชื่อ+เบอร์ครบ
- auto กับส่งเองใช้ตรรกะ enqueue ตัวเดียวกัน (`enqueueLumos*ForSelected` ใน lumosDispatch.ts)
- **badge ผลโทรรายคน** ในหน้า Matching (รอโทร/AI รับไปแล้ว/สนใจ/ปฏิเสธ/ไม่รับสาย + กดขยายอ่านสรุปสาย
  + ยกเลิกได้ถ้ายังไม่มีผล) และ**กล่องสรุป 6 ช่องข้างการ์ดใบขอ**: ส่ง/โทรแล้ว/เหลือ/โอเค/ไม่ไป/ไม่รับ
  — นิยาม "โทรแล้ว" = มีผลกลับจริง ไม่นับสายที่ AI ยกเลิกเอง (`loadLumosJobCallSummaryMap`)
- picker "เลือกคนส่ง AI โทร" เห็น 3 ถัง (To do → ไม่มีงาน → Re Use) พร้อมป้ายที่มา

### Waterfall matching (กติกาใหม่ที่เจ้าของกำหนดเอง)
- **เป้า = อัตราที่ขอ × 3** (ขอ 3 ต้องแนะนำได้ ≥9 นับเฉพาะเขียว+เหลือง)
- AI ค้นถัง **To do (col 2)** ก่อนเสมอ → ต่ำกว่าเป้าค่อยรัน AI รอบสองกับ **"ไม่มีงาน" (col 7)**
  ผล To do อยู่หน้าเสมอ รอบสองพังไม่กระทบรอบแรก · ยังไม่ถึงเป้าอีก → แถบบอกทางไปต่อ
  (iRecruit / Re Use ใน picker / ส่งโพส)
- **Re Use (col 6) ห้ามเข้า auto เด็ดขาด** — เลือกส่งเองเท่านั้น (สถานะคนเก่าไม่แน่ ต้องมีคนตรวจ)
- log ดูได้จาก `board-match.fallback` · ฟิลด์ผล: `recommended_target/fallback_used/fallback_pool_size`
- เทสต์กติกาใน tests/api/boardMatchWaterfall.test.ts

### หน้าแรก (HomePage) = การไหลของงานสรรหา
- login ปุ๊บเห็น funnel เลย: ใบขอเปิดอยู่ → AI แนะนำ → ส่ง AI โทร → สนใจงาน → จอง/ลงงาน
  (กดก้อนไหนพาไปหน้านั้น — "ใบขอเปิดอยู่" ไปหน้าหน่วยงาน) · เมนูหลักถูกถอด (อยู่ใน ☰)
- **ทุกตัวเลข scope ตาม BU ของผู้ใช้** (`/api/matching/flow-summary` — ตรวจแล้ว staff LBD เห็น 192 ใบ
  ขณะ admin เห็น 333)
- การ์ดติดตามมีสีบอกสถานะ: 🟢 สนใจรอจอง · 🟡 ไม่รับสายรอโทรซ้ำ · 🔴 ติดขัด
  กดชื่อคน → dialog รายละเอียด (แมทกับใบขอไหน ตำแหน่ง+หน่วยงาน+สรุปสาย+ปุ่มโทร/เปิดใบขอ)
- ป้ายเตือนบนหน้านี้ห้ามปนกับตัวเลขทางการ ERP (มี disclaimer ตามกติกา Control Tower แล้ว)

### หน้า "ผู้สมัคร" ใหม่ (/matching/candidates)
- = คนของเราแยกตามถังบอร์ด **แบบแท็บกดดูทีละถัง** + pagination 20 ชื่อ/หน้า + ค้นหา
- tile "คนของเรา · ตามถังบนบอร์ด" บน Matching Dashboard กดแล้วเปิดแท็บนั้น (?bucket=todo|no_job|reuse)
- CandidatesPage เดิม (ตาราง candidates ภายใน มีข้อมูล 1 คน) ถูกถอดจาก route — ไฟล์ยังอยู่
- API: `/api/matching/board-candidates?people=1` (รายชื่อ 3 ถัง) และ `?buckets=1` (ยอดต่อถัง)

### Microsoft SSO — LIVE ครบวงจร
- callback auto-provision: อีเมลตรงใช้ account เดิม / ไม่มีเปิดใหม่ role staff อัตโนมัติ
  (จำกัด tenant บริษัท + @siamraj.com · hash รหัสสุ่ม เข้าได้เฉพาะ SSO · audit `auth.azure_ad.provisioned`)
- **secret อยู่ใน .env บน server ตรง ๆ (หัวหน้าใส่)** — ปุ่ม Microsoft ขึ้นบน prod แล้ว
  ⚠️ ถ้าใครใส่ AZURE_AD_CLIENT_SECRET ใน GitHub Secrets จะทับของหัวหน้า (sync-env.sh ข้ามเฉพาะค่าว่าง)
- ทีมอื่น merge หน้า login ใหม่ (Microsoft + อีเมล/รหัสผ่าน, ถอด dev-role ออกจากหน้า login)

### ดีไซน์
- ภาษากลางใน index.css: `.jarvis-btn` 4 ระดับ (primary/secondary/ghost/danger) · `.jarvis-chip` 5 โทน
  · `.jarvis-stat-tile/label/value/sub` · `.jarvis-section-title` — กวาดแล้ว 3 หน้าหลัก
  โทนสถานะล็อกความหมาย: sky=กำลังทำ emerald=สำเร็จ/พร้อม amber=รอ/เช็ค red=ติดขัด violet=คนเก่า/จอง
- ลบ orb (ก้อนกลมฟ้าพื้นหลัง) ออกทุกหน้า — หน้ารอง (Follow/Reservations/PreCheck) ยังไม่ได้กวาด class ใหม่

### Infra fix สำคัญ
- **nginx: index.html ติด no-cache แล้ว** — เดิมไม่มี Cache-Control ทำให้ผู้ใช้เห็นหน้าเก่าหลัง deploy
  จนกว่าจะ hard refresh · ผู้ใช้เก่าต้อง Cmd/Ctrl+Shift+R **หนึ่งครั้งสุดท้าย** หลังจากนั้นอัตโนมัติ

---

## 2. ความรู้ระบบที่ค้นพบเพิ่ม (สำคัญ)

### ถังบนบอร์ด iRecruit (board_id=1) — column_id จริง
| id | ถัง | บทบาทในระบบ |
|---|---|---|
| 1 | Checklist (~1,025) | ยังคัดกรองไม่จบ — ไม่ยุ่ง |
| **2** | **To do (~85)** | pool หลัก AI แมทก่อนเสมอ (env `BOARD_READY_COLUMN_ID`) |
| 3 | In process (~51) | กำลังเสนอใบอื่น — ห้ามส่งซ้ำ |
| 4/5 | Done/Drop | จบแล้ว |
| **6** | **Re Use (~137)** | manual เท่านั้น (env `BOARD_REUSE_COLUMN_ID`) |
| **7** | **ไม่มีงาน (~53)** | ถังสำรอง waterfall (env `BOARD_FALLBACK_COLUMN_ID`) |

### หลักการ matching (ตอบเจ้าของไปแล้ว — มี Skill จริง)
- AI อ่านใบขอด้วย system prompt จาก `skills/candidate-spec-analyzer/` (taxonomy Family A–F +
  labor law + experts 6 มุม) → สเปค must_have/adjacent → pre-rank สกิลในโค้ด (job1/job2)
  → **family gate ห้ามข้ามสายงาน** → AI จัด tier เขียว/เหลือง/แดง (สกิลหลัก พื้นที่/เงินเดือนรอง)
- ข้อจำกัด: รู้จักสกิลจากชื่อตำแหน่งเป็นหลัก ใบขับขี่ ท.2 มีข้อมูลแต่ยังไม่เป็นเงื่อนไขแมท

### Lumos (⚠️ เรื่องเร่ง)
- **Lumos หยุด poll ตั้งแต่ ~1 ส.ค.** (delivered_at ล่าสุด: reminder 1 ส.ค. 08:40) แต่ auto-send
  + waterfall ยังเติมคิว → ส่งเดือนนี้ทะลุ 800+ / รอโทร 3,400+ / ค้างเกิน 2 วัน 1,600+ และโตเรื่อย ๆ
- ผลกลับใน `result` มี **transcript เต็ม + recording_url ทุกสาย** — ระดับ 2/3 (หน้ารวมผลโทร/funnel) ทำต่อได้เลย
- เจ้าของตัดสินใจ: **คิวค้างเก่าไม่ต้องยกเลิก** (ถามแล้ว 2 รอบ)
- คน "สนใจ (confirmed)" บางรายสรุปสายจริงคือ "รับทราบแต่ไม่ยืนยัน" — นิยาม outcome ฝั่ง Lumos หลวม

### อื่น ๆ
- `jarvis-blue-orb` เป็น class ที่ไม่เคยมีนิยาม (div ล่องหน) — ลบไปแล้วพร้อม orb ทั้งหมด
- MatchingPage รับ URL params: `?jobId=` เปิดใบ, `?urgent=1&workflow=none|green|...` ติดฟิลเตอร์
- session cookie TTL 30 นาที — ทดสอบ local ใช้ `POST /api/auth/dev-role {role}` ได้
- origin/develop ตกหลัง main 76 commits — อย่าใช้
- typecheck ค้างเท่าเดิม: app 10 (โซน ledger) · api 37 (strict:false + `@/` alias ใน handler)
- MSSQL host ใน .env เป็นรูป `host,port` — สคริปต์ probe ต้อง split เอง

---

## 3. งานค้าง — เรียงตามที่ควรทำ

1. **ถามทีม Lumos ด่วน**: ทำไมหยุด poll ตั้งแต่ 1 ส.ค. + ทำไม cancelled 93% — คิวบวมขึ้นทุกวัน
2. **เฟส 1 ย้าย iRecruit** (เจ้าของยืนยันแล้ว): **import ทางเดียว อ่านอย่างเดียว ห้ามเขียนกลับ MSSQL**
   (มีทีมอื่นใช้ iRecruit อยู่) · ย้ายทั้ง 136k · 69 ฟิลด์ + ที่อยู่ → ตาราง jarvis + หน้า list/ค้นหา
   (แผนเต็มในเอกสารฉบับ 31 ก.ค. ข้อ 4.2)
3. ระดับ 2/3 ของผลโทร: หน้ารวม "ผลการโทร" + transcript/recording + funnel (ข้อมูลพร้อมแล้วใน result)
4. กวาดดีไซน์ภาษากลางต่อหน้ารอง (Follow, Reservations, PreCheck, JobBoard)
5. ค้างเก่าจากฉบับ 31 ก.ค.: ใบขอปี 2558 ท่วมคิวด่วน (กติกา archive) · DELETE candidate-interviews
   ยัง hard delete · strict mode api · e2e spec · error boundary (มี crash ซาก HMR ให้เห็นแล้วว่าจอขาวจริง)

---

## 4. คำสั่ง/ท่าที่ใช้บ่อย

```bash
npm run dev            # ใน Claude Code ใช้ preview_start ชื่อ "api" + "vite" (launch.json มีแล้ว)
npm run test           # 385 ผ่าน / 4 skipped
npx tsc --noEmit -p tsconfig.app.json   # 10 errors ค้าง (pre-existing)
npx tsc --noEmit -p api/tsconfig.json   # 37 errors ค้าง (pre-existing)
"$HOME/.npm-global/bin/gh" run list --limit 1   # เช็ค deploy (PATH ไม่มี gh ต้องเรียกเต็ม)
```

- login ทดสอบ local: `fetch('/api/auth/dev-role',{method:'POST',...{role:'admin'}})` ใน browser
- ตรวจคิว AI โทร: query `lumos_dispatch_queue` (สคริปต์ตัวอย่างใน scratchpad ของ session เก่าหายแล้ว
  — เขียนใหม่ได้ ใช้ pattern อ่าน .env จาก scripts/pg-ping.mjs และ **ห้ามลืมว่า DB คือ production**)
