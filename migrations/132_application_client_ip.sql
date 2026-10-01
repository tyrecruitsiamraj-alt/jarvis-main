-- ═══ สมัครซ้ำต้องรอ 14 วัน — เก็บ IP ของคนกรอกไว้กับใบ (1 ต.ค. 2569) ═══
--
-- เจ้าของ (Choice): เบอร์ซ้ำ "บล็อคไว้ที่ 14 วัน" ขอบเขต "เบอร์เดิม ไม่ว่างานไหน" (ทุกทางเข้า)
--   + IP "กันไว้เผื่อเขาเปลี่ยนมีหลายเบอร์ ... บอกว่าต้องรอ 14 วัน" · Choice "IP ละ 1 ใบใน 14 วัน"
--   + IP "เก็บ Log พอไม่ต้องเอามาโชว์" — ไม่มีหน้าไหนอ่านคอลัมน์นี้ (ไม่อยู่ในชุดคอลัมน์ที่ API ส่งออก)
--
-- ที่มา (วัดจากฐาน 1 ต.ค. 2569): 134 ใบ · 5 เบอร์กรอกงานเดิมซ้ำ (2 ใบภายใน 10 นาที) และทั้ง 5 คน
-- **โดน AI โทรเรื่องงานเดิม 2 สาย**
--
-- 🔴 กติกาเป็น "ช่วงเวลา" (14 วันตามปฏิทินไทย) ⇒ unique index ทำไม่ได้ · ที่ตัดสินคือ API ในธุรกรรมเดียวกับ
--    insert + advisory lock ของเบอร์/IP (`api/_lib/applicationRepeatGuard.ts`) — คำขอพร้อมกันต้องรอคิว
-- ⚠️ ใบซ้ำเก่าไม่แตะ (ไม่ลบ ไม่ติดป้าย) — กติกาดูแค่ใบภายใน 14 วันล่าสุด
-- ⚠️ IP ที่เก็บ = `CF-Connecting-IP` (Cloudflare เขียนทับเอง ปลอมไม่ได้) · ไม่มีหัวนี้ = null (ไม่เข้ากติกา IP)
-- ⚠️ deploy รันโค้ดใหม่ก่อน migrate — โค้ดรับมือคอลัมน์นี้ยังไม่มีแล้ว (ข้ามกติกา IP ชั่วคราว)

alter table public_job_applications
  add column if not exists client_ip text null;

create index if not exists public_job_applications_client_ip_idx
  on public_job_applications (client_ip, created_at desc)
  where client_ip is not null;

comment on column public_job_applications.client_ip is
  'IP ของคนกรอกหน้าสมัคร (CF-Connecting-IP · 132 · 1 ต.ค. 2569) — ใช้กติกา IP ละ 1 ใบใน 14 วัน · ไม่มีหน้าไหนโชว์';
