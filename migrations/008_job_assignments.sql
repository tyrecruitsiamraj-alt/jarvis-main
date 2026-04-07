-- Assignments of candidates to jobs (persisted when not in demo mode)

create table if not exists job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null,
  candidate_name text not null,
  assignment_type text not null
    check (assignment_type in ('start', 'replacement', 'trial')),
  start_date date not null,
  end_date date null,
  status text not null
    check (status in ('sent', 'passed', 'failed', 'started', 'cancelled')),
  trial_days integer not null default 0 check (trial_days >= 0),
  created_at timestamptz not null default now()
);

create index if not exists job_assignments_job_id_idx on job_assignments (job_id desc);
create index if not exists job_assignments_created_at_idx on job_assignments (created_at desc);
