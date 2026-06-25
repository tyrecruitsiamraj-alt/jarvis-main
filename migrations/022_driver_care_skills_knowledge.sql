-- Driver Care: skills & knowledge base (พฤติกรรมก่อนลาออก, แนวทางติดตาม)
create extension if not exists pgcrypto;

create table if not exists driver_care_skill (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'intervention',
  description text not null default '',
  file_url text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_care_skill_category_idx on driver_care_skill (category);
create index if not exists driver_care_skill_active_idx on driver_care_skill (is_active);

create table if not exists driver_care_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'pre_resign_behavior',
  summary text null,
  content text not null default '',
  file_url text null,
  file_name text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_care_knowledge_category_idx on driver_care_knowledge (category);
create index if not exists driver_care_knowledge_active_idx on driver_care_knowledge (is_active);
