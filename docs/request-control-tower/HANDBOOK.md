# Request Control Tower — Project Handbook

คู่มือสำหรับเจ้าของโปรเจกต์ / ผู้พัฒนา / AI agent ที่ทำงานกับ Request Control Tower

เอกสารนี้เป็น handbook ระดับโปรเจกต์ ไม่ใช่โค้ด production  
รายละเอียดเชิงลึกอยู่ที่ skill pack: `.claude/skills/request-control-tower-advisor/`

---

## 1. โปรเจกต์นี้คืออะไร

Request Control Tower คือแดชบอร์ดสำหรับติดตามใบขออัตรากำลัง (staffing / workforce requests) เพื่อตอบคำถามผู้บริหารและปฏิบัติการ:

| คำถาม | ตัวชี้วัดหลัก |
| --- | --- |
| ขอมาเท่าไหร่ | ขอมา / ขอใหม่งวดนี้ / ภาระงานรวม |
| หาคนได้เท่าไหร่ | หาได้แล้ว |
| ปิดครบใบขอหรือยัง | ปิดครบใบขอ |
| ยกเลิกเท่าไหร่ | ยกเลิก |
| ยังต้องหาเท่าไหร่ | เหลือหา |
| งานค้างเพิ่มหรือลด | ยอดค้างต้นงวด → เหลือหา |
| SLA เสี่ยงไหม | SLA เสี่ยง/เกิน |
| มาจากลาออก/เปลี่ยนตัว/ฯลฯ | Lifecycle trend |
| ใคร/หน่วยงานไหนเป็นต้นเหตุ | Root cause ranking |

สมการหลัก:

```text
ยอดค้างต้นงวด + ขอใหม่ - หาได้แล้ว - ยกเลิก = เหลือหา
```

---

## 2. คำศัพท์ที่ต้องแยกให้ชัด

| ไทย | ความหมาย | ห้ามสับสนกับ |
| --- | --- | --- |
| หาได้แล้ว | ตำแหน่งที่แจ้งเข้า/หาได้แล้ว | ปิดครบใบขอ |
| ปิดครบใบขอ | ใบขอที่หาครบทุกตำแหน่ง | หาได้แล้ว / จบงานแล้ว |
| ยกเลิก | ตำแหน่งที่ยกเลิก | หาได้แล้ว |
| จบงานแล้ว | เหลือหา = 0 (หาครบหรือยกเลิกจนหมด) | ปิดครบใบขอเสมอ |
| เหลือหา | ตำแหน่งที่ยังต้องหา | งานค้างปลายงวดแบบ event-only |
| งานค้าง / ยอดยกมา | backlog จากงวดก่อน | ขอใหม่ |

รายละเอียดเต็ม: `.claude/skills/request-control-tower-advisor/references/02-dashboard-metric-definitions.md`

---

## 3. โครงสร้างเอกสารใน repo

```text
CLAUDE.md                                          ← router สำหรับ Claude/Cursor
.cursor/rules/request-control-tower.mdc            ← Cursor rule
.claude/skills/request-control-tower-advisor/      ← Claude Code auto-discovers here
  SKILL.md
  references/
    01 … 09
skills/request-control-tower-advisor/README.md     ← pointer ไป .claude/skills/
docs/request-control-tower/
  HANDBOOK.md                                      ← ไฟล์นี้
```

ก่อนแก้โค้ดที่เกี่ยวกับ Control Tower ให้ agent อ่านตามลำดับใน `CLAUDE.md`

---

## 4. กติกาปลอดภัย (ห้ามข้าม)

1. **อย่า rewrite dashboard เดิมตรงๆ** — ใช้ parallel layer + feature flag + adapter
2. **อย่าลบ/rename ฟิลด์ `DashboardData` เดิม** — ขยายแบบ backward-compatible
3. **อย่าถือ `inform_qty` snapshot เป็นยอดรายเดือนที่แน่นอน** — ถ้าไม่มีวันที่ event ให้ติด `snapshot_fallback`
4. **อย่านับยกเลิกเป็นหาได้แล้ว**
5. **อย่าผสม หาได้แล้ว กับ ปิดครบใบขอ**
6. **เปลี่ยน logic ต้องมี unit tests**
7. **เพิ่มไฟล์ภายในใหม่ ต้องอัปเดต `09-editing-map.md`**
8. **dashboard เดิมต้อง rollback ได้ทันที**

Feature flag ที่แนะนำ:

```env
VITE_REQUEST_CONTROL_TOWER_ENABLED=true
```

รายละเอียด: `.claude/skills/request-control-tower-advisor/references/06-safe-implementation-rules.md`

---

## 5. แผนที่แก้โค้ด (Editing Map สรุป)

