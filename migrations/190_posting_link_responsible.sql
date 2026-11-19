-- ═══ ลิงก์สมัครเลือกผู้รับผิดชอบได้ตอน Gen link (เจ้าของ 19 พ.ย. 2569 "พวกนี้มีเจ้าหน้าที่สรรหารับผิดชอบนะ ตอน gen link เพิ่มให้สามารถเลือกคนรับผิดชอบด้วยเลย") ═══
-- เดิมผู้รับผิดชอบของลิงก์ = คนที่กดสร้าง (170) · กล่องลอยมักมีคนอื่นกดให้ ลิงก์เลยไปนับเป็นของคนกด
-- responsible_user_id = เจ้าหน้าที่ที่เลือกในฟอร์ม (API ตรวจว่าเป็นผู้ใช้จริงที่ยังใช้งาน สายงานสรรหา หรือคนกดเอง)
-- created_by_user_id / created_by_name ยังเก็บคนกดจริงตามเดิม (ตรวจย้อนได้)
-- ลิงก์เก่าว่าง = ใช้คนกดเหมือนเดิม · เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
alter table if exists recruit_posting_links add column if not exists responsible_user_id uuid null;
alter table if exists recruit_posting_links add column if not exists responsible_name text null;
