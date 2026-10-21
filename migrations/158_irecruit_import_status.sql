-- ═══ สถานะใน iRecruit ของรายชื่อที่ดึงมา (เจ้าของ 21 ต.ค. 2569 "ข้อ 2 ทำ") ═══
-- ทีม Online โทรรายชื่อที่ดึงจาก iRecruit ใน iRecruit เอง ⇒ Jarvis ไม่รู้ว่าโทรแล้วหรือยัง (วัด 21 ต.ค.: 300 คน · W 90 · C 210)
-- ตัวดึงทุก 15 นาทีอ่าน `recruit_register.process_status` กลับมาเก็บตรงนี้ (W รอดำเนินการ · A สำเร็จ · อื่น ไม่สำเร็จ)
-- ใช้บอก "ค้างเกิน 24 ชม." บนแถว + แจ้งเตือนผู้รับผิดชอบ — ตารางของ Jarvis เอง ไม่เขียนกลับ iRecruit
alter table app_irecruit_imports add column if not exists irecruit_status text null;
alter table app_irecruit_imports add column if not exists irecruit_status_at timestamptz null;
