# Session Handoff — 31 ก.ค. 2569

เอกสารส่งต่อความเข้าใจและแผนงานจาก session วันที่ 30–31 ก.ค. 2569
สถานะโค้ด: `main` = `ac59b59` · working tree สะอาด · deploy สำเร็จทุก commit

---

## 1. สิ่งที่ทำเสร็จใน session นี้ (17 commits ขึ้น main + deploy แล้ว)

### ตั้งเครื่อง Mac (ย้ายจาก Windows)
- `node_modules` ที่ติดมาเป็นของ Windows (`win32-x64`) → ลบและ `npm ci` ใหม่เป็น `darwin-x64`
- ลง Vercel CLI + GitHub CLI (`gh`) — npm global prefix ย้ายไป `~/.npm-global` เพราะ `/usr/local` ต้องใช้รหัสผ่าน
- ตั้ง allowlist ใน `.claude/settings.json` (`defaultMode: acceptEdits` + 39 rules) ลดการกด allow

### ความปลอดภัย
- **ปิดสมัครสมาชิกสาธารณะ** — `isPublicRegistrationAllowed()` เปลี่ยนเป็น fail-closed + ตั้ง `JARVIS_ALLOW_PUBLIC_REGISTER=false` บน Vercel และใน deploy script
- ซ่อนแท็บ Register ในหน้า login เมื่อระบบปิดรับสมัคร (flag `publicRegister` จาก `/api/auth/config`)

### แก้บั๊ก
| บั๊ก | สาเหตุ | commit |
|---|---|---|
| KPI "เหลือหา" โหมดรายเดือนผิด | ไม่ได้นับตาม request-month cohort | `f27c7fc` |
| หน้า jobs list จำ filter/หน้าไม่ได้ | jsdom 20 + vitest 3 ให้ storage เป็น object เปล่า → test จับไม่ได้ | `b6be017` |
| **Deploy fail ติดกันหลายรอบ** | `git pull` บน server เจอ divergent branches | `be55fe1` (เปลี่ยนเป็น fetch + backup branch + reset --hard) |
| Follow บันทึกแล้ว 500 | `getString()` คืน null แต่โค้ดเรียก `.trim()` ต่อ | `9b1759c` |
| เส้น interview ไม่ขึ้นฝั่ง Lumos | `scheduled_at` เป็นอดีต ณ ตอนดึง + เสิร์ฟครั้งเดียวของหายเงียบ | `cabc29a` |
| ฟิลเตอร์ "วันผ่านมา" กดไม่ได้ | การ์ดใช้ `backdrop-blur` = stacking context ใหม่ → panel โดนการ์ดถัดไปทับ | `50a2a26` (portal + fixed) |

### ฟีเจอร์/ปรับปรุง
- **Code-split** — bundle แรก 2,475 kB → 564 kB (-77%)
- **หน้า Matching** — pagination แบบเลขหน้า (แทนโหลดต่อท้ายสะสม)
- **ฟิลเตอร์หน้าหน่วยงาน** — ทุกตัวเลือกได้หลายค่า (`[]` = ทั้งหมด), URL รองรับหลายค่า + อ่านลิงก์เก่าได้, แก้ race ตอนกดรัว
- **เชื่อม Lumos ครบวงจร** (ดูข้อ 3)
- **เมนู Follow** — แทน Driver Care (ลงรายชื่อคนที่ต้องติดตาม → เส้น reminder)
- **เปิด `MATCH_PRECOMPUTE_ENABLED`** บน server — worker ไล่ match AI ให้ครบเอง

### เอาออก (เก็บตาราง+ข้อมูลใน DB ไว้)
- **Driver Care** — ลบหน้า/component/API/lib/type/test/docs + ถอดจากเมนู/RoleHub/HomePage/Settings/RBAC
- **ส่งคำขอ / แจ้งบัค** — ลบหน้า `/feedback` + ปุ่ม header + API `/api/app-feedback` + ข้อยกเว้น RBAC ที่ให้ OPL POST ได้

---

## 2. ความรู้สำคัญเกี่ยวกับระบบ (สิ่งที่เพิ่งค้นพบ — อย่าลืม)

