-- ═══ ประเภทกล่องลอย (ประกาศที่ไม่ผูกใบขอ) แก้จากหน้าเว็บได้ (14 ต.ค. 2569) ═══
--
-- เจ้าของ: "ถ้าจะเพิ่มข้อมูลตรง ประเภทกล่อง เพิ่มยังไงผ่านหน้า ui" → "ทำหน้าจัดการประเภทกล่องในตั้งค่าบอร์ด"
-- เดิม 5 ประเภทเขียนตายในโค้ด (`STANDALONE_POSTING_KINDS`) · recruit_postings.standalone_kind ไม่มี CHECK อยู่แล้ว (063)
-- ปิดใช้งานแทนการลบ — ประกาศเก่าอ้างรหัสอยู่ · รหัสห้ามเปลี่ยน แก้ได้แค่ชื่อ

create table if not exists recruit_posting_kinds (
  code text primary key,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_name text null
);

insert into recruit_posting_kinds (code, label, sort_order) values
  ('thai_executive', 'ผู้บริหารคนไทย', 10),
  ('foreign_executive', 'ผู้บริหารต่างชาติ', 20),
  ('central', 'ส่วนกลาง', 30),
  ('valet', 'Valet parking', 40),
  ('government', 'ราชการ', 50)
on conflict (code) do nothing;

comment on table recruit_posting_kinds is
  'ประเภทกล่องลอย (144 · 14 ต.ค. 2569) — แก้จากตั้งค่าบอร์ด · ปิดแทนลบ · รหัสห้ามเปลี่ยน';
