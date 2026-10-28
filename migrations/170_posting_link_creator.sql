-- ═══ ลิงก์สมัครจำคนสร้างทีละลิงก์ (เจ้าของ 28 ต.ค. 2569 "บอกเพิ่มหน่อยว่าลิงก์นี้ใครรับผิดชอบ · มันจะมีคนอื่นสร้างด้วย") ═══
-- เดิมรู้แค่คนสร้างประกาศ — ลิงก์ที่คนอื่นกด "Gen link เพิ่ม" ทีหลังอยู่ใต้ประกาศเดิม เลยบอกไม่ได้ว่าใครสร้าง
-- ผู้รับผิดชอบของลิงก์ = คนที่กดสร้าง (ระบบรู้จากบัญชีที่ล็อกอิน) · ลิงก์เก่าว่าง = ใช้ผู้รับผิดชอบของประกาศเหมือนเดิม · เพิ่มอย่างเดียว
alter table if exists recruit_posting_links add column if not exists created_by_user_id uuid null;
alter table if exists recruit_posting_links add column if not exists created_by_name text null;
