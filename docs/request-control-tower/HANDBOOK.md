# Request Control Tower — Project Handbook

คู่มือกลางสำหรับเจ้าของโครงการ ผู้พัฒนา ผู้ทดสอบ และ AI agent ที่ทำงานกับ Request Control Tower

เอกสารนี้สรุปเป้าหมายธุรกิจ กติกาการคำนวณ โครงสร้างระบบ จุดแก้ไข วิธีส่งมอบ Skill และ checklist ก่อนขึ้น production โดยยึดสถานะ repository ณ วันที่ **20 กรกฎาคม 2026**

> Path มาตรฐานตาม `AGENTS.md` คือ `.Codex/skills/request-control-tower-advisor/` ส่วน session ปัจจุบันโหลด Skill ผ่าน compatibility path `.agents/skills/request-control-tower-advisor/` หากกติกาใน Handbook กับ Skill ไม่ตรงกัน ต้องหยุดและปรับเอกสารทั้งสองชุดให้ตรงกันก่อนแก้ calculation code

---

## 1. เป้าหมายของระบบ

Request Control Tower คือแดชบอร์ดสำหรับควบคุมใบขออัตรากำลังตั้งแต่รับคำขอจนจบงาน โดยต้องช่วยให้ผู้บริหารและทีมปฏิบัติการตอบคำถามต่อไปนี้ได้จากข้อมูลชุดเดียวกัน:

| คำถามธุรกิจ | ตัวชี้วัดหลัก |
| --- | --- |
| มีงานยกมาจากงวดก่อนเท่าไร | งานค้าง / ยอดยกมา |
| งวดนี้มีคำขอใหม่เท่าไร | ขอใหม่ / requested positions |
| หาและแจ้งคนได้แล้วเท่าไร | หาได้แล้ว / fulfilled positions |
| ปิดครบทั้งใบขอแล้วกี่ใบ | ปิดครบใบขอ / fully fulfilled requests |
| ยกเลิกไปเท่าไร | ยกเลิก / cancelled positions |
| จบงานแล้วกี่ใบ | จบงานแล้ว / resolved requests |
| ยังต้องหาอีกเท่าไร | เหลือหา / ending backlog |
| ใบใดต้องเร่งวันนี้ | Priority Work Queue และ SLA |
| Demand เกิดจากอะไร | Lifecycle trend |
| หน่วยงาน ลูกค้า หรือผู้รับผิดชอบใดเป็นต้นเหตุซ้ำ | Root Cause Ranking |

สมการควบคุมหลัก:

```text
ยอดค้างต้นงวด + ขอใหม่ - หาได้แล้ว - ยกเลิก = เหลือหา
```

สมการนี้ต้อง reconcile ได้ทุกงวด หากไม่เท่ากันต้องแสดง `diff` และคำอธิบาย ห้ามซ่อนความคลาดเคลื่อน

---

## 2. คำศัพท์ที่ห้ามนับปนกัน

| คำที่ใช้ใน UI | ความหมาย | กติกา |
| --- | --- | --- |
| ขอมา | จำนวนตำแหน่งที่ร้องขอ | ใช้ `requestPositions` |
| หาได้แล้ว | จำนวนตำแหน่งที่แจ้งเข้า/หาได้ | ไม่ได้แปลว่าปิดครบทั้งใบ |
| หาได้บางส่วน | หาได้มากกว่า 0 แต่ยังเหลือหา | สถานะ `partial` |
| ปิดครบใบขอ | หาได้ครบทุกตำแหน่ง | `fulfilledPositions >= requestPositions` |
| ยกเลิก | จำนวนตำแหน่งที่เลิกต้องการ | ห้ามนับเป็นหาได้แล้ว |
| จบงานแล้ว | ใบขอที่ `remainingPositions = 0` | อาจจบเพราะหาได้ครบหรือยกเลิกส่วนที่เหลือ |
| เหลือหา | ตำแหน่งที่ยังต้องดำเนินการ | `max(ขอมา - หาได้แล้ว - ยกเลิก, 0)` |
| งานค้าง / ยอดยกมา | งานจากก่อนเริ่มงวดที่ยังเหลือหา | แยกจากขอใหม่งวดนี้ |

ข้อห้ามสำคัญ:

1. **หาได้แล้ว ≠ ปิดครบใบขอ**
2. **ยกเลิก ≠ หาได้แล้ว**
3. **จบงานแล้ว ≠ ปิดครบใบขอเสมอไป**
4. ห้ามใช้คำว่า “ปิดได้” เป็น KPI หลัก เพราะกำกวม
5. ตัวเลขระดับตำแหน่งและระดับใบขอต้องระบุหน่วยให้ชัดเจน

