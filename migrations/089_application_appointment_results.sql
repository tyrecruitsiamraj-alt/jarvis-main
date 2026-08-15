-- ผลติดตามนัด "มาตามนัด / ไม่มา / เลื่อนนัด" (เจ้าของสั่ง 15 ส.ค. 2569 —
-- Dashboard visual control: "นัดสำเร็จแต่มาเท่าไหร่ นัดสำเร็จแต่ไม่มาเท่าไหร่")
--
-- ⚠️ **append-only** — บันทึกซ้ำได้ (กดผิดแก้ได้) แถวล่าสุดต่อ (ใบ, วันนัด) ชนะ
-- อ่านด้วย DISTINCT ON ฝั่งคิวรี (กติกาเดียวกับ application_contact_logs/086)
-- ห้ามแก้ log เดิม — contact log ไม่มี updated_at แก้ in-place = ประวัติเปื้อนพิสูจน์ไม่ได้
--
-- ⚠️ snapshot `appointment_at` ไว้กับผล — นัดเลื่อนได้ ถ้าผูกแค่ใบ ผลของนัดเก่า
-- จะไปทับนัดใหม่เงียบ ๆ · ผลนี้เป็นของ "นัดครั้งไหน" ต้องบอกได้เสมอ
--
-- ⚠️ **ไม่ใส่ CHECK ที่ค่า result** โดยตั้งใจ — บทเรียน 068/077 กับ 085: CHECK ที่ฐาน
-- กับ validator ที่ API หลุด sync แล้วทั้ง endpoint ตาย 500 · ค่าที่ยอมรับคุมที่
-- constant เดียวใน src/lib/appointmentAttendance.ts (ใช้ทั้งฟอร์มและด่าน API)
--
-- ⚠️ **ไม่แตะ status ของใบ** — status enum ไม่มีคำว่า "มาแล้ว" และเจ้าของเคาะว่า
-- สถานะมาจากขั้นที่คนทำเท่านั้น · dashboard อ่านจาก log ตรง ๆ

create table if not exists application_appointment_results (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public_job_applications(id) on delete cascade,

  -- นัดครั้งไหน (snapshot ตอนกด — จากวันนัดที่แสดงบนแถว)
  appointment_at timestamptz not null,

  -- 'showed' | 'no_show' | 'rescheduled' — validator ที่ src/lib/appointmentAttendance.ts
  result text not null,

  note text null,
  recorded_by uuid null,
  recorded_by_name text null,
  created_at timestamptz not null default now()
);

-- อ่าน "ผลล่าสุดต่อ (ใบ, นัด)" — DISTINCT ON (application_id, appointment_at) order by created_at desc
create index if not exists application_appointment_results_lookup_idx
  on application_appointment_results (application_id, appointment_at, created_at desc);
