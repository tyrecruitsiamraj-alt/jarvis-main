-- Roster names for recruiter/screener dropdowns + picker exclusions (mirrors demo localStorage)

create table if not exists job_staff_roster (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('recruiter', 'screener')),
  display_name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists job_staff_roster_role_name_norm_idx
  on job_staff_roster (role, lower(trim(display_name)));

create table if not exists job_staff_picker_excluded (
  role text not null check (role in ('recruiter', 'screener')),
  name_norm text not null,
  created_at timestamptz not null default now(),
  primary key (role, name_norm)
);