### Acceptance cases ขั้นต่ำ

| ขอมา | หาได้แล้ว | ยกเลิก | เหลือหา | สถานะ | ปิดครบ | จบงาน |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 5 | 3 | 0 | 2 | `partial` | ไม่ใช่ | ไม่ใช่ |
| 5 | 5 | 0 | 0 | `fully_fulfilled` | ใช่ | ใช่ |
| 5 | 2 | 3 | 0 | `partially_fulfilled_cancelled_remaining` | ไม่ใช่ | ใช่ |
| 5 | 0 | 5 | 0 | `cancelled_full` | ไม่ใช่ | ใช่ |

---

## 3. สถานะระบบปัจจุบัน

ระบบมี calculation layer สำหรับ Request Control Tower แล้ว และเชื่อมผลเข้ากับ dashboard builder ปัจจุบัน

### Calculation และ adapter

| หน้าที่ | ไฟล์หลัก |
| --- | --- |
| Request ledger, fulfillment events, SLA และ reconciliation | `src/lib/dashboard/requestControlLedger.ts` |
| แปลง V3 ledger ให้เข้ากับ dashboard types เดิม | `src/lib/dashboard/requestControlBridge.ts` |
| สร้าง DashboardData และรวมข้อมูลทุกส่วน | `src/lib/dashboard/buildDashboardData.ts` |
| Summary, flow, cohort และ executive insights | `src/lib/dashboard/buildRequestControlSummaries.ts` |
| Lifecycle classification และ lifecycle board | `src/lib/dashboard/lifecycle.ts` |
| Throughput/event aggregation | `src/lib/dashboard/throughput.ts` |
| Model และ helper เดิมที่ยังรองรับอยู่ | `src/lib/requestControl.ts` |

### UI

| หน้าที่ | ไฟล์หลัก |
| --- | --- |
| Dashboard หลัก | `src/pages/dashboard/SupervisorDashboard.tsx` |
| Analytics components | `src/components/dashboard/analytics/` |
| Drill-down และ detail model | `src/lib/dashboard/drillDownFilters.ts`, `src/lib/dashboard/dashboardDetailDialog.ts` |
| Priority queue | `src/lib/dashboard/priorityWorkQueue.ts` |

### Tests ที่เกี่ยวข้องโดยตรง

| ขอบเขต | ไฟล์ |
| --- | --- |
| Ledger acceptance cases | `tests/api/requestControlLedger.test.ts` |
| Dashboard integration | `tests/api/buildDashboardData.test.ts` |
| Demand / fulfillment / backlog | `tests/api/demandFulfillmentBacklog.test.ts` |
| Request control model | `tests/api/requestControl.test.ts` |
| Lifecycle | `tests/api/lifecycleBoard.test.ts`, `tests/api/lifecycleErpClassify.test.ts` |
| Throughput | `tests/api/throughput.test.ts` |
| KPI กับ work status | `tests/api/workStatusKpiAlign.test.ts` |

### ช่องว่างที่ต้องระวัง

- ยังไม่พบ `VITE_REQUEST_CONTROL_TOWER_ENABLED` ใน source ปัจจุบัน แม้ safe architecture กำหนดให้มี feature flag และ rollback path
- Calculation V3 ถูกเรียกใน `buildDashboardData.ts` แล้ว ดังนั้นการแก้ ledger มีผลต่อ dashboard จริง ต้องมี regression tests ทุกครั้ง
- ต้องตรวจแหล่งวันที่ fulfillment/cancellation ให้ชัดก่อนอ้างเป็นยอดรายเดือน หากไม่มี event date ให้ใช้ `snapshot_fallback`
- เอกสารเก่าบางจุดเคยอ้าง `.claude/skills/...` และ session ปัจจุบันมีไฟล์ที่ `.agents/skills/...` แต่ `AGENTS.md` กำหนด path ส่งมอบมาตรฐานเป็น `.Codex/skills/...`; ต้องจัดให้เหลือ source of truth เดียวก่อนส่งต่อ repository

---

## 4. Request Ledger และ Fulfillment Event Ledger

### Request Ledger ต้องมีอย่างน้อย

- `requestNo`, `requestId`, `source`
- `submittedDate`, `requiredDate`, `effectiveRequestDate`
- `requestKind`, `lifecycleKind`, `requestActionName`
- `requestPositions`
- หน่วยงาน ไซต์ ลูกค้า และผู้รับผิดชอบ
- `slaStartDate`, `slaDueDate`, `slaDays`

