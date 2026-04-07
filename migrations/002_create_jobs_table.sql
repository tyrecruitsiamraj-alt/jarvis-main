-- Create jobs table (phase: jobs only)
create extension if not exists pgcrypto;

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),

  unit_name text not null,

  request_date date not null,
  required_date date not null,

  urgency text not null default 'urgent'
    check (urgency in ('urgent', 'advance')),

  total_income integer not null default 0 check (total_income >= 0),

  location_address text not null,
  lat double precision null,
  lng double precision null,

  job_type text not null
    check (job_type in ('thai_executive', 'foreign_executive', 'central', 'valet_parking')),

  job_category text not null
    check (job_category in ('private', 'government', 'bank')),

  recruiter_id uuid null,
  recruiter_name text null,
  screener_id uuid null,
  screener_name text null,

  age_range_min integer null check (age_range_min >= 0),
  age_range_max integer null check (age_range_max >= 0),
  vehicle_required text null,
  work_schedule text null,

  penalty_per_day integer not null default 0 check (penalty_per_day >= 0),
  days_without_worker integer not null default 0 check (days_without_worker >= 0),
  total_penalty integer not null default 0 check (total_penalty >= 0),

  status text not null default 'open'
    check (status in ('open', 'in_progress', 'closed', 'cancelled')),

  closed_date date null,

  created_at timestamptz not null default now()
);

create index if not exists jobs_status_idx on jobs (status);
create index if not exists jobs_created_at_idx on jobs (created_at desc);