### ⚠️ ฐานข้อมูล local = production
`.env.local` ชี้ DB จริงทั้ง PostgreSQL และ MSSQL **ไม่มี dev DB แยก** — ทดสอบที่เขียนข้อมูลจะโผล่ prod ทันที และคิว Lumos มี Lumos poll อยู่จริง ของทดสอบอาจทำให้ AI โทรหาคนจริง
→ ใช้ prefix `__test__` แล้วลบทิ้งทันทีหลังทดสอบ

### สถาปัตยกรรมข้อมูล
- **PostgreSQL** (`jarvis_rm` schema) = ข้อมูลของ jarvis เอง (users, candidates, proposals, board_match_results, lumos_dispatch_queue, follow_entries)
- **MSSQL `DB_*`** (UNICRON_DB) = ใบขอ Siamraj **และ** บอร์ด iRecruit (`ir_board_*`, `hr_recruitment`) — **ฐานเดียวกัน**
- **MSSQL `IRECRUIT_DB_*`** = ฐานแยกสำหรับฟีเจอร์ "ค้นหา iRecruit"

### pool "คนของเรา" ที่ AI ใช้แมท
`dbo.ir_board_card` board_id=1, column_id=2 (คอลัมน์ **"To do"**, is_archived='N') → ปัจจุบัน 89 คน
บอร์ด "รายชื่อผู้สมัครงาน ปี 2569" คอลัมน์: Checklist 1,005 · To do 89 · In process 71 · Done 178 · Drop 100 · Re Use 127 · ไม่มีงาน 54

### ขนาดจริงของ iRecruit (สำรวจแล้ว 31 ก.ค.)
| ตาราง | จำนวน |
|---|---|
| `hr_recruitment` (ผู้สมัครสะสม) | **136,463** |
| `hr_recruitment_address` | 127,385 |
| `ir_board_card` (active) | 1,624 |
| `ir_board_card_activity` | 3,549 |
| `ir_board_card_comment` | 1,503 |
| `ir_board_checklist_progress` | 3,707 (นิยาม 8 ข้อ) |
| `ir_board_card_request_link` | 268 ← **iRecruit ผูกการ์ดกับใบขอได้อยู่แล้ว** |
| `ir_board_workflow_step` | 7 |
| `ir_test_*` (DISC/ขับรถ/ความรู้/อบรม), attachment | **0 — ไม่เคยใช้ ตัดออกได้** |

**`hr_recruitment` มี 94 คอลัมน์ แต่ใช้จริง 69** (≥10%), 11 แทบไม่ใช้, **14 ว่างเปล่า 0%** —
ที่ว่าง 0% รวม `id_line` (LINE ID), `driving_license_no` (ใบขับขี่), `phone`, ข้อมูลคู่สมรสทั้งหมด
→ ฟอร์มมีช่องแต่ไม่มีใครกรอก **ไม่ต้องยกมา**

### ข้อจำกัด Lumos
- **ปัดรายการทิ้งเงียบ** ถ้า `scheduled_at` เป็นอดีต (spec: "now or future") → แก้ด้วย serve-time bump ใน `takePendingLumosItems()`
- delivery เป็น **at-least-once**: เสิร์ฟซ้ำทุก 30 นาทีจนกว่าจะ POST ผลกลับ (เพดาน 5 ครั้ง `delivery_count`)
- Lumos poll ทั้ง 2 เส้นทุก ~5–15 นาที ด้วย `LUMOS_API_KEY` (มีใน GitHub Secrets แล้ว)
- debug ฝั่ง Lumos ทำจากฝั่งเราไม่ได้ ต้องให้ทีมเขาดู log

### Deploy
- GitHub Actions (`.github/workflows/deploy.yml`) → SSH → `docker compose up -d --build` → `db:migrate`
- โดเมน production: `jarvis.siamrajathanee.dev` (มี Vercel เป็นทางที่ 2 แต่ manual)
- ⚠️ `scripts/sync-env.sh` **ข้าม secret ที่ว่างแบบเงียบ ๆ** — deploy เขียวแต่ config หาย
- ⚠️ ไม่มี test/typecheck gate ก่อน deploy — push main = ขึ้น server ทันที

