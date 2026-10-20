-- ═══ คำขอโพสต์/Scrap ไประบบ So Scraping (เจ้าของ 20 ต.ค. 2569) ═══
-- So Scraping อ่านคำขอ pending จาก job_posting_requests แล้วเขียนสถานะกลับแถวเดิม
-- ข้อมูลใหม่ (post_mode · caption · group_ids) อยู่ใน job_snapshot ⇒ ไม่เพิ่ม/ลบ/เปลี่ยนชื่อคอลัมน์ · ไม่แตะแถวเก่า

-- ① So Scraping ตอบ "ไม่รับงาน" ได้ (Choice "เปิดให้เก็บได้") — เดิมด่านในฐานไม่มีค่า rejected
alter table if exists job_posting_requests
  drop constraint if exists job_posting_requests_status_check;
alter table if exists job_posting_requests
  add constraint job_posting_requests_status_check
  check (status in ('pending', 'in_progress', 'posted', 'completed', 'filled', 'cancelled', 'rejected'));

-- ② กันสั่งซ้ำเฉพาะตอนรอ/กำลังทำ (Choice "ได้ หลังโพสต์แล้ว") — เดิมรวม posted ⇒ โพสต์แล้วสั่งรอบใหม่ไม่ได้
drop index if exists job_posting_requests_active_job_type_idx;
create unique index if not exists job_posting_requests_open_job_type_idx
  on job_posting_requests (job_id, request_type)
  where status in ('pending', 'in_progress');
