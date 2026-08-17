-- "เก็บ Lead" — ปัดใบสมัครออกจากรายชื่อทำงานไปกองคลังสำรอง
--
-- เจ้าของเคาะ 11 ส.ค. 2569: "ตามระบบเดิมเป๊ะ — ปัดออกจากคิว"
-- และเคาะเพิ่ม 12 ส.ค. 2569: **ปัดแล้วหายจากทุกแท็บ + มีตัวกรองเรียกคืนดู**
--
-- หลักฐานจากระบบเดิม (iRecruit `recruit_register`): `is_lead = 1` มี 119,342/154,820
-- แถว (77%) · มี `lead_by` / `lead_at` · `lead_at` เกิด **หลัง** `created_at`
-- → "เก็บ Lead" = ย้ายใบออกจากรายชื่อทำงาน + บันทึกว่าใครกดกับเมื่อไหร่
--
-- ⚠️ แพตเทิร์นเดียวกับ claim (079) เป๊ะ: **เติมคอลัมน์ ไม่แตะของเดิม**
-- ใบที่ยังไม่ถูกปัด (is_lead = false) ทุกคนเห็นเหมือนเดิมทุกอย่าง
--
-- ⚠️ ต่างจาก claim ตรงที่ Lead เป็นสถานะ **ระดับระบบ** ไม่ใช่ของใครคนหนึ่ง —
-- ใครปัดก็หายจากรายชื่อของทุกคน (ตามระบบเดิม) · `lead_by` เก็บไว้เพื่อสาวกลับได้
-- ว่าใครเป็นคนปัด ไม่ได้เอาไปคุมว่าใครเห็น

alter table public_job_applications
  add column if not exists is_lead boolean not null default false,
  add column if not exists lead_by uuid null,
  add column if not exists lead_by_name text null,
  add column if not exists lead_at timestamptz null;

-- ลิสต์ปกติกรอง "ไม่ใช่ Lead" ทุกครั้ง · หน้าคลังสำรองกรอง "เป็น Lead"
-- partial index ครอบฝั่งที่เล็กกว่า (คลังสำรอง) — ฝั่งลิสต์ปกติใช้ scan ตามเดิม
create index if not exists public_job_applications_is_lead_idx
  on public_job_applications (lead_at desc)
  where is_lead;
