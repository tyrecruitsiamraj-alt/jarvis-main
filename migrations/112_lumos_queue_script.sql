-- 112 · จดว่า "สายนี้ AI ใช้บทชุดไหน เวอร์ชันไหน"
--
-- เจ้าของสั่ง 31 ส.ค. 2569: *"เพิ่มข้อมูล Scrip ที่จะส่งไปให้ Lumos ... ทุกอย่างเลย"*
-- แล้วตามด้วย *"บทพูดถ้าแยกตามงานใครงานมันแล้ว ก็ไม่ต้องให้เขาเลือกก็ได้"*
--
-- เนื้อบทที่ AI พูดจริง **ถูกส่งไป Lumos ครบอยู่แล้ว** (reminder = steps[].message
-- ทุกประโยค · interview = questions[] ทุกข้อ) สิ่งที่ขาดคือ **ป้ายกำกับว่าใช้บทไหน**
-- ⇒ เก็บไว้ฝั่งเรา เพื่อย้อนดูได้ว่าสายช่วงนั้น AI พูดบทเวอร์ชันอะไร
--
-- 🔴 **จงใจไม่ยัดลง payload** — คอลัมน์ `payload` ถูกส่งให้ Lumos ทั้งก้อนแบบไม่แก้
-- (ดู takePendingLumosItems) และ Lumos มีนิสัยกลืน field ที่ไม่รู้จักแบบเงียบ ๆ
-- การเพิ่ม field เข้า payload จึงเสี่ยงทำให้สายหายโดยไม่มีใครรู้ ⇒ แยกคอลัมน์แทน
-- จะเพิ่มเข้า payload เมื่อฝั่ง Lumos ยืนยันว่ารับได้เท่านั้น
--
-- ทุกคอลัมน์ nullable — แถวเก่าเป็น null ได้ และโค้ดต้องทำงานได้แม้ยังไม่รัน migration นี้

alter table jarvis_rm.lumos_dispatch_queue
  add column if not exists script_key text,
  add column if not exists script_source text,
  add column if not exists script_fingerprint text;

comment on column jarvis_rm.lumos_dispatch_queue.script_key is
  'ชุดบทที่ใช้: interview (คนยังไม่สมัคร) / offer (คนติดต่อมาแล้ว) / follow (งานตามนัด)';
comment on column jarvis_rm.lumos_dispatch_queue.script_source is
  'default = บทมาตรฐานในไฟล์ · custom = ฉบับที่แอดมินแก้จากหน้าตั้งค่า';
comment on column jarvis_rm.lumos_dispatch_queue.script_fingerprint is
  'ลายนิ้วมือสั้นของบทที่ใช้จริงตอนนั้น — บทถูกแก้เมื่อไหร่ค่านี้เปลี่ยน ใช้แยกเวอร์ชัน';

create index if not exists lumos_dispatch_queue_script_key_idx
  on jarvis_rm.lumos_dispatch_queue (script_key);
