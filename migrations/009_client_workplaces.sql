create table if not exists client_workplaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  lat double precision null,
  lng double precision null,
  contact_person text null,
  contact_phone text null,
  default_income integer not null default 0 check (default_income >= 0),
  default_cost integer not null default 0 check (default_cost >= 0),
  default_shift text not null default '08:00-17:00',
  job_type text not null
    check (job_type in ('thai_executive', 'foreign_executive', 'central', 'valet_parking')),
  job_category text not null
    check (job_category in ('private', 'government', 'bank')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists client_workplaces_active_idx on client_workplaces (is_active) where is_active = true;
