-- เรียงคิวโทรตามคะแนนของ AI — "คนที่ AI ให้เขียว ได้โทรก่อน"
--
-- เจ้าของเคาะแล้วว่าใช้ **tier ของ AI** (เขียว/เหลือง/แดง) ไม่ใช่ % บนการ์ด
-- เดิมคิวเสิร์ฟตาม "ใบที่เข้าคิวก่อน" ล้วน — ใบขอที่ส่งทีหลังต้องรอคิวใบเก่าจนหมด
-- ทั้งที่คนในใบใหม่อาจตรงสเปคกว่ามาก
--
-- ⚠️ **null ได้โดยตั้งใจ** — คิวเก่าที่เข้ามาก่อน migration นี้ และงานจากหน้า Follow
-- (ไม่ได้ผ่าน AI แมท) ไม่มีคะแนน · คิวรีอ่านด้วย coalesce(match_rank, 2) เสมอ
-- = **อยู่ระดับกลางเท่าเหลือง ไม่ใช่ท้ายแถว** (ดู MATCH_RANK_UNKNOWN ใน src/lib/matchRank.ts —
--  ดันงาน Follow ไปท้ายแถวจะถ่วงงานด่วนทันทีที่เปิดใช้ โดยไม่มีใครสั่ง)
-- (ห้ามปล่อย NULL เข้า row comparison ตรง ๆ — ผลจะเป็น NULL ไม่ใช่ true
--  แล้วตัวกัน "หนึ่งเบอร์ = หนึ่งใบขอที่กำลังเสนอ" จะหลุด)

alter table lumos_dispatch_queue
  add column if not exists match_rank smallint null;

-- index ตามลำดับที่คิวรีเสิร์ฟใช้จริง (rank → คิวเก่าก่อน) เฉพาะแถวที่ยังไม่มีผล
create index if not exists lumos_dispatch_queue_serve_order_idx
  on lumos_dispatch_queue (channel, match_rank, created_at, id)
  where result is null;
