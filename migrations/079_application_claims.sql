-- "เก็บผู้สมัครไปติดต่อ" — เจ้าของสั่ง 13 ส.ค. 2569:
-- "กล่องงานพอกดเข้าไปจะเจอรายชื่อ และพอเลือกเสร็จไปโผล่ที่หน้าการติดต่อ
--  และคนอื่นจะไม่เห็นชื่อคนที่เก็บไป มีแค่ฉันที่เห็น"
--
-- ใบสมัครที่ถูก "เก็บ" ผูกกับคนเก็บ (claimed_by) — แท็บการติดต่อโชว์เฉพาะของตัวเอง
-- และรายชื่อรวมจะไม่โชว์ใบที่คนอื่นเก็บไปแล้ว (เห็นแค่จำนวน ไม่เห็นชื่อ)
--
-- ⚠️ เป็นการเติมคอลัมน์ ไม่แตะของเดิม — ใบที่ยังไม่ถูกเก็บ (claimed_by = null)
-- ทุกคนเห็นเหมือนเดิมทุกอย่าง

alter table public_job_applications
  add column if not exists claimed_by uuid null,
  add column if not exists claimed_by_name text null,
  add column if not exists claimed_at timestamptz null;

create index if not exists public_job_applications_claimed_by_idx
  on public_job_applications (claimed_by)
  where claimed_by is not null;
