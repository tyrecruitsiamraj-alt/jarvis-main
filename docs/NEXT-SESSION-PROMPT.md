# Prompt เปิด session ใหม่ (อัปเดต 23 ส.ค. 2569 — จบรอบสามสิบสอง · Phase 1-7 ปิดครบ)

ก๊อปทั้งบล็อกข้างล่างไปวางเป็นข้อความแรกของ session ใหม่:

---

ทำงานต่อโปรเจกต์ jarvis / So Recruit — เซสชันก่อน context เต็ม (ส่งต่อ 23 ส.ค. 2569 · รอบสามสิบสอง)

อ่านก่อนแตะโค้ด ตามลำดับ:
1. docs/SESSION-HANDOFF.md — เริ่มหัวข้อ "รอบสามสิบสอง · 23 ส.ค. 2569" ที่อยู่บนสุด
   (สถานะ · 3 ข้อที่รอผมเคาะ · ของที่ทำเสร็จ Phase 6-7 · บั๊กเก่าที่เจอ · ตารางสวิตช์ตอน deploy)
2. ~/.claude/plans/shiny-knitting-glacier.md — แผนแม่ 8 Phase มี checkbox
   (Phase 1-7 ติ๊กครบแล้ว · Phase 8 = 3/6) · ห้ามทำงานนอกแผน · เจอของใหม่ให้เพิ่มเป็นข้อก่อนลงมือ
3. .claude/skills/request-control-tower-advisor/references/09-editing-map.md
   — อ่าน "รอบสามสิบเอ็ด" และ "รอบสามสิบสอง" ท้ายไฟล์ (แผนที่ไฟล์ + กับดักทุกข้อ)
4. docs/board-redesign-panel-2569-08-21.md — anti-patterns 22 ข้อ (ก่อนออกแบบอะไรบนบอร์ด)
5. memory: system-redesign-master-plan · redesign-round-traps · no-guessing-ask-instead ·
   owner-review-workflow · shared-prod-database · jarvis-verify-with-real-writes ·
   delete-test-rows-by-id-only · shadcn-ui-rules-and-saturday-cleanup
6. เรียก skill "system-builder" ทุกครั้งก่อนแก้โค้ด

สถานะ: 🟢 **Phase 1-7 ปิดครบทั้งหมด** · Phase 8 = 3/6
ด่านตรวจของ tree นี้ผ่านหมด (วัดจริงตอนส่งต่อ): test **2,111 ผ่าน / 6 skip (206 ไฟล์)** ·
tsc 4 config = 0 · eslint 0 error / 18 warning · registry **95 route** ·
migration ถึง **107** (รันบนฐานจริงครบแล้ว) · HEAD `9182f90`
🟡 working tree **131 รายการ** · 🔴 **ห้าม commit/push จนผมบอก**
(tsc 4 config = tsconfig.json · app · node · **tsconfig.api.json** ·
⚠️ `api/tsconfig.json` เป็นคอนฟิกค้างไม่มี paths ของ `@/` → 62 error อยู่แล้วบน HEAD ห้ามใช้เป็นด่าน)

⚠️ พฤติกรรมที่เปลี่ยนจริงแล้วในเครื่องนี้ (รู้ก่อนแตะ):
- `/apply` ว่างจนกดปล่อยใบ (ทะเบียน `job_public_releases` 0 แถว) → deploy ต้องกด "ปล่อยทั้งหน้านี้" ก่อน
- หน้า Login ซ่อนช่องรหัสผ่านเมื่อ Azure พร้อม (เครื่อง dev fail-safe โชว์ตามเดิม)
- หน้าแรกมีฉาก 3D Virtual Office เหนือ funnel เดิม
- worker กันชื่อดอง · หน้า "ดูแลหลังเริ่มงาน" (`/aftercare` เมนูหลักของตัวเอง) ·
  สถานะชุดเดียว (ตารางกลาง `selection_progress` คีย์ job_id + เบอร์ E.164) — ใช้งานได้แล้ว
- กัน declined ระดับ **หน่วยงาน** แล้ว (ไซต์เดียวมีได้ 28 ใบขอ)
🔴 ก่อน deploy: ตั้ง `CLAIM_GUARD_ENABLED=true` (worker กันชื่อดอง ปิดเป็นค่าตั้งต้น)

