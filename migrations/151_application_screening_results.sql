-- ผล "ผ่าน / ไม่ผ่าน" หลังผู้สมัครมาตามนัด (เจ้าของสั่ง 18 ต.ค. 2569 — Journey งานสรรหา:
-- "นัดได้มาเท่าไหร่ ไม่มาเท่าไหร่ · มาแล้วผ่านเท่าไหร่ ไม่ผ่านเท่าไหร่ · หน้า ui ต้องทำได้ห้ามทำจากหลังบ้าน")
--
-- แยกตารางจากผลนัด (089) โดยตั้งใจ — ผลนัด "มาตามนัด" ถูกนับในหลายสิบจุด ถ้าเพิ่มค่า passed ลงตารางเดิม
-- แถวล่าสุดจะกลายเป็น passed แล้วจุดที่นับ 'showed' ตกหล่นเงียบ ๆ
--
-- ⚠️ append-only แถวล่าสุดต่อ (ใบ, วันนัด) ชนะ · snapshot appointment_at แบบเดียวกับ 089
-- ⚠️ ไม่ใส่ CHECK ที่ result — ค่าที่ยอมรับคุมที่ src/lib/appointmentScreening.ts ที่เดียว (บทเรียน 077/085)
-- ⚠️ ไม่แตะ status ของใบ

create table if not exists application_screening_results (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public_job_applications(id) on delete cascade,
  appointment_at timestamptz not null,
  -- 'passed' | 'not_passed'
  result text not null,
  note text null,
  recorded_by uuid null,
  recorded_by_name text null,
  created_at timestamptz not null default now()
);

create index if not exists application_screening_results_lookup_idx
  on application_screening_results (application_id, appointment_at, created_at desc);
