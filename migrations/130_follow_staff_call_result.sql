-- 130 · ผลโทรที่เจ้าหน้าที่ลงเอง สำหรับรอบติดตามที่ตั้งให้ "คนโทร" (30 ก.ย. 2569)
--
-- 🔴 ทำไม: เจ้าของจะใช้หน้าหลักบอก *"ตอนนี้ระบบไปกี่ %"* — หน้าติดตาม คนโทรเองเท่าไหร่
-- ส่งให้ AI โทรเท่าไหร่ จากทั้งหมดเท่าไหร่ · เคาะแล้วว่านับจาก **"โทรจริง มีผลบันทึก"**
-- แต่รอบที่ตั้งเป็นคนโทร (`call_mode = 'manual'` · 121) **ไม่มีที่ลงผลเลย**:
--   · กดเบอร์ = เปิดแอปโทรของเครื่อง ไม่ทิ้งร่องรอย
--   · ปุ่มปิดงาน (`completed_at` · 095) = ปิดทั้งเรื่อง ไม่ใช่ผลของสายนั้น
-- ⇒ Choice **"เพิ่มปุ่มลงผลโทร"** — ช่องชุดนี้คือผลของสายที่คนโทร (คู่กับผลของ AI ในคิว Lumos)
--
-- ศัพท์ผลใช้ชุดเดียวกับผลที่เจ้าหน้าที่ลงในกล่องงาน (`candidate_call_holds.result_outcome`)
-- ซึ่งตรงกับ outcome ของ Lumos ⇒ ปฏิทิน/กล่องนับอ่านผลสองแหล่งด้วยคำเดียวกัน
-- ⚠️ **ไม่ใส่ CHECK** (บ้านนี้โดน CHECK ล็อกค่าใหม่มาสองรอบ — ดู 113) · ค่าที่รับได้อยู่ที่
--    `src/lib/followStaffCall.ts` (`FOLLOW_STAFF_CALL_OUTCOMES`) ตรวจที่ `api/_handlers/follow.ts`
-- ⚠️ ล้างผล = set null ทั้งชุด (ประวัติอยู่ใน audit_logs `follow.staff_call*`)
--
-- ใครใช้: api/_handlers/follow.ts (ลง/ล้าง/อ่าน) · api/_lib/homeAiShareSql.ts (หน้าหลักนับคนโทร)
-- รันตอน deploy (`npm run db:migrate`) — ห้ามรันจากเครื่อง (ฐานบนเครื่อง = production)

alter table follow_entries
  add column if not exists staff_call_outcome text,
  add column if not exists staff_call_note text,
  add column if not exists staff_called_at timestamptz,
  add column if not exists staff_called_by uuid,
  add column if not exists staff_called_by_name text;

comment on column follow_entries.staff_call_outcome is
  'ผลของสายที่เจ้าหน้าที่โทรเอง (รอบ call_mode = manual) — ศัพท์เดียวกับ candidate_call_holds.result_outcome · null = ยังไม่ได้ลงผล';
comment on column follow_entries.staff_called_at is
  'เวลาที่เจ้าหน้าที่ลงผลโทร — หน้าหลักนับ "คนโทร" จากช่องนี้ (30 ก.ย. 2569)';
