-- ใครโทรรอบนี้ — AI หรือเจ้าหน้าที่ (20 ก.ย. 2569)
--
-- 🔴 ทำไม: เจ้าของสั่ง *"ฉันต้องการให้ลงคิวยาว ๆ ได้ เช่น บอกว่าจะลงตั้งแต่ 1-7
-- วันที่ 1-3 กำหนดเองอะนะว่าจะโทรเองหรือส่ง lumos โทร และต้องวางแพลนยาวได้"*
--
-- ของเดิมมีแค่สองทาง: ติ๊กวัน = ส่งให้ AI · ไม่ติ๊ก = **ไม่มีอะไรเลย**
-- วันที่ตั้งใจจะโทรเองจึงไม่เหลือร่องรอยในระบบ ⇒ ไม่มีใครรู้ว่าวันนั้นมีงานค้างอยู่
-- ตอนนี้วันที่โทรเองก็เป็นแถวจริงในตาราง มีคนรับผิดชอบ และนับรวมในยอดได้
--
-- ⚠️ ห้ามใช้ CHECK constraint กับคอลัมน์นี้ (บ้านนี้โดน CHECK ล็อกมาสองรอบ —
-- ดู migration 113) ค่าที่รับได้ตรวจที่ api/_handlers/follow.ts แทน
--
-- ใครใช้: api/_handlers/follow.ts (สร้าง/อ่าน) · src/pages/follow/FollowPage.tsx (เลือกรายวัน)

alter table follow_entries
  add column if not exists call_mode text not null default 'ai';

comment on column follow_entries.call_mode is
  'ใครโทรรอบนี้ — ai = ส่งเข้าคิวให้ Lumos (ค่าเริ่มต้น เท่ากับพฤติกรรมเดิมทุกแถว) · manual = เจ้าหน้าที่โทรเอง ไม่ส่งเข้าคิว';

-- แถวที่โทรเอง ไม่เคยเข้าคิว ⇒ หน้าจอต้องหาเจอเร็วเวลาไล่ว่า "วันนี้ใครต้องโทรเองบ้าง"
create index if not exists idx_follow_entries_call_mode_scheduled
  on follow_entries (call_mode, scheduled_at)
  where call_mode <> 'ai';
