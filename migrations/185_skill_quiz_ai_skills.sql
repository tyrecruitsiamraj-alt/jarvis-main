-- แบบทดสอบพนักงาน: คลัง Skill ของ AI (ความรู้/หลักคิดผู้เชี่ยวชาญที่ AI ใช้ร่างผลวิเคราะห์)
-- เจ้าของ 17 พ.ย. 2569 "Skill มันต้องฝังแยกชุดเลยหรอ" → เก็บเป็นคลัง แต่ละชุดเลือกจากคลัง (content.aiSkillId)
-- แก้ Skill ที่เดียว ทุกชุดที่เลือกตัวนั้นใช้ตาม · ลบ = archived_at (ชุดที่ยังชี้อยู่ AI กลับไปใช้บทบาทเดิม) · เพิ่มอย่างเดียว
create table if not exists skill_quiz_ai_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  created_by_name text,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
