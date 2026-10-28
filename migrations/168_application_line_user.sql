-- ═══ ใบสมัครจาก LINE Bot So Work (ทีมบอท 28 ต.ค. 2569 · เจ้าของ Choice "ทำข้อ 1–2") ═══
-- ลิงก์จากบอท /apply?...&lid=<LINE userId>&lsig=<HMAC-SHA256(lid)> · ลายเซ็นตรง = เก็บ lid + referral_source = 'line_oa'
-- แล้วแจ้งบอทตอนส่งใบสำเร็จ (api/_lib/lineBotSoWork.ts) · เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
alter table if exists public_job_applications add column if not exists line_user_id text null;
create index if not exists public_job_applications_line_user_idx on public_job_applications (line_user_id) where line_user_id is not null;

-- ค่า referral_source เพิ่ม 'line_oa' (ของเดิม 5 ค่ายังอยู่ครบ)
alter table if exists public_job_applications drop constraint if exists public_job_applications_referral_source_check;
alter table if exists public_job_applications add constraint public_job_applications_referral_source_check
  check (referral_source is null or referral_source = any (array['facebook', 'tiktok', 'instagram', 'flyer', 'other', 'line_oa']));
