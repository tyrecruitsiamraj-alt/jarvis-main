-- แยกประเภทคำขอที่ส่งให้ระบบ Scrap & Content Autopost
-- ข้อมูลเดิมเป็น content เพื่อ backward compatibility
alter table if exists job_posting_requests
  add column if not exists request_type text not null default 'content';

alter table if exists job_posting_requests
  drop constraint if exists job_posting_requests_request_type_check;

alter table if exists job_posting_requests
  add constraint job_posting_requests_request_type_check
  check (request_type in ('content', 'scraping'));

-- completed ใช้กับงาน Scraping ที่ทีมปลายทางตรวจรับผลแล้ว
alter table if exists job_posting_requests
  drop constraint if exists job_posting_requests_status_check;

alter table if exists job_posting_requests
  add constraint job_posting_requests_status_check
  check (status in ('pending', 'in_progress', 'posted', 'completed', 'filled', 'cancelled'));

create index if not exists job_posting_requests_type_status_idx
  on job_posting_requests (request_type, status, created_at desc);
