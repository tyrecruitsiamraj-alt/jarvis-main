create table if not exists candidate_interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  interview_date date not null,
  location text not null default '',
  client_name text not null default '',
  attended boolean not null default false,
  result text null check (result is null or result in ('passed', 'failed', 'pending')),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists candidate_interviews_cand_idx on candidate_interviews (candidate_id, interview_date desc);