| อยากแก้เรื่อง | แก้เอกสารก่อน | โค้ดเป้าหมาย (อนาคต / ที่มีอยู่) |
| --- | --- | --- |
| คำศัพท์ / ป้าย KPI | `02-dashboard-metric-definitions.md` | `src/components/dashboard/...` |
| วันที่ใบขอ / effective date | `03-request-ledger-logic.md` | `requestLedger.ts`, `jobUrgency.ts` |
| SLA | `04-sla-rules.md` | `sla.ts` |
| Lifecycle | `03-request-ledger-logic.md` | `lifecycle.ts` |
| สมการงานค้าง | `03-request-ledger-logic.md` | `calculations.ts`, `reconciliation.ts` |
| UI | `05-ui-design-rules.md` | `src/components/dashboard/request-control/` |
| Feature flag | `06-safe-implementation-rules.md` | routing / render |
| SQL mapping | `03-request-ledger-logic.md` | adapter / read-only API |

แผนที่เต็ม: `.claude/skills/request-control-tower-advisor/references/09-editing-map.md`

โค้ดที่เกี่ยวกับ Control Tower ที่มีอยู่แล้วใน repo (อ่านก่อน อย่า rewrite มั่ว):

* `src/lib/dashboard/requestControlLedger.ts`
* `src/lib/dashboard/requestControlBridge.ts`
* `src/lib/dashboard/buildDashboardData.ts`
* `src/pages/dashboard/SupervisorDashboard.tsx`
* `src/components/dashboard/analytics/`

---

## 6. SLA สรุปสั้นๆ

| ประเภทใบขอ | วันเริ่มนับ | จำนวนวัน |
| --- | --- | --- |
| ฉุกเฉินย้อนหลัง (retroactive) | วันที่กรอก/submitted | 7 วัน |
| ฉุกเฉิน (urgent) | วันที่ต้องการ | 15 วัน |
| ล่วงหน้า (advance) | วันที่ต้องการ | 15 วัน |

SLA หลักสำหรับผู้บริหาร = **Full Closure SLA** (ปิดครบใบขอภายในกำหนด)  
ยกเลิก ≠ ปิดครบใบขอ

รายละเอียด: `.claude/skills/request-control-tower-advisor/references/04-sla-rules.md`

---

## 7. Checklist ก่อนขึ้น production

ใช้ `.claude/skills/request-control-tower-advisor/references/08-redteam-premortem-checklist.md`

จุดที่พลาดบ่อย:

* ตัวเลขไม่ตรงรายงานเดิม
* ผู้ใช้สับสน หาได้แล้ว กับ ปิดครบใบขอ
* ใช้ snapshot เป็นยอดรายเดือนโดยไม่เตือน
* นับยกเลิกเป็นสำเร็จ
* UI แน่นจนไม่ใช้
* rewrite dashboard เดิมแล้วพัง production

---

## 8. Prompt เริ่มงานกับ Cursor (แนะนำ)

คัดลอกจาก `.claude/skills/request-control-tower-advisor/references/07-cursor-prompt-patterns.md` หรือใช้แบบสั้น:

```text
Read CLAUDE.md and all files in .claude/skills/request-control-tower-advisor
and docs/request-control-tower/HANDBOOK.md before making changes.

Implement the next Request Control Tower increment using:
parallel calculation layer, feature flag, adapter, read-only API,
backward-compatible types, unit tests, and reconciliation.

Do not delete old dashboard code.
Do not rename existing DashboardData fields.
Do not change SQL write behavior.
Keep หาได้แล้ว / ปิดครบใบขอ / ยกเลิก / จบงานแล้ว / เหลือหา separate.
```

---

## 9. ขั้นตอนถัดไปที่แนะนำ

1. อ่าน skill pack ให้ครบ (โดยเฉพาะ `06` + `09`)
2. ออกแบบ parallel layer ใต้ `src/lib/dashboard/request-control/` (ยังไม่แตะ SQL write)
3. ใส่ feature flag + preview route
4. ย้าย/ห่อ calculation ที่มีอยู่ผ่าน adapter โดยคง dashboard เดิม
5. เพิ่ม tests ตาม acceptance cases ใน ledger skill
6. ค่อยเปิด UI เต็มเมื่อ reconciliation ผ่าน

---

## 10. เจ้าของเอกสาร

เมื่อมีการเพิ่มไฟล์โค้ดภายในใหม่ที่เกี่ยวข้องกับ Control Tower:

1. อัปเดต `09-editing-map.md`
2. อัปเดตส่วนที่ 5 ของ handbook นี้ถ้าจำเป็น
3. อย่าลบเนื้อหาเดิมใน `CLAUDE.md` — เพิ่มต่อท้ายหรืออัปเดต router อย่างระมัดระวัง
