-- การเสนอ/จองตัว/ลงงานผู้สมัคร (board/iRecruit) ต่อใบขอกำลังคน
-- เก็บ: เสนอโดยใคร / ให้ใบขอไหน / เหตุผล / วันที่ / สถานะ
create table if not exists candidate_proposals (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  request_no text null,
  source text not null check (source in ('board', 'irecruit')),
  candidate_ref text not null,
  candidate_name text null,
  candidate_phone text null,
  candidate_position text null,
  tier text null check (tier is null or tier in ('green', 'yellow', 'red')),
  reason text null,
  status text not null default 'reserved'
    check (status in ('proposed', 'reserved', 'contacted', 'placed', 'rejected', 'cancelled')),
  proposed_by_user_id uuid null,
  proposed_by_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, source, candidate_ref)
);

create index if not exists candidate_proposals_job_id_idx
  on candidate_proposals (job_id);

create index if not exists candidate_proposals_status_idx
  on candidate_proposals (status);

create index if not exists candidate_proposals_created_at_idx
  on candidate_proposals (created_at desc);
