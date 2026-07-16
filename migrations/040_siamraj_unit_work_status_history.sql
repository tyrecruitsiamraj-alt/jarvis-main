-- ประวัติการแก้สถานะทำงานใบขอ (เก็บอย่างเดียว ไม่โชว์ใน UI)

create table if not exists siamraj_unit_work_status_history (
  id bigserial primary key,
  request_no text not null,
  status text not null,
  person_first_name text null,
  person_last_name text null,
  status_date date null,
  previous_status text null,
  previous_person_first_name text null,
  previous_person_last_name text null,
  previous_status_date date null,
  updated_by_user_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists siamraj_unit_work_status_history_request_no_idx
  on siamraj_unit_work_status_history (request_no, created_at desc);

create index if not exists siamraj_unit_work_status_history_created_at_idx
  on siamraj_unit_work_status_history (created_at desc);