### กับดักที่เจอมาแล้ว
- `api/tsconfig.json` ตั้ง **`strict: false`** → บั๊ก null-safety หลุด typecheck (เป็นเหตุของ Follow 500) ปัจจุบันมี error ค้าง 34 จุดถ้าเปิด strict
- `tsconfig.app.json` มี error ค้าง 10 จุด (โซน Request Control Tower — `types.ts` ประกาศ field ซ้ำ, ledger ใช้ field ที่ไม่มีใน `JobRequest`)
- แอป**ไม่มี error boundary** — หน้า crash = จอขาว
- `playwright.config.ts` มีอยู่แต่**ไม่มีไฟล์ spec เลย**
- ไม่มี `.gitattributes` → ย้ายไฟล์ข้าม Windows/Mac ทำให้ diff ปลอมทั้ง repo

---

## 3. สถานะการเชื่อม Lumos (ทำงานจริงแล้วทั้ง 3 ทาง)

| ทางเข้า | เกิดตอนไหน | ส่งใคร | เส้น |
|---|---|---|---|
| AI match คนของเรา | ทุกครั้งที่ประเมินใบขอเสร็จ (**อัตโนมัติ**) | เขียว/เหลืองที่มีเบอร์ | `reminder` |
| หน้า Follow | คนกรอกเอง | คนที่กรอก | `reminder` |
| กดค้นหา iRecruit | คนกดปุ่มในหน้า Matching | เขียว/เหลืองที่มีเบอร์ | `interview` |

ตารางกลาง: `lumos_dispatch_queue` (migration 059) + `delivery_count` (migration 061)
Endpoints: `GET/POST /api/lumos/{reminder|interview}/{contacts|candidates|results}` — auth `Authorization: Bearer <LUMOS_API_KEY>`

### ⚠️ ตัวเลขที่ต้องแก้ (ณ 31 ก.ค.)
- ส่งเข้าคิวสะสม **~2,730 คน** — **ไม่มีใครตรวจก่อนส่งเลย**
- มีผลกลับ 441 สาย → **cancelled 409 (93%)** · acknowledged 24 · **confirmed 3** · declined 2 · ไม่รับสาย 2
- แปลว่า **เทคนเข้าไปหลักพัน ได้คนสนใจจริง 3 คน**
- ข้อความที่ส่งเป็นแนว "แจ้งเตือน" คนจึงแค่ "รับทราบ" ไม่ตัดสินใจ (24/32 สายที่โทรติด)

---

## 4. งานค้าง — เรียงตามที่ตกลงกันไว้

### 4.1 ปิด auto-send Lumos → เลือกส่งเอง (เจ้าของเห็นชอบแล้ว รอเริ่ม)
**ที่ตกลง**: AI แมทเหมือนเดิม (ผลเก็บครบ) แต่**ไม่ส่งเอง** → เพิ่มช่องติ๊กหน้าชื่อผู้สมัครในหน้า Matching + ปุ่ม "ส่งให้ Lumos โทร (N คน)" + dialog ยืนยัน (โมเดลเดียวกับหน้า Follow)

**ที่ต้องแก้**: ถอด `enqueueLumosReminderForBoardMatch()` ออกจาก `boardCandidateMatcher.ts` และ `enqueueLumosInterviewForIrecruit()` ออกจาก `matching-irecruit-candidates.ts` → ย้ายไปเป็น endpoint ส่งแบบเลือก

**การแสดงผลที่เสนอ (3 ระดับ)**
1. **ระดับ 1 (ทำก่อน)** — badge ต่อคนในการ์ด Matching: รอโทร → Lumos รับไปแล้ว → ✅สนใจ/❌ปฏิเสธ/ไม่รับสาย + กดขยายเห็นสรุปบทสนทนา (แบบเดียวกับหน้า Follow)
2. ระดับ 2 — หน้ารวม "ผลการโทร" ตาราง + กรอง + Export
3. ระดับ 3 — funnel ใน Dashboard: AI แนะนำ → ส่งโทร → โทรติด → สนใจ → จองตัว → ลงงาน

**ให้ผลกดทำงานต่อได้**: สนใจ → ปุ่มจองตัว · ปฏิเสธ → เลือกเหตุผล+พักจาก pool · ไม่รับสาย → ปุ่มโทรซ้ำ

**❓ ยังไม่ตอบ**: ของค้างในคิว **817 รอส่ง + 1,911 Lumos ดึงไปแล้วยังไม่โทร** → ยกเลิกทั้งหมดเริ่มใหม่ (แนะนำ) หรือเก็บไว้?

