-- Create employees table (phase: employees only)
create extension if not exists pgcrypto;

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),

  employee_code text not null unique,

  first_name text not null,
  last_name text not null,
  nickname text null,
  phone text not null,

  status text not null default 'active'
    check (status in ('active', 'inactive', 'suspended')),

  position text not null,
  join_date date not null,

  address text null,
  lat double precision null,
  lng double precision null,

  reliability_score integer not null default 0 check (reliability_score >= 0 and reliability_score <= 100),
  utilization_rate integer not null default 0 check (utilization_rate >= 0 and utilization_rate <= 100),
  total_days_worked integer not null default 0,
  total_income integer not null default 0,
  total_cost integer not null default 0,
  total_issues integer not null default 0,

  avatar_url text null,

  created_at timestamptz not null default now()
);

create index if not exists employees_status_idx on employees (status);
create index if not exists employees_created_at_idx on employees (created_at desc);

