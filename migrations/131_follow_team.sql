-- ═══ ทีมของรายการติดตาม (1 ต.ค. 2569) ═══
--
-- เจ้าของ: "หน้า ติดตามส่งคนแทน ต้องทำเหมือน รายชื่อติดตามไง มันทำงานเหมือนกันแค่คนละทีม"
--         "หน้า รายชื่อติดตาม และ ติดตามส่งคนแทน ต้องเหมือนกันนะ"
--
-- สองแท็บของหน้าการติดตามใช้ฟอร์ม/เรื่อง/ปฏิทินชุดเดียวกันทุกอย่าง ⇒ แยกกองด้วย "ทีม" ไม่ใช่ด้วยเรื่อง
--   null          = ทีมติดตาม (แท็บ รายชื่อติดตาม · ของเดิมทุกแถว)
--   'replacement' = ทีมส่งคนแทน (แท็บ ติดตามส่งคนแทน)
-- 🔴 ตรวจค่าที่ API (`parseFollowInput`) แทน CHECK constraint — บ้านนี้โดน CHECK ล็อกมาสองรอบ
alter table follow_entries
  add column if not exists follow_team text;

create index if not exists follow_entries_follow_team_idx
  on follow_entries (follow_team)
  where follow_team is not null;

comment on column follow_entries.follow_team is
  'ทีมของรายการ — null = ทีมติดตาม (แท็บรายชื่อติดตาม) · replacement = ทีมส่งคนแทน (แท็บติดตามส่งคนแทน) · 1 ต.ค. 2569';