เหลือ 3 ข้อที่ต้องให้ผมเคาะ (ห้ามลงมือเอง):
1. **8.2 ล้างของเดิมให้ตรงกติกา UI** — `rounded-[...]` 60 จุด · hex ดิบ 41 บรรทัด/14 ไฟล์ ·
   spacing สุ่ม 2 จุด (อยู่ใน `ui/scroll-area.tsx` ของ shadcn เอง)
   งานนี้เปลี่ยนหน้าตาทั้งระบบ · ของใหม่ทุกไฟล์รอบนี้ตรงกติกาอยู่แล้ว
2. **8.3 preset `b27GcrRo`** — ย้าย Radix → Base UI ทั้ง 47 component (ทำหรือพัก)
3. **8.4 เปิด `APPLICATION_AUTO_MOVE_APPLY=true`** (รอผม review dry-run)
พัก: Phase 2.12 ฉาก 3D เป็นไฟล์ภาพ render (ต้องมี fallback ฉาก CSS เสมอ) · Phase 2.8/2.9
ค้างไว้ทีหลัง: คิว Lumos `delivered` ที่ไม่มีผลกลับ 19 สาย (เก่าสุด 16 ส.ค.)

🔴 กติกาที่ห้ามพลาด:
- ห้ามเดา ไม่ชัวร์ให้ถามเป็น Choice ทันที · สั่งจำนวนเท่าไหร่ต้องได้เท่านั้น ห้ามยุบเอง
- UI ใช้ shadcn เท่านั้น · ห้าม Dialog ซ้อน Dialog (ใช้ Popover / prop `embedded`) ·
  ห้าม hex/radius/spacing สุ่ม · สีมาจาก designTokens (TONE/DASH/HUD/HUD_SCENE) ต้องมีคู่ dark ครบ
- ก่อนคิดว่า "logic มีแล้วแต่ UI ไม่ต่อ" ให้เช็ก git ก่อน — บางอย่างผมสั่งถอดไปแล้ว
- ปุ่มที่ยิงสายจริงต้องมี popup ยืนยันรายชื่อทุกตัว · ปุ่มคำเดียวกันแต่คนละพฤติกรรม = บั๊ก
- ฐาน dev = prod · ทดสอบเขียนต้องคืนค่าเดิม · ลบด้วย id เท่านั้น ห้าม LIKE ·
  🔴 ห้ามรัน worker ทดสอบ (มันเขียนแจ้งเตือนถึงคนจริง) — เตรียมข้อมูลด้วย SQL ตรง ๆ
- ตรวจงานเองในเบราว์เซอร์ วัดจาก DOM ไม่ใช่ screenshot · `preview_start` (vite 8080 + api 3100)
  ห้าม Bash รัน server · token dev 30 นาที เด้ง login ให้ยิง POST /api/auth/dev-role {"role":"admin"}
- หลัง git pull ต้องรันเทสต์เต็มชุด · แก้ตรรกะ = แก้เทสต์ · เพิ่มไฟล์ = อัปเดต 09-editing-map.md
- สคริปต์คุยฐานใน scratchpad ต้องใช้ `createRequire` ชี้ package.json ของโปรเจกต์ +
  `SET search_path TO jarvis_rm, public`

เริ่มโดยเช็คสถานะจริง (git status ต้องเห็น 131 รายการ · เทสต์ · tsc 4 · registry 95 · migration 107)
แล้วสรุปสั้น ๆ ว่าเข้าใจอะไร จากนั้นถามผมเป็น Choice ว่าจะเคาะ 3 ข้อของ Phase 8 อย่างไร

---

## หมายเหตุสำหรับคนอ่าน (ไม่ต้องก๊อป)

* เอกสารที่แบกความรู้รอบนี้ไว้แล้ว: `docs/SESSION-HANDOFF.md` (รอบสามสิบสอง) ·
  `09-editing-map.md` (รอบสามสิบสอง — ตารางไฟล์ Phase 6-7 + บั๊กเก่า 3 ตัว) ·
  `~/.claude/plans/shiny-knitting-glacier.md` (checkbox) · memory 2 ไฟล์
  (`system-redesign-master-plan` · `redesign-round-traps`)
* บั๊กเก่าที่เจอและแก้รอบนี้ (มีเทสต์กันถอยทุกตัว): ช่อง "ไป" บนหน้า Follow นับต่ำกว่าจริง
  ตั้งแต่ migration 101 · `followup_state` ไม่เคยถูก SELECT ส่งมาฝั่งจอ ·
  id ใบขอล่วงหน้า `siamraj-pre:` ตาย 500 ที่ `jobs` / `job-assignments`
