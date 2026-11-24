-- ═══ เหตุผลยกเลิกใบขอ (เจ้าของ 24 พ.ย. 2569) ═══
-- ใบขอที่ ERP หยุด/ยกเลิก บางใบจริง ๆ ได้คนแล้ว (เลือกจาก WL · เลือกจากพนักงานในไซต์) แต่ทุกหน้านับเป็น "ยกเลิก" ก้อนเดียว
-- เจ้าของเคาะ: สมการคงเดิม (ยังนับในยกเลิก) · กดเลขยกเลิกแล้วแยก ได้คนแล้ว / ยกเลิกจริง / ไม่ได้กรอกเหตุผล
--   · รายการเหตุผลกลาง Admin แก้ · ทุกคนใส่เหตุผลบนใบได้ · ใส่ได้เฉพาะใบที่ ERP ไม่มีเหตุผล หรือเป็น "ยกเลิกโดย-สยามราช"
-- เพิ่มอย่างเดียว ไม่แตะตารางเดิม · ไม่เขียนกลับ ERP

-- รายการเหตุผลกลาง · erp_code = ข้อที่มาจาก st_ms_stop_by ของ ERP (null = ทีมเพิ่มเอง) · ลบไม่ได้ เลิกใช้ได้
create table if not exists request_cancel_reasons (
  id serial primary key,
  label text not null,
  got_person boolean not null default false,
  erp_code text null unique,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_by uuid null,
  created_by_name text null,
  created_at timestamptz not null default now(),
  updated_by uuid null,
  updated_by_name text null,
  updated_at timestamptz not null default now()
);
create unique index if not exists request_cancel_reasons_label_uq on request_cancel_reasons (lower(btrim(label)));

-- ค่าตั้งต้น = 11 ข้อของ ERP (อ่าน st_ms_stop_by 24 พ.ย. 2569) · ติ๊ก "ได้คนแล้ว" 4 ข้อตามที่เจ้าของเห็นในแผน
insert into request_cancel_reasons (label, got_person, erp_code, sort_order) values
  ('หน่วยงานไม่เอาคนแทน', false, '01', 10),
  ('จัดส่งคนแทนไม่ได้', false, '02', 20),
  ('ไม่จัดส่งคนแทน', false, '03', 30),
  ('เวียนกำลังคนในไซต์', true, '04', 40),
  ('ไม่สามารถจัดส่งพนักงานได้', false, '10', 50),
  ('ลูกค้ายกเลิก(ไม่เอาคนแล้ว)', false, '11', 60),
  ('เลือกจาก WL', true, '12', 70),
  ('จัดส่งพนักงาน Head hunter ได้แล้ว', true, '13', 80),
  ('งานรายวัน', false, '14', 90),
  ('เลือกจาก พนง.Site', true, '15', 100),
  ('ยกเลิกโดย-สยามราช', false, '16', 110)
on conflict do nothing;

-- เหตุผลที่ทีมใส่บนใบ · 1 ใบ = 1 เหตุผล (ใส่ใหม่ = แทนของเดิม · ประวัติทุกครั้งอยู่ audit_logs ว่าใครเปลี่ยนจากอะไรเป็นอะไร)
-- request_no = เลขที่ใบขอดิบของ ERP (ตัวเดียวกับ siamraj_unit_notes) · ไม่ผูก FK ไปตาราง users (ลบบัญชีได้จริง) เก็บชื่อไว้ข้างรหัส
create table if not exists request_cancel_reason_tags (
  request_no text primary key,
  reason_id int not null references request_cancel_reasons (id) on delete restrict,
  set_by uuid null,
  set_by_name text null,
  set_at timestamptz not null default now()
);
