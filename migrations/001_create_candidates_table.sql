-- Create candidates table (phase: candidates only)
-- Run this migration manually against your PostgreSQL database.

create extension if not exists pgcrypto;

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),

  first_name text not null,
  last_name text not null,
  phone text not null,
  age integer not null check (age > 0),
  gender text not null check (gender in ('male', 'female', 'other')),

  drinking text not null default 'no' check (drinking in ('yes', 'no')),
  smoking text not null default 'no' check (smoking in ('yes', 'no')),
  tattoo text not null default 'no' check (tattoo in ('yes', 'no')),

  van_driving text not null default 'not_tested' check (van_driving in ('passed', 'failed', 'not_tested')),
  sedan_driving text not null default 'not_tested' check (sedan_driving in ('passed', 'failed', 'not_tested')),

  address text not null,
  lat double precision null,
  lng double precision null,

  application_date date not null default current_date,
  first_contact_date date null,
  first_work_date date null,

  status text not null default 'inprocess'
    check (status in ('inprocess', 'drop', 'done', 'waiting_interview', 'waiting_to_start', 'no_job')),

  responsible_recruiter text null,
  risk_percentage integer not null default 0 check (risk_percentage >= 0 and risk_percentage <= 100),

  created_at timestamptz not null default now()
);

create index if not exists candidates_status_idx on candidates (status);
create index if not exists candidates_created_at_idx on candidates (created_at desc);

