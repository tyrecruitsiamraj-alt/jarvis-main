# แผนงานต่อ (อัปเดต 10 ส.ค. 2569)

**วิธีทำงาน (เจ้าของสั่งไว้แล้ว):** ทำทีละข้อ → ตรวจ → commit → push → ข้อถัดไป
ไม่ต้องรอถามระหว่างทาง

อ่านก่อนเริ่ม: `docs/SESSION-HANDOFF.md` (กติกา 13 ข้อ + กับดักตอนตรวจงาน +
คำตัดสินเจ้าของ) และ `.claude/skills/request-control-tower-advisor/references/09-editing-map.md`

**Baseline (10 ส.ค. หลังเทสต์ `callBatchStore`):** test 711 ผ่าน/4 skip (90 ไฟล์) ·
**tsc ต้องเป็น 0 ทั้งสาม config** (app · default · api) ·
eslint 0 error/16 warning · migration ถึง 073

---

## งานที่ทำได้เลย (เรียงตามที่ควรทำก่อน)

### 1. ช่องว่างเทสต์ที่เหลือ (เกณฑ์: "พังแล้วเงียบ" / "ผิดแล้วข้อมูลรั่ว" ก่อน)

| ตัว | ทำไมสำคัญ |
|---|---|
| ~~`callBatchStore.ts`~~ | ✅ เสร็จ 10 ส.ค. — `tests/api/callBatchStore.test.ts` 22 เคส (mutation 12/12) |
| `authSession.ts` | ออก session หลัง SSO ผ่าน |
| `roleFunctionGrants.ts` | สิทธิ์รายฟังก์ชัน |
| `magicLinkLogin.ts` | ทางเข้าอีกทาง |

### 2. ดึงเคสให้เจ้าของไปถามคนเก่ง (เมื่อเจ้าของขอ)

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
