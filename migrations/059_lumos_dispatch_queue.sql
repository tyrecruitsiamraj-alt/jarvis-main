-- คิวส่งข้อมูลให้ Lumos (outbound dispatch)
--   reminder  = คนของเราที่ AI match กับใบขอแล้ว → Lumos โทรตาม/แจ้งงาน
--   interview = ผู้สมัครจากการกดค้นหา iRecruit → Lumos AI โทรสัมภาษณ์
-- Lumos ดึงผ่าน GET (สถานะ pending → delivered) แล้วส่งผลกลับผ่าน POST results (→ completed/failed/cancelled)

create table if not exists lumos_dispatch_queue (
  id bigserial primary key,
  channel text not null check (channel in ('reminder', 'interview')),
  job_ref text not null,
  person_ref text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'completed', 'failed', 'cancelled')),
  result jsonb null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (channel, job_ref, person_ref)
);

create index if not exists lumos_dispatch_queue_channel_status_idx
  on lumos_dispatch_queue (channel, status, created_at);
