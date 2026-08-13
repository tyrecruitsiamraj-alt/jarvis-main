---
name: jarvis-request-control-tower
description: Work safely in the Jarvis Workforce Management project, especially Request Control Tower, staffing request dashboards, SLA/backlog/fulfillment/cancellation metrics, matching, public apply, Siamraj/Lumos API adapters, Vercel API handlers, React dashboard UI, tests, and implementation planning. Use when Codex needs to inspect, explain, modify, test, or review this repo. ใช้เมื่อทำงานกับโปรเจกต์ Jarvis ศูนย์ควบคุมใบขอ แดชบอร์ดใบขอกำลังคน SLA งานค้าง การหาได้ การยกเลิก matching การรับสมัครสาธารณะ
---

# Jarvis Request Control Tower

## ภาพรวม

ใช้ skill นี้เป็นทั้งคู่มือเริ่มงาน (onboarding) และราวกันตกของโปรเจกต์ Jarvis
มันรวมแผนที่สถาปัตยกรรมของ repo เข้ากับกติกาธุรกิจของศูนย์ควบคุมใบขอที่ห้ามละเมิด
เพื่อให้งาน implement สอดคล้องกับความหมายบนแดชบอร์ด เทสต์ แผนถอยกลับ (rollback)
และคำศัพท์ไทยบนหน้าจอ

แหล่งความจริงของกติกาโดเมนศูนย์ควบคุมใบขอยังคงเป็น
`.claude/skills/request-control-tower-advisor/` — skill ฝั่ง `.codex` นี้เป็นตัวเชื่อม
(adapter) สำหรับ Codex: อ่านตัวนี้ก่อน แล้วค่อยโหลด references ฝั่ง `.claude`
เมื่องานแตะกติกาพวกนั้น

## อ่านก่อนเสมอ

เริ่มด้วยการอ่าน:

- `AGENTS.md`
- `references/01-project-overview.md`
- `references/02-code-map.md`
- `references/03-workflow-and-validation.md`

งานที่แตะ metric ของศูนย์ควบคุมใบขอ แดชบอร์ด SLA งานค้าง วงจรชีวิต การหาได้
การยกเลิก หรือพยากรณ์ — ให้อ่านชุดแหล่งความจริงฝั่ง `.claude` ตามรายการใน
`AGENTS.md` ก่อนแก้โค้ดด้วย

## กติกาที่ห้ามละเมิด

- ห้ามปน `หาได้แล้ว` กับ `ปิดครบใบขอ`
- ห้ามนับอัตราที่ถูกยกเลิกเป็นอัตราที่หาได้
- ห้ามเอา `inform_qty` จาก snapshot มาใช้เป็นยอดหาได้รายเดือนแบบเป๊ะ ๆ โดยไม่บอกใคร
- ถ้าไม่มีวันที่ของเหตุการณ์หาได้/ยกเลิก ให้ติดธง `snapshot_fallback` กับ metric ที่กระทบ
- เก็บแดชบอร์ดและ type เดิมไว้เป็นทางถอยเสมอ — ใช้ parallel layer, adapter,
  read-only API, feature flag, เทสต์ และการกระทบยอด (reconciliation)
- เปลี่ยนตรรกะการคำนวณเมื่อไหร่ อัปเดตเทสต์ด้วยเสมอ
- เพิ่มไฟล์ภายในใหม่เมื่อไหร่ อัปเดต
  `.claude/skills/request-control-tower-advisor/references/09-editing-map.md` ด้วยเสมอ

สมการหลัก:

```text
ยอดค้างต้นงวด + ขอใหม่ - หาได้แล้ว - ยกเลิก = เหลือหา
```

## ขั้นตอนทำงานมาตรฐาน

1. จำแนกคำขอก่อน: metric ของแดชบอร์ด · API · matching · การรับสมัครสาธารณะ ·
   auth/RBAC · UI · การนำเข้าข้อมูล · เอกสาร · หรือเทสต์อย่างเดียว
2. อ่านเส้นทางโค้ดที่เกี่ยวข้องจาก `references/02-code-map.md` แล้วใช้ `rg`
   ยืนยันว่า symbol กับจุดเรียกใช้ปัจจุบันตรงกับที่เข้าใจ
3. งานฝั่งศูนย์ควบคุมใบขอ ให้พูดหน่วยของ metric ให้ชัดก่อน: นับ "อัตรา" หรือ "ใบขอ"
   ระบุฟิลด์ต้นทางข้อมูลและวันที่ของเหตุการณ์ก่อนเขียนโค้ด
4. เพิ่ม/อัปเดตเทสต์ยืนยันผล ก่อนหรือพร้อมกับการแก้การคำนวณ
5. แก้ให้แคบและเข้ากันได้ย้อนหลัง — ห้ามเปลี่ยนชื่อ/ลบฟิลด์ `DashboardData` เดิม
   หรือพฤติกรรมเขียน SQL เดิม เว้นแต่ถูกสั่งอย่างชัดเจน
6. รันเทสต์เฉพาะจุดก่อน แล้วค่อยรันชุดกว้างหรือ build เมื่อความเสี่ยงคุ้ม
7. สรุปไฟล์ที่แก้ ผลกระทบทางธุรกิจ การตรวจที่รันไป และความเสี่ยงที่เหลือ

## สไตล์การตอบ

สำหรับเจ้าของโปรเจกต์: ขึ้นต้นด้วยสรุปผู้บริหาร ให้คำแนะนำเดียว อธิบายผลกระทบ
ทางธุรกิจ แล้วค่อยไล่ขั้นตอน implement หรือการตรวจ · แนบ prompt พร้อมใช้กับ Cursor
เฉพาะตอนที่มีประโยชน์จริง

## เอกสารอ้างอิง

- `references/01-project-overview.md` — stack, runtime, routes, แหล่งข้อมูล, คำสั่ง
- `references/02-code-map.md` — เส้นทางโค้ดและเทสต์แยกตามฟีเจอร์
- `references/03-workflow-and-validation.md` — ขั้นตอน implement อย่างปลอดภัย,
  กติกา metric, คำสั่งตรวจสอบ
