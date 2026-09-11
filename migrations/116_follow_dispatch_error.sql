-- เหตุผลที่ดันรายการติดตามไปหา Lumos ไม่สำเร็จ (11 ก.ย. 2569)
--
-- 🔴 ทำไมต้องมี: `dispatch_state = 'push_failed'` (เพิ่ม 10 ก.ย.) บอกได้แค่ว่า **ล้ม**
-- แต่ไม่บอกว่า **ล้มเพราะอะไร** ⇒ ต้องไปไล่ log บนเซิร์ฟเวอร์ทุกครั้ง
-- วัดจริง 11 ก.ย. 2569: 12 จาก 42 รายการของวันนั้นเป็น push_failed ทั้งหมด ไม่ได้ผลสักสาย
-- และไม่มีใครบนจอรู้เลยว่าเกิดอะไรขึ้น
--
-- เก็บเฉพาะ **ข้อความสั้น** ที่ Lumos ตอบกลับ (ตัดที่ 300 ตัวอักษรตอนเขียน)
-- ⚠️ ห้ามเก็บ payload/รหัสผ่าน/คีย์ — คอลัมน์นี้ถูกส่งออกไปให้จอผู้ใช้เห็น
--
-- ใครใช้: api/_lib/lumosDispatch.ts (เขียน) · api/_handlers/follow.ts (อ่าน/ส่งต่อ)
--        · src/components/follow/FollowPlanningCalendar.tsx (แสดง)

alter table follow_entries
  add column if not exists dispatch_error text;

comment on column follow_entries.dispatch_error is
  'ข้อความสั้นบอกเหตุที่ push ไป Lumos ไม่สำเร็จ (คู่กับ dispatch_state = ''push_failed'') · '
  'null = ไม่เคยล้ม หรือส่งซ้ำสำเร็จแล้ว · ห้ามเก็บ payload/คีย์';
