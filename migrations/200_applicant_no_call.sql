-- ═══ ปุ่ม "ไม่โทร" + เหตุผล (เจ้าของ 26 พ.ย. 2569) ═══
-- "ก่อนเก็บไปหน้าติดต่อ … เอาเป็นปุ่มคำว่าไม่โทรแล้วกัน แล้วเดี๋ยวพอเลือกเหตุผลจะได้โยนเข้ากล่องนั้นๆไป" · Choice "ตรง ทำเลย"
-- กดไม่โทร = เลือกเหตุผล 1 ข้อ → ใบย้ายไปกล่องของเหตุผลนั้น · AI ไม่โทร · ยกเลิกได้ (กลับกล่องเดิม)
-- เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
set lock_timeout = '5s';

-- รายการเหตุผล · box = กล่องที่ใบไปอยู่: 'own' = กล่องของเหตุผลนั้นเอง · bad_data/over_age/employed = กล่องที่มีอยู่แล้ว
-- ลบไม่ได้ เลิกใช้ได้ (ใบเก่าที่อ้างยังอ่านชื่อออก)
create table if not exists applicant_no_call_reasons (
  id serial primary key,
  label text not null,
  box text not null default 'own' check (box in ('own', 'bad_data', 'over_age', 'employed')),
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_by uuid null,
  created_by_name text null,
  created_at timestamptz not null default now(),
  updated_by uuid null,
  updated_by_name text null,
  updated_at timestamptz not null default now()
);
create unique index if not exists applicant_no_call_reasons_label_uq on applicant_no_call_reasons (lower(btrim(label)));

-- 6 ข้อตามที่เจ้าของพิมพ์ (26 พ.ย. 2569) · ทุกข้อได้กล่องของตัวเอง
insert into applicant_no_call_reasons (label, box, sort_order) values
  ('ไม่มีงานในจังหวัดนั้นๆ', 'own', 10),
  ('เพศไม่ตรง', 'own', 20),
  ('ใบขับขี่ชั่วคราว', 'own', 30),
  ('อายุน้อย/มาก', 'own', 40),
  ('BL', 'own', 50),
  ('ต่างด้าว', 'own', 60)
on conflict do nothing;

-- ใบที่กดไม่โทร · null = ไม่ได้กด · ไม่ผูก FK ไปตาราง users (ลบบัญชีได้จริง) เก็บชื่อไว้
alter table if exists public_job_applications add column if not exists no_call_reason_id int null;
alter table if exists public_job_applications add column if not exists no_call_at timestamptz null;
alter table if exists public_job_applications add column if not exists no_call_by_name text null;
