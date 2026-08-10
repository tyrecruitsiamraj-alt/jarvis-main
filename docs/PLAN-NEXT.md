# แผนงานต่อ (อัปเดต 10 ส.ค. 2569)

**วิธีทำงาน (เจ้าของสั่งไว้แล้ว):** ทำทีละข้อ → ตรวจ → commit → push → ข้อถัดไป
ไม่ต้องรอถามระหว่างทาง

อ่านก่อนเริ่ม: `docs/SESSION-HANDOFF.md` (กติกา 13 ข้อ + กับดักตอนตรวจงาน +
คำตัดสินเจ้าของ) และ `.claude/skills/request-control-tower-advisor/references/09-editing-map.md`

**Baseline ณ commit `bc43dca`:** test 686 ผ่าน/4 skip (88 ไฟล์) · tsc app + default
0 error · **tsc api (`tsconfig.api.json`) เหลือ 25 error — ห้ามทำให้เพิ่ม** ·
eslint 0 error/16 warning · migration ถึง 073

---

## งานที่ทำได้เลย (เรียงตามที่ควรทำก่อน)

### 1. กวาด type error 25 จุดใน api/ (มีชิปวางไว้แล้วจาก session 10 ส.ค.)

`npx tsc --noEmit -p tsconfig.api.json` — ส่วนใหญ่ null-safety:
driverCareActionValidation (9) · job-staff (4) · role-permissions (2) ·
siamrajUnitRequests (2) · lumos-dispatch (2) · ที่เหลือไฟล์ละ 1
แก้แบบ narrowing/guard ไม่ใช้ `!`/`as` มั่ว · เจอบั๊กจริงให้บันทึกใน commit
เสร็จแล้ว: อัปเดต §0 + กติกาข้อ 2 ใน SESSION-HANDOFF ว่า config นี้ต้องเป็น 0

### 2. ช่องว่างเทสต์ที่เหลือ (เกณฑ์: "พังแล้วเงียบ" / "ผิดแล้วข้อมูลรั่ว" ก่อน)

| ตัว | ทำไมสำคัญ |
|---|---|
| `callBatchStore.ts` (284 บรรทัด) | ตัวสร้าง/อนุมัติ/ปล่อยชุดโทรจริง — claim-then-work กัน race |
| `authSession.ts` | ออก session หลัง SSO ผ่าน |
| `roleFunctionGrants.ts` | สิทธิ์รายฟังก์ชัน |
| `magicLinkLogin.ts` | ทางเข้าอีกทาง |

### 3. ดึงเคสให้เจ้าของไปถามคนเก่ง (เมื่อเจ้าของขอ)

เจ้าของพูด "ขอเคสสำหรับ [ชื่อ skill]" → ดึงจากระบบจริง — วิธีอยู่
`docs/HOW-TO-COLLECT-CASES.md` (job-request-to-spec 15 ใบคละแบบ ·
pick-from-applicants ใบที่มีผู้สมัครหลายคน+ผลจริง · pick-from-pool ใบที่ AI
หาไม่เจอ · followup-manager dashboard ย้อนหลัง 5 วัน)

---

## ต้องถามเจ้าของก่อน (ห้ามเดาแทน)

| เรื่อง | สถานะ |
|---|---|
| hard delete `DELETE /api/candidate-interviews` | ทางลบถาวรทางเดียวที่เหลือ — ต้อง migration + ตกลง visibility |
| ชุดรออนุมัติค้าง 3 ชุด | รอเจ้าของกดที่หน้างานโทร (ชื่อคนแก้ถูกแล้วใน `bc43dca`) |
| เปิดหน้างานโทรให้ supervisor | จุดคุมการซ่อน 4 ที่ — จำเป็นต่อการให้ supervisor อนุมัติชุด |
| แผงสีม่วง/น้ำเงิน MatchingPage ~40 จุด | ยังไม่ตกลง |
| โคลนคนเก่งให้แม่นขึ้น | ต้องให้เจ้าของเลือกคน + เวลา 1 ชม./คน |

## ที่เคาะแล้ว — ดูตาราง §4 ใน `docs/SESSION-HANDOFF.md` (อย่าถามซ้ำ)
