-- บันทึกผลการติดต่อผู้สมัคร (เจ้าของสั่ง 14 ส.ค. 2569 — ลิสต์ข้อ 7):
-- กดเข้ารายชื่อ → ปุ่ม "ติดต่อสำเร็จ / ติดต่อไม่สำเร็จ"
--   สำเร็จ → นัดได้ไหม → นัดวันไหน / นัดที่ไหน / ลงหน่วยงานอะไร (เลือกใบขอเปิด
--   หรือ "หาล่วงหน้า" = นัดไว้แต่ยังไม่รู้ลงใบไหน — เจ้าของเคาะ)
--   ไม่สำเร็จ → เลือกเหตุผล (master เหตุผล 67 ตัวที่ยกมาจากระบบเดิม)
--
-- ⚠️ เก็บเป็น log รายครั้ง (ติดต่อได้หลายรอบ) — ผลล่าสุดของใบไหนอ่านด้วย
-- ROW_NUMBER/DISTINCT ON ฝั่งคิวรี · ห้ามเก็บเป็นคอลัมน์เดียวบนใบสมัคร
-- (กติกาเดียวกับ recruit_contact ของระบบเดิมที่มี seq รายครั้ง)
--
-- ⚠️ `reason_label`/`job_label` เป็น snapshot ตอนบันทึก — master เหตุผลปิดใช้งานได้
-- และใบขอปิดได้ ถ้าเก็บแค่ id ประวัติจะอ่านไม่ออกในอนาคต

create table if not exists application_contact_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public_job_applications(id) on delete cascade,

  -- ผลหลัก: ติดต่อสำเร็จไหม
  ok boolean not null,

  -- ฝั่ง "ไม่สำเร็จ" — เหตุผลจาก master (id อาจถูกปิดใช้ทีหลัง จึง snapshot label ไว้)
  reason_id uuid null,
  reason_label text null,

  -- ฝั่ง "สำเร็จ + นัดได้" — วันนัด/สถานที่/ใบขอที่จะลง
  appointment_at timestamptz null,
  appointment_place text null,
  -- ใบขอที่จะลง (job_id ฝั่งเรา เช่น 'siamraj-sql:OPL6908026') · null = "หาล่วงหน้า"
  job_id text null,
  job_label text null,

  note text null,
  created_by uuid null,
  created_by_name text null,
  created_at timestamptz not null default now()
);

-- อ่านผลล่าสุดต่อใบ + ลิสต์นัดทั้งหมด
create index if not exists application_contact_logs_app_idx
  on application_contact_logs (application_id, created_at desc);
create index if not exists application_contact_logs_appt_idx
  on application_contact_logs (appointment_at)
  where appointment_at is not null;
