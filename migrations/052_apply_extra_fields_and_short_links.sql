-- /apply form: extra applicant fields, one document attachment (stored in bytea),
-- and short links for the "Gen Link" button on the staff job board.

alter table if exists public_job_applications
  add column if not exists weight_kg numeric(5,1) null,
  add column if not exists height_cm numeric(5,1) null,
  add column if not exists education text null,
  add column if not exists referral_source text null,
  add column if not exists document_filename text null,
  add column if not exists document_mime text null,
  add column if not exists document_size integer null,
  add column if not exists document_bytes bytea null;

alter table if exists public_job_applications
  drop constraint if exists public_job_applications_referral_source_check;
alter table if exists public_job_applications
  add constraint public_job_applications_referral_source_check
  check (referral_source is null or referral_source in ('facebook', 'tiktok', 'instagram', 'flyer', 'other'));

alter table if exists public_job_applications
  drop constraint if exists public_job_applications_weight_check;
alter table if exists public_job_applications
  add constraint public_job_applications_weight_check
  check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 400));

alter table if exists public_job_applications
  drop constraint if exists public_job_applications_height_check;
alter table if exists public_job_applications
  add constraint public_job_applications_height_check
  check (height_cm is null or (height_cm >= 80 and height_cm <= 260));

-- Short links: code → target path (public /apply deep links). One row per target.
create table if not exists short_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  target_path text not null,
  created_by uuid null,
  hit_count integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists short_links_target_path_idx on short_links (target_path);
