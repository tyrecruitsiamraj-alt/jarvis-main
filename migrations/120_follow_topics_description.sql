-- คำอธิบายสั้นของ "เรื่องที่จะให้โทรติดตาม" (12 ก.ย. 2569)
--
-- 🔴 ทำไม: ผู้ทดสอบตาใหม่เห็น 3 ตัวเลือก (เริ่มงาน / เรียนงาน / เบิกเบี้ยเลี้ยง)
-- แล้วถามว่า *"ต่างกันไหม เลือกแบบไหนตอนไหน"* — ชื่อเรื่องสั้น ๆ ไม่พอให้คนใหม่ตัดสินใจ
-- และเรื่องนี้ไปโผล่ใน **บทพูดของ AI** เลือกผิด = โทรไปพูดผิดเรื่องกับคนจริง
--
-- ⚠️ เป็นคอลัมน์เสริม **ห้ามบังคับ** — เรื่องที่เจ้าหน้าที่เพิ่มเองทีหลังไม่มีคำอธิบายก็ต้องใช้ได้
-- (ตารางนี้คือ "ตัวช่วยกรอก" ไม่ใช่ "ตัวบังคับค่า" ตามที่ migration 100 เขียนไว้)
--
-- ใครใช้: api/_handlers/follow-topics.ts (ส่งออก) · src/components/follow/TopicField.tsx (แสดง)

alter table follow_topics
  add column if not exists description text;

comment on column follow_topics.description is
  'คำอธิบายสั้นว่าเรื่องนี้ใช้ตอนไหน — โชว์ใต้ชื่อใน dropdown · null ได้ (เรื่องที่เพิ่มเองไม่ต้องมี)';

-- เติมคำอธิบายให้ชุดตั้งต้น 3 เรื่อง — อัปเดตเฉพาะที่ยังว่าง ไม่ทับของที่คนแก้เอง
update follow_topics
   set description = 'ก่อนถึงวันเริ่มงาน — ถามว่าพรุ่งนี้/วันนี้ไปตามนัดไหม'
 where description is null and lower(trim(name)) like '%เริ่มงาน%';

update follow_topics
   set description = 'ระหว่างช่วงเรียนงาน — ถามว่ามาเรียนงานต่อเนื่องไหม'
 where description is null and lower(trim(name)) like '%เรียนงาน%';

update follow_topics
   set description = 'เรื่องเงิน — ตามเอกสาร/ยืนยันการเบิกเบี้ยเลี้ยง'
 where description is null and lower(trim(name)) like '%เบี้ยเลี้ยง%';
