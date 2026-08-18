-- "เรื่องที่จะให้โทรติดตาม" เป็น dropdown ที่แก้เองได้ (เจ้าของสั่ง 18 ส.ค. 2569:
-- *"Dropdown เลือกเรื่องที่จะให้โทรติดตาม เช่น ติดตามเริ่มงาน เรียนงาน เบิกเบี้ยเลี้ยง"*
-- และเลือกให้ **เก็บในฐาน แก้เองได้** ไม่ต้องรอ deploy)
--
-- ⚠️ ไม่ผูก CHECK ที่ hardcode ค่า — คุมที่ API จากตารางนี้ที่เดียว
-- (บทเรียน 035/095/097: ค่าตายตัวในฐานคือกับดักตอนเพิ่มค่าใหม่ · insert ตกเงียบ/500)
--
-- ⚠️ **ช่อง topic ของ follow_entries ยังเป็น text อิสระเหมือนเดิม ไม่ผูก FK**
-- เหตุผล: เจ้าของยังต้องพิมพ์เรื่องใหม่เองได้ตอนเจอเคสที่ไม่มีในลิสต์ · และรายการเก่า
-- 65 แถวที่มีอยู่แล้วใช้ข้อความอิสระ ผูก FK เมื่อไหร่ของเก่ากลายเป็นข้อมูลผิดกติกาทันที
-- ตารางนี้คือ "ตัวช่วยกรอก" ไม่ใช่ "ตัวบังคับค่า"

create table if not exists follow_topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 100,
  created_by uuid null,
  created_by_name text null,
  created_at timestamptz not null default now()
);

comment on table follow_topics is
  'เรื่องที่จะให้ AI โทรติดตาม — ตัวเลือกใน dropdown หน้า Follow · เพิ่มได้เฉพาะ supervisor+ · ไม่ใช่ค่าบังคับ (ยังพิมพ์เองได้)';

-- ชื่อห้ามซ้ำ (ไม่สนตัวพิมพ์/ช่องว่างหัวท้าย) — คีย์ซ้ำแล้ว dropdown มีสองบรรทัดเหมือนกัน
create unique index if not exists follow_topics_name_idx
  on follow_topics (lower(trim(name)));

-- ชุดตั้งต้น 3 เรื่องตามที่เจ้าของยกตัวอย่างมา · on conflict do nothing = รันซ้ำได้
insert into follow_topics (name, sort_order, created_by_name)
values
  ('ติดตามเริ่มงาน', 10, 'ชุดตั้งต้นของระบบ'),
  ('ติดตามเรียนงาน', 20, 'ชุดตั้งต้นของระบบ'),
  ('ติดตามเบิกเบี้ยเลี้ยง', 30, 'ชุดตั้งต้นของระบบ')
on conflict do nothing;
