-- แยกข้อมูลใบสมัคร /apply ให้เป็นโครงสร้าง (cleansing) — เพิ่มแบบ backward compatible
-- full_name เดิมยังคงอยู่ (ใช้เป็นชื่อรวมที่ประกอบจาก prefix + first + last)
alter table if exists public_job_applications
  add column if not exists title_prefix text null,
  add column if not exists first_name text null,
  add column if not exists last_name text null,
  add column if not exists age integer null,
  add column if not exists gender text null,
  add column if not exists province text null,
  add column if not exists district text null,
  add column if not exists subdistrict text null,
  add column if not exists postal_code text null;

alter table if exists public_job_applications
  drop constraint if exists public_job_applications_age_check;
alter table if exists public_job_applications
  add constraint public_job_applications_age_check
  check (age is null or (age >= 15 and age <= 80));

alter table if exists public_job_applications
  drop constraint if exists public_job_applications_gender_check;
alter table if exists public_job_applications
  add constraint public_job_applications_gender_check
  check (gender is null or gender in ('male', 'female', 'other'));

create index if not exists public_job_applications_province_idx
  on public_job_applications (province);
