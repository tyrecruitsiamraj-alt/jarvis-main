-- ใบสมัครงานจากหน้า /apply (public — ไม่ต้องล็อกอิน)
-- แทนการส่งผู้สมัครออกไปลิงก์ SOWORK ภายนอก: กรอกในระบบแล้วบันทึกที่นี่
create table if not exists public_job_applications (
  id uuid primary key default gen_random_uuid(),

  full_name text not null,
  phone text not null,

  -- snapshot ของงานที่กดสมัคร (nullable — สมัครแบบไม่ระบุงานได้จากปุ่มท้ายหน้า)
  job_id text null,
  job_title text null,
  unit_name text null,

  position_interest text null,
  note text null,

  source text not null default 'apply_page',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'rejected')),
  admin_note text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_job_applications_created_at_idx
  on public_job_applications (created_at desc);

create index if not exists public_job_applications_status_idx
  on public_job_applications (status);

create index if not exists public_job_applications_phone_idx
  on public_job_applications (phone);
