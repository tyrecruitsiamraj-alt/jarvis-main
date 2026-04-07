create table if not exists candidate_work_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  client_name text not null,
  work_type text not null check (work_type in ('replacement', 'start')),
  start_date date not null,
  end_date date null,
  status text not null check (status in ('completed', 'ongoing', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists candidate_work_history_cand_idx on candidate_work_history (candidate_id, start_date desc);
