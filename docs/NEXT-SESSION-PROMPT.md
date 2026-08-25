# Prompt สำหรับเปิด session ใหม่ (คัดลอกทั้งบล็อกไปวาง)

> อัปเดตล่าสุด 25 ส.ค. 2569 · รอบสี่สิบ · HEAD `63a7792`

---

ทำงานต่อโปรเจกต์ jarvis / So Recruit — เซสชันก่อน context เต็ม (ส่งต่อ 25 ส.ค. 2569 · รอบสี่สิบ)

อ่านก่อนแตะโค้ด ตามลำดับ:
1. `docs/SESSION-HANDOFF.md` — เริ่มหัวข้อ "รอบสี่สิบ · 25 ส.ค. 2569" ที่อยู่บนสุด
   (สถานะ · ของค้าง 7 ข้อ · คำเคาะผูกมัดของเจ้าของ)
2. `~/.claude/plans/shiny-knitting-glacier.md` — แผนแม่ 8 Phase + Phase 10
   อ่านหัวข้อ "สถานะแผน ณ 25 ส.ค. 2569" ท้ายไฟล์ · ห้ามทำงานนอกแผน เจอของใหม่ให้เพิ่มเป็นข้อก่อน
3. `.claude/skills/request-control-tower-advisor/references/09-editing-map.md`
   — อ่าน **รอบสามสิบสี่ ถึง รอบสามสิบเก้า** ท้ายไฟล์ (แผนที่ไฟล์ + กับดักทุกข้อ)
4. memory: `system-redesign-master-plan` · `jarvis-home-scene-is-rendered-image` ·
   `jarvis-bu-lives-in-site-code` · `redesign-round-traps` · `no-guessing-ask-instead` ·
   `owner-review-workflow` · `shared-prod-database` · `jarvis-verify-with-real-writes`
5. เรียก skill **"system-builder"** ทุกครั้งก่อนแก้โค้ด

## สถานะ (วัดจริงตอนส่งต่อ)

🟢 **ขึ้น production หมดแล้ว** — HEAD `63a7792` ตรงกับ origin (0/0) · **working tree ว่าง 0 ไฟล์**
test **2,177 ผ่าน / 6 skip (211 ไฟล์)** · tsc 4 config = 0 · eslint 0 error / 18 warning ·
registry **97 route** · migration **110 ไฟล์ apply ครบ** · build ผ่าน

🔴 **push เข้า main = deploy อัตโนมัติทันที** (~1-1.5 นาที) · `git commit` เฉย ๆ ไม่กระทบ
⚠️ `api/tsconfig.json` เป็นคอนฟิกค้างไม่มี paths ของ `@/` → 62 error อยู่แล้ว **ห้ามใช้เป็นด่าน**
(ด่านจริงคือ `tsconfig.json` · `tsconfig.app.json` · `tsconfig.node.json` · `tsconfig.api.json`)

## ข้อมูลจริงบน production

ปล่อยใบขึ้น `/apply` **177 ใบ** · ราชการ/เอกชน กรอกแล้ว **79/138 หน่วยงาน** ·
ใบสมัครทั้งระบบ **1 ใบ** · Lumos ค้างไม่มีผลกลับ **19 สาย** (เก่าสุด 15 ส.ค.)

## ของค้างที่รู้อยู่ (ยังไม่มีใครสั่งให้แก้)

1. `job_category` ฮาร์ดโค้ด `'private'` ทุกใบทั้งสองเส้น feed → ค้นหา "เอกชน" เจอทุกใบ
2. `/api/office-floor` ไม่ส่งเลขโต๊ะ `aftercare` → การ์ดขึ้น "ยังไม่เปิดใช้" ทั้งที่ทำเสร็จแล้ว
3. Lumos delivered ไม่มีผลกลับ 19 สาย
4. `CLAIM_GUARD_ENABLED` ไม่มีใน `deploy.yml` (worker กันชื่อดองไม่ทำงานบน production)
5. `APPLICATION_AUTO_MOVE_APPLY=false` (เจ้าของเลื่อน · ดู 8.4)
6. ผล dry-run auto-move เก็บใน memory รีสตาร์ตแล้วหาย · ย้ายใบแล้วไม่แจ้งเตือนใคร
7. Phase 8 เหลือ 8.2 (ล้าง rounded/hex ของเดิม) · 8.3 (Radix→Base UI) — เจ้าของสั่งพัก
8. Phase 10.5 (2.8/2.9 กันรกหน้าแรก) ยังไม่เริ่ม

## 🔴 กติกาที่ห้ามพลาด

- **ห้ามเดา ไม่ชัวร์ให้ถามเป็น Choice ทันที** · สั่งจำนวนเท่าไหร่ต้องได้เท่านั้น ห้ามยุบเอง
- **ก่อนสร้างของใหม่ ให้ไปวัดฐานจริงก่อนเสมอ** — รอบนี้เจอสามครั้งที่ข้อมูลจริงหักล้างสมมติฐาน
  (BU อยู่ใน site_code ไม่ใช่ prefix ใบขอ · ERP มี ms_customer_group 7 กลุ่มไม่ใช่ 2 ·
  เงินคนที่ออกมี 2 ตัวคนละความหมาย)
- **ก่อนถอด/ย้าย UI ที่มีคนใช้อยู่ ต้องวัดว่ามีใครใช้อยู่ไหม แล้วบอกเจ้าของก่อน push**
- หน้าแรก: **ฉากเป็นภาพ render ห้ามปั้น CSS ใหม่** · ภาพใหม่ต้องไม่มีตัวหนังสือฝัง
  และต้องวัด `ROOM_SPOTS` ใหม่
- UI ใช้ shadcn เท่านั้น · ห้าม Dialog ซ้อน Dialog · ห้าม hex/radius/spacing สุ่ม
  สีมาจาก `designTokens` (TONE/DASH/HUD/HUD_SCENE) ต้องมีคู่ dark ครบ
- ฐาน dev = prod · **ทดสอบเขียนต้องคืนค่าเดิม · ลบด้วย id เท่านั้น ห้าม LIKE**
- 🔴 **ห้ามรัน worker ทดสอบ** (เขียนแจ้งเตือนถึงคนจริง) — เตรียมข้อมูลด้วย SQL ตรง ๆ
- ตรวจงานเองในเบราว์เซอร์ **วัดจาก DOM ไม่ใช่ screenshot** · `preview_start` (vite + api 3100)
  ห้าม Bash รัน server · token dev 30 นาที เด้ง login ให้ยิง
  `POST /api/auth/dev-role {"role":"admin"}`
- แก้ตรรกะ = แก้เทสต์ · เพิ่มไฟล์ = อัปเดต `09-editing-map.md`
- สคริปต์คุยฐานต้องวางใน `scripts/` (ไม่งั้น import `mssql`/`pg` ไม่เจอ) แล้วลบทิ้งหลังใช้
  · ฝั่ง pg ใช้ `import '../server/bootstrap-env.js'` แล้ว import `api/_lib/postgres.js`

## เริ่มยังไง

เช็คสถานะจริงก่อน (git status ต้องว่าง · HEAD ตรง origin · test · tsc 4 · registry 97 ·
migration 110) แล้วสรุปสั้น ๆ ว่าเข้าใจอะไร จากนั้นถามผมว่าจะทำอะไรต่อ