### Fulfillment Event Ledger ต้องมีอย่างน้อย

- `requestNo`, `requestId`
- `eventDate`
- `eventType`: `informed` หรือ `cancelled`
- `positionQty`
- `sourceTable`, `sourceId`
- `isDateReliable`, `reliabilityNote`

สูตรต่อใบขอ:

```text
remainingPositions = max(requestPositions - fulfilledPositions - cancelledPositions, 0)
```

### Data quality modes

| Mode | ใช้เมื่อ | วิธีแสดงผล |
| --- | --- | --- |
| `event_based` | มี event และวันที่เชื่อถือได้ | ใช้คำนวณรายงวดได้ |
| `snapshot_fallback` | มีเฉพาะสถานะล่าสุด เช่น `inform_qty` | แสดง “ประมาณการจากสถานะล่าสุด” |
| `mixed` | บางรายการมี event บางรายการเป็น snapshot | แสดงคำเตือนและขอบเขตผลกระทบ |
| `insufficient` | ข้อมูลไม่พอคำนวณ | ห้ามแสดงเป็นตัวเลขยืนยัน |

ห้ามนำ snapshot ล่าสุดไปกระจายย้อนหลังเป็นยอดรายเดือนโดยไม่มีหลักฐานวันที่

---

## 5. Request Kind, Effective Date และ Lifecycle

### Request kind

| ประเภท | เงื่อนไข | Effective request date |
| --- | --- | --- |
| `retroactive` / ฉุกเฉินย้อนหลัง | required date < submitted date | submitted date |
| `urgent` / ฉุกเฉิน | required date ≥ submitted date และ lead time < 7 วัน | required/want date |
| `advance` / ล่วงหน้า | lead time ≥ 7 วัน | required/want date |
| `unknown` | วันที่ไม่พอจำแนก | ใช้ fallback ที่ระบุได้และติด data-quality note |

### Lifecycle mapping

| Lifecycle | ตัวอย่าง request action |
| --- | --- |
| `resignation` | ลาออก |
| `replacement` | เปลี่ยนตัว / ส่งคนแทน |
| `increase_headcount` | เพิ่มอัตรา |
| `new_site` | เปิดไซต์ |
| `other` | รายการที่ไม่เข้าเงื่อนไขข้างต้น |

ต้องเก็บ raw `requestActionName` ไว้เสมอ เพื่อ audit และปรับ mapping ในอนาคต

---

## 6. SLA

| Request kind | วันเริ่มนับ | SLA |
| --- | --- | ---: |
| `retroactive` | submitted/request date | 7 วัน |
| `urgent` | required/want date | 15 วัน |
| `advance` | required/want date | 15 วัน |

SLA มี 3 มุมที่ต้องแยก:

1. **Fulfillment SLA** — จำนวนตำแหน่งที่หาได้ภายใน SLA
2. **Full Closure SLA** — ใบขอถูกหาได้ครบทั้งใบภายใน SLA หรือไม่ เป็น KPI หลักสำหรับผู้บริหาร
3. **Resolution SLA** — ใบขอไม่เหลือตำแหน่งแล้วภายใน SLA หรือไม่ รวมกรณียกเลิก

สถานะมาตรฐาน:

- `on_track`
- `at_risk` — เหลือ 0–3 วันและยังไม่ breach
- `breached`
- `fulfilled_on_time`
- `fully_closed_on_time`
- `resolved_on_time`
- `closed_late`
- `resolved_late`

ยกเลิกต้องไม่ถูกนับเป็น Full Closure ที่สำเร็จ

---

## 7. Safe implementation rules

การเปลี่ยนแปลง Control Tower ต้องรักษา dashboard เดิมให้ใช้งานและ rollback ได้

หลักบังคับ:

1. ใช้ parallel calculation layer ไม่เขียนทับ logic เดิมแบบถอนราก
2. ใช้ adapter เพื่อรักษา types และ consumers เดิม
3. API ใหม่ต้องเป็น read-only จนกว่าจะอนุมัติ write flow โดยชัดเจน
4. ห้ามลบหรือ rename ฟิลด์ `DashboardData` เดิม
5. เพิ่มฟิลด์แบบ backward-compatible
6. Calculation logic ทุกจุดต้องมี unit tests และ reconciliation
7. เปิดผ่าน feature flag/preview ก่อนแทนที่ production path
8. ต้อง rollback ได้ทันที
9. หากเพิ่มไฟล์ภายในใหม่ ต้องอัปเดต `references/09-editing-map.md`
10. ห้ามเปลี่ยน SQL write behavior จากงาน dashboard

