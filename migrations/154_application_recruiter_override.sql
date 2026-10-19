-- ผู้สรรหาของผู้สมัครรายคน (เจ้าของ 19 ต.ค. 2569: "หน้างานสรรหา ข้อมูลผู้สรรหา ทำให้แก้ไขได้ด้วยสิ่"
-- → Choice "เฉพาะผู้สมัครคนนี้") — ว่าง = ใช้ผู้สรรหาของใบขอเหมือนเดิม (คอลัมน์ "เจ้าของงาน")
-- แก้จากป๊อปผู้สมัคร › แก้ไขข้อมูล · จด audit job_application.profile_edit เหมือนช่องอื่น
alter table public_job_applications add column if not exists recruiter_name text null;
