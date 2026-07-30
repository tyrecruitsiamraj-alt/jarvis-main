-- รายชื่อคนที่ต้องติดตาม (Follow) — คนกรอกเองในหน้า Follow
-- เมื่อสร้างแล้วจะถูกส่งเข้า lumos_dispatch_queue (channel='reminder') ให้ Lumos โทรตาม
-- สถานะการโทรอ่านกลับจากคิวด้วย person_ref = 'follow-<id>'

create table if not exists follow_entries (
  id uuid primary key default gen_random_uuid(),
  recipient_name text not null,
  recipient_phone text not null,
  topic text not null,
  note text null,
  scheduled_at timestamptz not null default now(),
  created_by uuid null,
  created_by_name text null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists follow_entries_created_at_idx
  on follow_entries (created_at desc);