Feature flag ที่กำหนดไว้:

```env
VITE_REQUEST_CONTROL_TOWER_ENABLED=true
```

ก่อนเพิ่ม flag ต้องออกแบบ behavior เมื่อ `true`, `false`, ไม่ได้ตั้งค่า และกรณี API ใหม่ล้มเหลวให้ชัดเจน

---

## 8. Editing map แบบย่อ

| ต้องการเปลี่ยน | อ่าน/แก้เอกสารก่อน | Code เป้าหมาย |
| --- | --- | --- |
| คำศัพท์หรือ KPI | `references/02-dashboard-metric-definitions.md` | dashboard components และ types |
| Request/effective date | `references/03-request-ledger-logic.md` | `requestControlLedger.ts`, `jobUrgency.ts` |
| SLA | `references/04-sla-rules.md` | `requestControlLedger.ts`, SLA helpers |
| Lifecycle | `references/03-request-ledger-logic.md` | `lifecycle.ts`, ledger adapter |
| Backlog/reconciliation | `references/03-request-ledger-logic.md` | `requestControlLedger.ts`, summary builders |
| UI/priority layout | `references/05-ui-design-rules.md` | `SupervisorDashboard.tsx`, analytics components |
| Feature flag/rollback | `references/06-safe-implementation-rules.md` | config, route และ render logic |
| SQL mapping | `references/03-request-ledger-logic.md` | Siamraj adapters และ read-only handlers |
| เพิ่มไฟล์ใหม่ | `references/09-editing-map.md` | เพิ่ม path ใหม่ลง editing map ใน change เดียวกัน |

Editing map ฉบับเต็มตาม path มาตรฐาน: `.Codex/skills/request-control-tower-advisor/references/09-editing-map.md`

Compatibility path ที่ session นี้ใช้อ่าน: `.agents/skills/request-control-tower-advisor/references/09-editing-map.md`

---

## 9. Workflow มาตรฐานสำหรับการเปลี่ยนระบบ

1. อ่าน router, Skill, references ที่เกี่ยวข้อง และ Handbook
2. ระบุ metric ที่เปลี่ยน พร้อมระดับหน่วย: ตำแหน่งหรือใบขอ
3. ระบุ source fields, event dates และ data-quality mode
4. เขียน acceptance cases ก่อนแก้ calculation
5. แก้ parallel layer/adapter โดยรักษา interface เดิม
6. เพิ่มหรืออัปเดต tests
7. รัน reconciliation เทียบข้อมูลเดิม/Excel/ตัวอย่างที่เจ้าของงานรับรอง
8. ตรวจ drill-down ว่า KPI ย้อนกลับถึงใบขอจริงได้
9. ทดสอบ preview และ rollback path
10. อัปเดต Handbook/Skill/editing map เมื่อกติกาหรือโครงสร้างเปลี่ยน

---

## 10. Checklist ก่อนขึ้น production

- [ ] หาได้แล้ว แยกจาก ปิดครบใบขอ ชัดเจน
- [ ] ยกเลิกไม่ถูกนับเป็น fulfillment
- [ ] จบงานแล้วไม่ถูกตีความว่า fulfillment เสมอไป
- [ ] ยอดรายเดือนใช้ fulfillment event date
- [ ] หาก event date ขาด มี `snapshot_fallback` และคำเตือน
- [ ] สมการ backlog reconcile และแสดง diff ได้
- [ ] KPI ทุกตัว drill down ถึงใบขอจริงได้
- [ ] SLA ใช้วันเริ่มตาม request kind
- [ ] Lifecycle เก็บ raw action name
- [ ] Tests ครอบคลุม 4 acceptance cases ขั้นต่ำ
- [ ] Dashboard เดิมยังใช้และ rollback ได้
- [ ] UI หน้าแรกตอบได้ว่า “วันนี้ต้องแก้อะไรก่อน”
- [ ] ไม่มี write operation ใหม่แฝงอยู่ใน dashboard API
- [ ] เอกสารและ editing map ตรงกับ code ปัจจุบัน

---

## 11. Skill ที่ต้องส่งให้ AI/Codex

### ชุดขั้นต่ำบังคับ

หากต้องส่ง Skill เพื่อให้ AI ทำงาน Request Control Tower ได้อย่างปลอดภัย ต้องมีไฟล์เหล่านี้ครบ:

```text
request-control-tower-advisor/
  SKILL.md
  references/
    01-business-context.md
    02-dashboard-metric-definitions.md
    03-request-ledger-logic.md
    04-sla-rules.md
    06-safe-implementation-rules.md
    09-editing-map.md
```

