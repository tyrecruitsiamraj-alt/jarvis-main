-- โหมดส่งงานให้ Lumos ต่อ "จุดที่ทำให้เกิดการส่ง" (trigger)
--
-- ที่มา: เดิมโค้ดส่งเข้าคิว Lumos อัตโนมัติแบบ hardcode 3 จุด
-- (แมทคนของเราเสร็จ · กดค้นหา iRecruit · สร้างรายการติดตามในหน้า Follow)
-- เจ้าของสั่งปิด auto ก่อน (commit eb8c386 ถอด call ออกตรง ๆ) แต่บอกว่า
-- "อนาคตจะเอากลับมานะ" — ถ้าถอดโค้ดทิ้งจะต้องเขียนใหม่ทั้งชุดตอนอยากเปิด
--
-- ตารางนี้ทำให้ 3 จุดนั้นกลับมาอยู่ในโค้ดได้ แต่ "ปิดอยู่" ตามค่าในนี้
-- เปลี่ยนไป Auto = แก้ค่าเดียวที่หน้าตั้งค่า ไม่ต้องแก้โค้ด ไม่ต้อง deploy
--
-- payload รูปแบบ: { "board_match": "manual", "irecruit_search": "manual", "follow_entry": "manual" }
--   manual = คนติ๊กเลือกแล้วกดส่งเองที่หน้า Matching (POST /api/lumos/dispatch)
--   auto   = ส่งเข้าคิวเองทันทีเมื่อถึงจุดนั้น (พฤติกรรมเดิมก่อน eb8c386)
--
-- payload ว่าง / ไม่มีตาราง = manual ทุกจุด (fail-safe — ห้ามเผลอโทรออกเอง)
-- โหมด assist (ระบบจัดชุดให้ คนกดยืนยันทีเดียว) จะมาพร้อมชั้น "ชุดส่ง + อนุมัติ"
-- ยังไม่ใส่ค่าไว้ตอนนี้เพราะจะเป็นค่าที่ไม่มีโค้ดรองรับ

CREATE TABLE IF NOT EXISTS app_lumos_dispatch_mode (
  id text PRIMARY KEY DEFAULT 'default',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_name text NULL
);

-- เริ่มด้วย manual ทุกจุด = พฤติกรรมเดียวกับ production ตอนนี้เป๊ะ
-- (deploy แล้วไม่มีอะไรเปลี่ยนจนกว่าเจ้าของจะกดเปิดเอง)
INSERT INTO app_lumos_dispatch_mode (id, payload)
VALUES ('default', '{"board_match":"manual","irecruit_search":"manual","follow_entry":"manual"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
