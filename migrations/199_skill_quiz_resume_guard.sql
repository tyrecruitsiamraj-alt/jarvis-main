-- ═══ แบบทดสอบ: กันเดาวันเกิดตอน "เคยกรอกแล้ว" — เจ้าของ 25 พ.ย. 2569 ตรวจความปลอดภัยลิงก์ ═══
-- เดิมใครรู้เลขบัตร + มีลิงก์ชุด เดาวันเกิดได้ 20 ครั้ง/10 นาทีต่อ IP (เปลี่ยน IP ได้เรื่อย ๆ) แล้วเข้าไปทำข้อสอบแทนได้
-- ตอนนี้นับครั้งที่ผิดต่อใบ (ต่อเลขบัตร) ในฐาน — ผิดครบ 5 ครั้ง ล็อก 24 ชม. · ตรงแล้วล้างนับ
-- เพิ่มคอลัมน์อย่างเดียว ไม่แตะข้อมูลเดิม
set lock_timeout = '5s';
alter table skill_quiz_attempts add column if not exists resume_fail_count integer not null default 0;
alter table skill_quiz_attempts add column if not exists resume_locked_until timestamptz null;