เหตุผล:

- `SKILL.md` — บอกว่าเมื่อไรต้องใช้ Skill และกติกาหลัก
- `01` — เป้าหมายและคำถามธุรกิจ
- `02` — นิยาม KPI และคำศัพท์ที่ห้ามปนกัน
- `03` — ledger, สูตร, status, request kind และ lifecycle
- `04` — SLA
- `06` — วิธีแก้ระบบอย่างปลอดภัย
- `09` — แผนที่ว่าเรื่องใดแก้ไฟล์ไหน

### ชุดแนะนำสำหรับส่งมอบเต็ม

แนะนำให้ส่งทั้งโฟลเดอร์ รวมไฟล์ต่อไปนี้ด้วย:

- `05-ui-design-rules.md` — จำเป็นเมื่องานแตะ UI/dashboard layout
- `07-cursor-prompt-patterns.md` — prompt สำหรับเริ่ม implementation
- `08-redteam-premortem-checklist.md` — review ก่อน release
- `AGENTS.md` — router ที่บังคับให้ agent อ่าน Skill
- `docs/request-control-tower/HANDBOOK.md` — ภาพรวมสำหรับคนและ AI

### รูปแบบการส่ง Skill

1. ส่งเป็นโฟลเดอร์หรือ ZIP โดยรักษาโครงสร้าง path เดิม
2. ใช้ UTF-8 และตรวจว่าภาษาไทยไม่เพี้ยน
3. มี `SKILL.md` ที่ root ของ Skill
4. Relative links ใน `SKILL.md` ต้องเปิดได้จริง
5. ระบุ version/date และ repository/branch ที่ Skill ใช้กับมัน
6. หากแก้กติกา metric ต้องส่ง references ที่เกี่ยวข้องพร้อมกัน ห้ามส่งเฉพาะ prompt
7. หากเพิ่ม code path ใหม่ ต้องอัปเดต `09-editing-map.md` ก่อนส่ง

### Context ที่ควรส่งพร้อม Skill เมื่อเริ่มงานใหม่

- เป้าหมายและผลลัพธ์ที่ต้องการในรอบนั้น
- source table/field และตัวอย่างข้อมูลที่อนุญาตให้ใช้
- นิยามช่วงวันที่และ timezone
- acceptance cases พร้อมตัวเลขที่เจ้าของงานยืนยัน
- สิ่งที่ห้ามแก้และ rollback requirement
- environment เป้าหมาย เช่น local, preview หรือ production
- error/log/screenshot ที่เกี่ยวข้อง โดยปิดข้อมูลลับก่อนส่ง

> สำหรับงานใน repository นี้ คุณไม่ต้องส่ง Skill ซ้ำทุกครั้ง หาก Skill อยู่ที่ `.Codex/skills/request-control-tower-advisor/` หรือถูกลงทะเบียนให้ session เปิดอ่านได้ เพียงระบุว่าเป็นงาน Request Control Tower ระบบจะ route ให้ใช้ Skill นี้อัตโนมัติ

---

## 12. Prompt เริ่มงานที่แนะนำ

```text
อ่าน AGENTS.md, .Codex/skills/request-control-tower-advisor/SKILL.md,
references ที่ Skill กำหนด และ docs/request-control-tower/HANDBOOK.md ก่อนแก้โค้ด

เป้าหมายรอบนี้: <ระบุผลลัพธ์>
Source/data fields: <ระบุแหล่งข้อมูล>
Acceptance cases: <ระบุตัวอย่างที่ต้องผ่าน>

ใช้ parallel calculation layer, adapter, read-only API,
backward-compatible types, feature flag, tests และ reconciliation

ห้ามลบ dashboard เดิม ห้ามเปลี่ยน SQL write behavior
และต้องแยก หาได้แล้ว / ปิดครบใบขอ / ยกเลิก / จบงานแล้ว / เหลือหา
```

---

## 13. เจ้าของเอกสารและการบำรุงรักษา

เมื่อ business rule, source mapping, SLA, UI vocabulary หรือ code structure เปลี่ยน ต้องอัปเดตใน change เดียวกัน:

1. Reference ที่เป็น source of truth
2. `references/09-editing-map.md` หากมี path ใหม่
3. Handbook ส่วนที่เกี่ยวข้อง
4. Tests/acceptance cases

เอกสารต้องอธิบายสิ่งที่ระบบทำจริง ไม่ใช่สิ่งที่ตั้งใจว่าจะทำ หากยังไม่ implement ให้ระบุว่าเป็น “ช่องว่าง” หรือ “แผนงาน” อย่างชัดเจน
