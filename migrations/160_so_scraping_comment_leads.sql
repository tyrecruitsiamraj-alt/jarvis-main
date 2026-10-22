-- ═══ So Scraping ส่งคนที่คอมเมนต์ใต้โพสต์รับสมัครงานเข้า Jarvis (เจ้าของ 22 ต.ค. 2569) ═══
-- POST /api/integrations/so-scraping/leads · /ai-call — ยืนยันตัวด้วย x-api-key (เก็บแค่ค่าแฮช)
-- คอมเมนต์ที่มีเบอร์ = ใบสมัครใน public_job_applications (Journey เดียวกับเจ้าหน้าที่เพิ่มเอง) · ไม่มีเบอร์ = เก็บเฉย ๆ

-- ① key ของระบบภายนอก — เก็บ sha256 ของ key เท่านั้น (key จริงส่งให้เจ้าของครั้งเดียว)
create table if not exists app_integration_keys (
  name text primary key,
  key_sha256 text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ② คอมเมนต์ทุกอัน (กันซ้ำด้วย comment_url) — ผูกใบสมัครเมื่อมีเบอร์
create table if not exists so_scraping_comment_leads (
  id uuid primary key default gen_random_uuid(),
  request_no text not null,
  job_id text,
  commenter_name text,
  phone text,
  comment_text text,
  comment_url text not null,
  post_url text,
  group_name text,
  commented_at timestamptz,
  application_id uuid,
  duplicate boolean not null default false,
  do_not_call boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists so_scraping_comment_leads_comment_url_idx on so_scraping_comment_leads (comment_url);
create index if not exists so_scraping_comment_leads_request_no_idx on so_scraping_comment_leads (request_no);
create index if not exists so_scraping_comment_leads_application_idx on so_scraping_comment_leads (application_id);
