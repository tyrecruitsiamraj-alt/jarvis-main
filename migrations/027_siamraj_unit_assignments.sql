-- ผู้รับผิดชอบใบขอ Siamraj (เจ้าหน้าที่สรรหา / เจ้าหน้าที่คัดสรร)
-- ใบขอ Siamraj อ่านอย่างเดียวจาก MSSQL จึงเก็บผู้รับผิดชอบแยกใน PostgreSQL ผูกด้วย request_no

create table if not exists siamraj_unit_assignments (
  request_no text primary key,
  recruiter_name text null,
  screener_name text null,
  updated_by_user_id uuid null,
  updated_at timestamptz not null default now()
);

create index if not exists siamraj_unit_assignments_updated_at_idx
  on siamraj_unit_assignments (updated_at desc);
