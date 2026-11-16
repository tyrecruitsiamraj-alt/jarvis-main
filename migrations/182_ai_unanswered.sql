-- คำถามที่ผู้ช่วย AI ตอบไม่ได้ (เจ้าของ 16 พ.ย. 2569 "Ai เก็บอะไรที่ไม่มีคำตอบมา แล้วบอกหน่อยว่าไม่มีคำตอบแล้วจะดูยังไง")
-- ผู้ช่วยจดเองตอนหาข้อมูลในระบบไม่เจอ · ดูที่ ตั้งค่า › AI ที่ใช้คิดงาน · ข้อความปิดเบอร์/อีเมล/เลขบัตรแล้วก่อนจด
-- ตารางใหม่ เพิ่มอย่างเดียว · กด "ดูแล้ว" = ใส่ cleared_at (ไม่ลบแถว)
create table if not exists ai_unanswered (
  id bigserial primary key,
  asked_by text,
  asked_by_name text,
  question text not null,
  missing text,
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by text
);
create index if not exists ai_unanswered_open_idx on ai_unanswered (created_at desc) where cleared_at is null;
