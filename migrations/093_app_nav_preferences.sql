-- เมนูที่แอดมินจัดเอง — ย้ายลำดับ / เปลี่ยนชื่อ / ซ่อน
-- (เจ้าของสั่ง 16 ส.ค. 2569 เย็น: "เพิ่มให้ฉันปรับแก้ ย้ายเอง เปลี่ยนชื่อเองได้ด้วย")
--
-- แพตเทิร์นเดียวกับ 069 (app_lumos_dispatch_mode) และ 073 (call followup policy):
-- แถวเดียว id='default' เก็บ payload jsonb — เปลี่ยนค่าที่หน้าตั้งค่า ไม่ต้อง deploy
--
-- payload รูปแบบ: { "<path>": { "label": "...", "order": 0, "hidden": true } }
--   เก็บเป็น **override รายเมนู** ไม่ใช่ลิสต์เมนูทั้งก้อน — เพิ่มเมนูใหม่ในโค้ดวันหลัง
--   มันจะโผล่ให้เอง ไม่ต้องกลับมาแก้ค่าที่แอดมินตั้งไว้
--   (ถ้าเก็บทั้งก้อน เมนูใหม่จะหายเงียบจนกว่าจะมีคนกดบันทึกใหม่)
--
-- payload ว่าง / ไม่มีตาราง = ใช้ลำดับและชื่อตั้งต้นในโค้ด (DOCK_NAV_ITEMS)
-- ⚠️ "ซ่อน" ที่นี่ไม่ใช่การตัดสิทธิ์ — route ยังเข้าได้ด้วยลิงก์ตรง
--    สิทธิ์จริงอยู่ที่ roleFunctionGrants เหมือนเดิม

CREATE TABLE IF NOT EXISTS app_nav_preferences (
  id text PRIMARY KEY DEFAULT 'default',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_name text NULL
);

-- เริ่มด้วยว่าง = เมนูเหมือนเดิมเป๊ะจนกว่าแอดมินจะกดจัดเอง
INSERT INTO app_nav_preferences (id, payload)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
