-- ═══ ใบสมัครที่ซ้ำกับ iRecruit = AI ไม่โทรเอง ติดป้ายให้คนเลือก (12 ต.ค. 2569) ═══
--
-- เจ้าของ: "ถ้ารายชื่อใหม่เข้ามาจาก Link มาจาก So recruit และมาจาก Excel ดูว่ามันซ้ำกันไหม แล้วกรองมาให้ AI โทรก่อนเฉพาะไม่ซ้ำ"
--   → Choice: ซ้ำ = เบอร์นี้สมัครใน iRecruit (recruit_register) ภายใน 14 วัน · ซ้ำแล้วไม่ส่ง AI เอง ติดป้ายให้คนเลือก ·
--     อ่าน iRecruit ไม่ได้ = ส่ง AI ตามเดิม
-- วัดจริง 30 วัน (12 ต.ค.): ผู้สมัครผ่านลิงก์ 371 · สมัคร iRecruit ภายใน 14 วันก่อนหน้า 58 (16%)
--
-- ตารางแยก (แบบ 135 application_cancellations) — มีแถว = ตัวส่ง AI อัตโนมัติทุกเส้นข้ามใบนี้ (กรอกเสร็จ · ตั้งรายได้ · ครบ 1 วันไม่เลือกวิธีโทร)
-- ปุ่ม "ส่ง AI โทร" ที่เจ้าหน้าที่กดเองไม่ดูตารางนี้ (คนเลือกแล้ว)

create table if not exists application_irecruit_dups (
  application_id uuid primary key,
  irecruit_register_id bigint null,
  irecruit_applied_at timestamptz not null,
  checked_at timestamptz not null default now()
);

comment on table application_irecruit_dups is
  'ใบสมัครที่เบอร์ซ้ำกับ iRecruit ภายใน 14 วัน (143 · 12 ต.ค. 2569) — มีแถว = AI ไม่โทรเอง ป้าย "ซ้ำ iRecruit" ให้คนเลือกส่งเอง';
