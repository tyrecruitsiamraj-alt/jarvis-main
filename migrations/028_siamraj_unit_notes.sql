-- หมายเหตุรายการใบขอ Siamraj (เก็บใน PostgreSQL ผูกด้วย request_no)
create table if not exists siamraj_unit_notes (
  request_no text primary key,
  note text null,
  updated_by_user_id uuid null,
  updated_at timestamptz not null default now()
);

create index if not exists siamraj_unit_notes_updated_at_idx
  on siamraj_unit_notes (updated_at desc);
