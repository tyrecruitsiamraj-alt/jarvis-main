-- "ประเภทประกัน" ในฟอร์มเพิ่มคนติดตาม (ขั้น 4) เป็น dropdown ที่เพิ่มเองได้จากหน้าจอ
-- (เจ้าของสั่ง 16 ต.ค. 2569: *"ประเภทประกัน ทำเป็น Dropdown ดังนี้ ขอหน้า Ui ไว้เพิ่มในอนาคตด้วย
--  ณ ตอนนี้เอาแค่นี้"* · *"ไม่เอาดึงจากเงื่อนไซด์แล้ว"*)
-- แพตเทิร์นเดียวกับ follow_topics (100): เก็บในฐาน เพิ่มได้ที่ "ตั้งค่าตัวเลือก" ของหน้าติดตาม (supervisor+)
--
-- ⚠️ ไม่ผูก CHECK ที่ hardcode ค่า — คุมที่ API จากตารางนี้ที่เดียว (บทเรียน 035/095/097)
-- ⚠️ follow_entries.insurance_type ยังเป็น text เหมือนเดิม ไม่ผูก FK — รายการเก่าที่ดึงจาก ERP
--    (บรรทัดยาวแบบใบขอ) ยังอ่านได้ ไม่กลายเป็นข้อมูลผิดกติกา

create table if not exists follow_insurance_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 100,
  created_by uuid null,
  created_by_name text null,
  created_at timestamptz not null default now()
);

comment on table follow_insurance_types is
  'ประเภทประกัน — ตัวเลือก dropdown ขั้น 4 ฟอร์มเพิ่มคนติดตาม · เพิ่มได้เฉพาะ supervisor+ ที่ ตั้งค่าตัวเลือก';

-- ชื่อห้ามซ้ำ (ไม่สนตัวพิมพ์/ช่องว่างหัวท้าย)
create unique index if not exists follow_insurance_types_name_idx
  on follow_insurance_types (lower(trim(name)));

-- ชุดตั้งต้น 4 แบบตามที่เจ้าของสั่ง · on conflict do nothing = รันซ้ำได้
insert into follow_insurance_types (name, sort_order, created_by_name)
values
  ('PA', 10, 'ชุดตั้งต้นของระบบ'),
  ('PA+PL', 20, 'ชุดตั้งต้นของระบบ'),
  ('PA+PL+ทิพยะ', 30, 'ชุดตั้งต้นของระบบ'),
  ('PA+ทิพยะ', 40, 'ชุดตั้งต้นของระบบ')
on conflict do nothing;
