-- ═══ โพสต์เองรายวัน (เจ้าของ 13 พ.ย. 2569) ═══
-- "โพสต์มือไปแล้วของวันนี้ทำไมไม่มีอะไรโชว์เลย" — โพสต์ซ้ำลงกลุ่มเดิมใช้ลิงก์เดิม (ไม่สร้างใหม่) ⇒ ไม่มีร่องรอยว่าโพสต์วันไหน
-- Choice "คัดลอกข้อความ": กดคัดลอกข้อความของกลุ่มไหน = วันนั้นโพสต์กลุ่มนั้น 1 ครั้ง (ลิงก์ · วันไทย) กดซ้ำวันเดียวกันไม่นับเพิ่ม
-- เก็บแค่ใคร/วันไหน ไม่มีข้อมูลผู้สมัคร · เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
create table if not exists recruit_posting_link_posts (
  link_id uuid not null,
  day date not null,
  posted_by_user_id uuid null,
  posted_by_name text null,
  created_at timestamptz not null default now(),
  primary key (link_id, day)
);
create index if not exists recruit_posting_link_posts_day_idx on recruit_posting_link_posts (day);
