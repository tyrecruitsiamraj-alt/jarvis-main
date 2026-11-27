-- ═══ แบบฟอร์มใบสมัครหลายแบบ (เจ้าของ 27 พ.ย. 2569 · `src/lib/applyForms.ts`) ═══
-- "จะมีไปออกบูธรับสมัคร เลยอยากเพิ่มอีกฟอร์ม … ใช้แค่บาง Bu เลยคิดว่าทำให้เลือกฟอร์มได้ดีไหม"
-- ฟอร์มมาตรฐาน = ไม่มีแถว (apply_form_id null) · ฟอร์มอื่น = ฟอร์มมาตรฐาน + ช่องเสริมที่ติ๊ก
-- เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม · ประกาศ/ใบสมัครเดิมทั้งหมด = ฟอร์มมาตรฐาน
set lock_timeout = '5s';

create table if not exists apply_forms (
  id serial primary key,
  name text not null,
  -- BU ที่ใช้ได้ · ว่าง = ทุก BU
  department_codes text[] not null default '{}',
  -- ช่องเสริม: university · faculty · major · salary · position
  fields text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid null,
  created_by_name text null,
  created_at timestamptz not null default now(),
  updated_by uuid null,
  updated_by_name text null,
  updated_at timestamptz not null default now()
);
create unique index if not exists apply_forms_name_uq on apply_forms (lower(btrim(name)));

-- ฟอร์มของประกาศ (ลิงก์ที่ Gen) · null = ฟอร์มมาตรฐาน · ไม่ผูก FK — ฟอร์มที่มีลิงก์ใช้ลบไม่ได้อยู่แล้ว (เลิกใช้แทน)
alter table if exists recruit_postings add column if not exists apply_form_id int null;

-- คำตอบช่องเสริมของใบสมัคร · null = ไม่มี/ฟอร์มมาตรฐาน
alter table if exists public_job_applications add column if not exists extra_answers jsonb null;
