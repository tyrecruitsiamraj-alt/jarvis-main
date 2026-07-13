-- สถานะทำงานของใบขอ (Jarvis PG แยกจาก Siamraj) ผูกด้วย request_no
-- ใช้ติดตาม pipeline: ดำเนินการ / รอแจ้งเข้า / รอสัมภาษณ์ / รอเริ่มงาน

create table if not exists siamraj_unit_work_status (
  request_no text primary key,
  status text not null
    check (status in ('in_progress', 'waiting_inform', 'waiting_interview', 'waiting_start')),
  person_first_name text null,
  person_last_name text null,
  status_date date null,
  updated_by_user_id uuid null,
  updated_at timestamptz not null default now()
);

create index if not exists siamraj_unit_work_status_status_idx
  on siamraj_unit_work_status (status);

create index if not exists siamraj_unit_work_status_updated_at_idx
  on siamraj_unit_work_status (updated_at desc);
