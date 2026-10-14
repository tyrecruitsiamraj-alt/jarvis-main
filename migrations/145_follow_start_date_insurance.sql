-- ═══ ฟอร์มเพิ่มคนติดตาม: วันที่เริ่มงาน + ขั้น 4 ประกัน/ผู้ติดต่อลูกค้า (14 ต.ค. 2569) ═══
--
-- เจ้าของ: "หน้าเพิ่มคนติดตาม ข้อ 1.คนที่ต้องติดตาม ขอเพิ่มช่องใส่วันที่เริ่มงาน" (Choice: เก็บไว้ดูอย่างเดียว)
--          "ข้อ 4 ประเภทประกัน (ดึงเชื่อมกับข้อ 2 หน่วยงาน) และ ดึง ชื่อ-เบอร์โทร ลูกค้า มาให้ด้วย" (Choice: เก็บติดรายการ แก้ได้)
-- เก็บเป็นข้อความ snapshot ทุกแถวของชุด (แบบเดียวกับ unit_name 096) — ERP อยู่คนละฐาน ไม่ผูก FK · ไม่บังคับทุกช่อง

alter table follow_entries
  add column if not exists start_date date null,
  add column if not exists insurance_type text null,
  add column if not exists customer_name text null,
  add column if not exists customer_contact text null,
  add column if not exists customer_phone text null;

comment on column follow_entries.start_date is 'วันที่เริ่มงาน (145) — เก็บไว้ดู ไม่แตะตารางโทร';
comment on column follow_entries.insurance_type is 'ประเภทประกันของหน่วยงาน (145) — ดึงจากใบขอ ERP แก้ได้';
