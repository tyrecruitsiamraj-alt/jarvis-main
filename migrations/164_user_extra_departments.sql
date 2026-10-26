-- ═══ ผู้ใช้ดูได้หลาย BU (เจ้าของ 26 ต.ค. 2569 "บางคนดูได้หลาย BU" · Choice "เพิ่มให้เลือกได้หลาย BU") ═══
-- department_code = BU หลัก (ตอนล็อกอิน / ใบสมัครที่คีย์เอง) · extra_department_codes = BU ที่ดูเพิ่ม
-- เห็นใบขอ/ผู้สมัคร/งาน = BU หลัก + BU เพิ่ม · ตั้งที่ ตั้งค่า › ผู้ใช้งาน
alter table if exists users add column if not exists extra_department_codes text[] not null default '{}';
