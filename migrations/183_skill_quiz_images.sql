-- แบบทดสอบพนักงาน: รูปของคำถามและตัวเลือก
-- เจ้าของ 17 พ.ย. 2569 "ข้อสอบ และ Choice ใส่รูปได้ไหม" → Choice "คำถาม+ตัวเลือก"
-- ชุดข้อสอบ (jsonb) เก็บแค่รหัสรูป · ตัวรูปอยู่ตารางนี้ที่เดียว ใบของคนทำที่สำเนาชุดไปจึงไม่บวมตามรูป
-- รูปไม่ลบ: ใบที่ทำไปแล้วยังชี้รูปเดิมได้แม้ชุดถูกแก้ · เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
create table if not exists skill_quiz_images (
  id uuid primary key default gen_random_uuid(),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null,
  bytes bytea not null,
  created_by_name text,
  created_at timestamptz not null default now()
);