### 4.2 ย้าย iRecruit มา jarvis ให้เหลือระบบเดียว (ตัดสินใจแล้วว่าทำ)
**ทิศทางที่เจ้าของเลือก**: ใช้ฐานข้อมูลคนละฐานได้ (PostgreSQL ของ jarvis) แต่ต้องเก็บได้เท่าของเดิม — "copy หลักการทำงาน" ของ iRecruit มา

**ขอบเขตจริง**: ~69 ฟิลด์ผู้สมัคร + โมเดลบอร์ด (ไม่ใช่ 94 · ระบบทดสอบ 0 แถวตัดออก)

| เฟส | ทำอะไร | ผลลัพธ์ |
|---|---|---|
| **1** | ตารางผู้สมัคร 69 ฟิลด์ + ที่อยู่ · ตัวย้าย 136k · หน้ารายชื่อ+ค้นหา+รายละเอียด (server-side pagination) | ดูผู้สมัครทั้งหมดใน jarvis ได้ |
| **2** | บอร์ด/การ์ด/กิจกรรม/คอมเมนต์/เช็คลิสต์ · หน้าบอร์ดลากการ์ด | ทีมย้ายมาทำงานประจำวันบน jarvis |
| **3** | สลับ AI ให้อ่าน pool จากตาราง jarvis · ต่อใบสมัคร `/apply` เข้าบอร์ด | วงจรปิดในระบบเดียว |
| **4** | Channel Master + Reason Master + รายงาน | ดีกว่าเดิม: วัด ROI ต่อช่องทาง, root cause |

**❓ ยังไม่ตอบ (blocking เฟส 1)**
1. **มีทีมอื่น/ระบบอื่นใช้ iRecruit หรือ MSSQL นี้อยู่ไหม** — ใบขอ 328 ใบของ jarvis อ่านจากฐานเดียวกัน ถ้ามีคนอื่นใช้ต้อง sync สองทาง
2. ข้อมูลเก่า 136k — ย้ายทั้งหมด (แนะนำ เพราะมีคอลัมน์ "Re Use" 127 ใบ) หรือเฉพาะที่ active?

### 4.3 ค้างอื่น ๆ
- **ใบขอเก่าท่วมคิวด่วน** — มีใบตั้งแต่ปี **2558** อยู่บนสุดของคิว 221 ใบด่วน ควรมีกติกา archive/ปิด (กระทบ flow ทีมมากที่สุด)
- **Azure AD** — branch `feat/login-microsoft` ยังไม่ merge เพราะไม่มี `AZURE_AD_TENANT_ID/CLIENT_ID/CLIENT_SECRET` ทั้งใน Vercel และ GitHub Secrets → merge ตอนนี้ = ทุกคนเข้าระบบไม่ได้
- **ถามทีม Lumos** ว่าทำไม cancelled 93%
- **Lumos API ยัง mock**: `lumos-reminder.ts` เสิร์ฟจากคิวจริงแล้ว แต่ `lumos-interview.ts` ยังรวม mock กับ DB — ตรวจซ้ำ
- `DELETE /api/candidate-interviews` ยัง hard delete (ตัวอื่น soft archive หมดแล้ว)
- api/ เปิด strict mode (34 errors) · แก้ typecheck 10 errors โซน ledger · เพิ่ม error boundary · เพิ่ม test gate ก่อน deploy · เขียน e2e spec

---

## 5. คำสั่งที่ใช้บ่อย

```bash
npm run dev            # vite 8080 + api 3100 (ใช้ preview_start แทนถ้าอยู่ใน Claude Code)
npm run test           # vitest — ปัจจุบัน 347 ผ่าน / 4 skipped
npm run build
npm run db:migrate
npx tsc --noEmit -p tsconfig.app.json   # 10 errors ค้าง (pre-existing)
npx tsc --noEmit -p api/tsconfig.json   # 34 errors ค้าง (strict: false)
```

เช็คคิว Lumos:
```sql
set search_path to jarvis_rm;
select channel, status, count(*), count(*) filter (where result is not null) as มีผลกลับ
from lumos_dispatch_queue group by 1,2 order by 1,2;
```
