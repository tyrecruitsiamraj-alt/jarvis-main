-- ═══ ดูแลหลังเริ่มงาน: กดโทรแล้วลงผลบนหน้าเดียว (เจ้าของ 10 ต.ค. 2569) ═══
-- > "ดูแลหลังเริ่มงานทำคล้ายๆกับหน้าแท็บ การติดต่ออะ หมายถึงกดโทรแล้วใส่ผลใส่อะไรต่างๆได้"
-- Choice เจ้าของ: ผล 4 แบบ ทำงานปกติ · มีปัญหา · ลาออก · ติดต่อไม่ได้ + หมายเหตุ · เก็บประวัติทุกครั้ง
--
-- คีย์ = เบอร์ E.164 (ตัวเดียวกับ aftercare_people · 107) · ไม่ผูก FK เพื่อให้ประวัติอยู่ต่อแม้ลบ/ย้ายคน
-- ⚠️ เป็นแค่บันทึกผลการโทร — ไม่ปิดการดูแลเอง (ลาออก ≠ ปิดอัตโนมัติ · คนกด "ปิดการดูแล" เอง)

create table if not exists aftercare_contacts (
  id bigserial primary key,
  phone_e164 text not null,
  result text not null,
  note text null,
  created_by uuid null,
  created_by_name text null,
  created_at timestamptz not null default now()
);

alter table aftercare_contacts drop constraint if exists aftercare_contacts_result_check;
alter table aftercare_contacts
  add constraint aftercare_contacts_result_check check (result in ('working', 'issue', 'resigned', 'unreachable'));

create index if not exists aftercare_contacts_phone_idx on aftercare_contacts (phone_e164, created_at desc);

comment on table aftercare_contacts is
  'ผลการโทรดูแลหลังเริ่มงาน (ทำงานปกติ/มีปัญหา/ลาออก/ติดต่อไม่ได้ + หมายเหตุ) — 10 ต.ค. 2569';
