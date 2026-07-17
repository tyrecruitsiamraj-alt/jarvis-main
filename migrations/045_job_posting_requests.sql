-- คำขอโพสหางานใหม่ (สร้าง ID ไว้ให้ทีมอื่นเอาไปทำคอนเทนต์/โพสหาคน)
-- ใช้เมื่อใบขอไม่มีคนของเราตรง หรือคนที่มีไม่โอเค
create table if not exists job_posting_requests (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  request_no text null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'posted', 'filled', 'cancelled')),
  reason text null,
  notes text null,
  requested_by_user_id uuid null,
  requested_by_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_posting_requests_job_id_idx
  on job_posting_requests (job_id);

create index if not exists job_posting_requests_status_idx
  on job_posting_requests (status);

create index if not exists job_posting_requests_created_at_idx
  on job_posting_requests (created_at desc);

-- กันสร้างคำขอซ้ำที่ยัง active ต่อใบขอเดียวกัน (pending/in_progress/posted ถือว่า active)
create unique index if not exists job_posting_requests_active_job_idx
  on job_posting_requests (job_id)
  where status in ('pending', 'in_progress', 'posted');
