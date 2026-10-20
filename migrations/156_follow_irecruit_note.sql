-- ═══ ค่าของ iRecruit ตอนดึงล่าสุด แยกจากค่าบนจอ (20 ต.ค. 2569) ═══
-- เจ้าของ: แท็บส่งคนแทนแก้แบบป๊อป 4 หน้า + "แก้อันไหนล่าสุดเอาอันนั้น
--   เช่น jarvis แก้ตอน 13.00 แต่ irecruit แก้ตอน 13.01 เอา irecruit"
-- เดิมรอบดึง iRecruit เทียบกับค่าในแถวตรง ๆ ⇒ แก้เวลาเข้างาน/ชื่อ/หน่วยงานบน jarvis แล้ว
-- รอบดึงเห็นว่าไม่ตรง iRecruit แล้วแก้กลับทุก 5 นาที ⇒ เก็บค่าของ iRecruit ไว้ช่องพวกนี้
--   ค่าของ iRecruit ไม่เปลี่ยน = ที่ต่างคือคนแก้บน jarvis ทีหลัง → ไม่ทับ · เปลี่ยน = iRecruit แก้ทีหลัง → ทับ
alter table follow_entries add column if not exists irecruit_note text null;
alter table follow_entries add column if not exists irecruit_name text null;
alter table follow_entries add column if not exists irecruit_unit_name text null;
alter table follow_entries add column if not exists irecruit_site_code text null;

-- แถวที่ดึงมาก่อนหน้านี้: ค่าตอนนี้ = ค่าของ iRecruit ตอนดึงล่าสุด
update follow_entries
   set irecruit_note = note,
       irecruit_name = recipient_name,
       irecruit_unit_name = unit_name,
       irecruit_site_code = site_code
 where irecruit_note is null
   and source_ref like 'irecruit-replace:%';
