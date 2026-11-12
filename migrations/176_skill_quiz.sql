-- ═══ แบบทดสอบพนักงาน + รายงานส่งลูกค้า (เจ้าของ 12 พ.ย. 2569) ═══
-- "เพิ่ม Function สำหรับ quiz … เจ้าหน้าที่เราจะโยน link ให้พนักงานมาทำ แล้วเราจะโหลดสรุปแบบรูปส่งลูกค้า"
-- ชุดข้อสอบเก็บทักษะ/ข้อเป็น jsonb ก้อนเดียว (แก้ทั้งชุดจากฟอร์มเดียว) · ลิงก์ละคนเก็บสำเนาชุดตอนสร้าง
-- ⇒ แก้ชุดทีหลัง ผลของคนที่ทำไปแล้วไม่เปลี่ยน · ลบ = soft (archived_at) · เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
create table if not exists skill_quiz_sets (
  id uuid primary key default gen_random_uuid(),
  content jsonb not null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_by_name text,
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create sequence if not exists skill_quiz_doc_seq;

create table if not exists skill_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references skill_quiz_sets(id),
  token text not null unique,
  doc_no text not null unique,
  person_name text not null,
  person_role text not null default '',
  content jsonb not null,
  answers jsonb,
  text_scores jsonb not null default '{}'::jsonb,
  analysis jsonb,
  analysis_by text,
  ai_error text,
  created_by_name text,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_name text,
  archived_at timestamptz
);
create index if not exists skill_quiz_attempts_created_idx on skill_quiz_attempts (created_at desc);
create index if not exists skill_quiz_attempts_set_idx on skill_quiz_attempts (set_id);
