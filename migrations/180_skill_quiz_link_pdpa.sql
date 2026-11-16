-- แบบทดสอบพนักงาน: ลิงก์เดียวต่อชุด · คนทำกรอกข้อมูลเอง + ยินยอม PDPA · เข้าซ้ำด้วยเลขบัตร+วันเกิด · ใครในทีมเห็นชุด (ทั้ง BU / รายคน)
-- เจ้าของ 16 พ.ย. 2569 "แบบ Knowa … ดูได้ทั้ง Bu นั้นๆ หรือรายคน · Login ด้วยบัตรประชาชน และวันเดือนปีเกิด" — เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม

alter table skill_quiz_sets add column if not exists public_token text;
alter table skill_quiz_sets add column if not exists viewer_bus text[] not null default '{}';
alter table skill_quiz_sets add column if not exists viewer_user_ids text[] not null default '{}';
alter table skill_quiz_sets add column if not exists created_by_user_id text;
create unique index if not exists skill_quiz_sets_public_token_uq on skill_quiz_sets (public_token) where public_token is not null;

alter table skill_quiz_attempts add column if not exists first_name text;
alter table skill_quiz_attempts add column if not exists last_name text;
alter table skill_quiz_attempts add column if not exists phone text;
alter table skill_quiz_attempts add column if not exists age integer;
alter table skill_quiz_attempts add column if not exists birth_date date;
-- เลขบัตร: เก็บแบบเข้ารหัส (ถอดได้เฉพาะเซิร์ฟเวอร์) + ค่าแฮชไว้ค้นตอนเข้าซ้ำ — ห้ามเก็บตัวเลขตรง ๆ
alter table skill_quiz_attempts add column if not exists citizen_id_hash text;
alter table skill_quiz_attempts add column if not exists citizen_id_enc text;
alter table skill_quiz_attempts add column if not exists consent_version text;
alter table skill_quiz_attempts add column if not exists consented_at timestamptz;
-- คนหนึ่งทำชุดเดิมได้ครั้งเดียว — ฐานตัดสิน (เจ้าหน้าที่ลบผลแล้ว ทำใหม่ได้)
create unique index if not exists skill_quiz_attempts_set_citizen_uq
  on skill_quiz_attempts (set_id, citizen_id_hash) where citizen_id_hash is not null and archived_at is null;
