# ตัวชี้ทาง Skill ของโปรเจกต์: ศูนย์ควบคุมใบขอ (Request Control Tower)

เมื่อทำงานเกี่ยวกับศูนย์ควบคุมใบขอ แดชบอร์ดใบขอกำลังคน แดชบอร์ด SLA แดชบอร์ดงานค้าง
ตรรกะการหาได้ ตรรกะการยกเลิก แนวโน้มวงจรชีวิตใบขอ อันดับต้นเหตุ
หรืองาน implement ใด ๆ ที่เกี่ยวข้อง (ทั้ง Cursor และ Claude) ให้อ่านไฟล์เหล่านี้ก่อนเสมอ:

1. .claude/skills/request-control-tower-advisor/SKILL.md
2. .claude/skills/request-control-tower-advisor/references/01-business-context.md
3. .claude/skills/request-control-tower-advisor/references/02-dashboard-metric-definitions.md
4. .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md
5. .claude/skills/request-control-tower-advisor/references/04-sla-rules.md
6. .claude/skills/request-control-tower-advisor/references/06-safe-implementation-rules.md
7. .claude/skills/request-control-tower-advisor/references/09-editing-map.md

> **การค้นหา skill ของ Claude Code:** skill ของโปรเจกต์ต้องอยู่ใต้ `.claude/skills/`
> เท่านั้น (ไม่ใช่ `skills/` ที่ root ของ repo)
> ที่ `skills/request-control-tower-advisor/README.md` เหลือไว้เป็นป้ายชี้ทางสั้น ๆ

กติกาหลักที่ห้ามละเมิด:

* ห้ามปน "หาได้แล้ว" กับ "ปิดครบใบขอ"
* ห้ามนับอัตราที่ถูกยกเลิกเป็นอัตราที่หาได้
* ห้ามเอา inform_qty จาก snapshot มาใช้เป็นยอดหาได้รายเดือนแบบเป๊ะ ๆ โดยไม่บอกใคร
* ถ้าไม่มีวันที่ของเหตุการณ์หาได้ ให้ติดธง snapshot_fallback กับ metric ที่กระทบ
* ห้ามเขียนทับแดชบอร์ดเดิมตรง ๆ
* ใช้ parallel layer + feature flag + adapter + read-only API
* แดชบอร์ดเดิมต้องยังใช้งานได้เสมอ เป็นทางถอย (rollback)
* เปลี่ยนตรรกะการคำนวณเมื่อไหร่ ต้องอัปเดตเทสต์ด้วยเสมอ
* เพิ่มไฟล์ภายในใหม่เมื่อไหร่ ต้องอัปเดต 09-editing-map.md ด้วยเสมอ

สมการหลัก:
ยอดค้างต้นงวด + ขอใหม่ - หาได้แล้ว - ยกเลิก = เหลือหา

คำศัพท์บนหน้าจอที่ใช้ประจำ:

* ขอมา = requested positions
* หาได้แล้ว = fulfilled/informed positions
* ปิดครบใบขอ = fully fulfilled requests
* ยกเลิก = cancelled positions
* จบงานแล้ว = resolved requests
* เหลือหา = remaining positions
* งานค้าง / ยอดยกมา = backlog
* หาได้บางส่วน = partial fulfillment

## คู่มือโปรเจกต์

คู่มือฉบับอ่านง่ายสำหรับคน:

* docs/request-control-tower/HANDBOOK.md
