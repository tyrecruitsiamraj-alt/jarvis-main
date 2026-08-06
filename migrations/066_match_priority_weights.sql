-- น้ำหนักเกณฑ์เรียงผู้สมัครหน้า Matching — ตั้งค่าที่หน้า Settings แล้วใช้ร่วมกันทั้งทีม
-- (ค่าเริ่มต้นอยู่ในโค้ด src/lib/candidatePriority.ts — แถวนี้ว่างไว้ = ใช้ค่าเริ่มต้น)
CREATE TABLE IF NOT EXISTS app_match_priority_weights (
  id text PRIMARY KEY DEFAULT 'default',
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_match_priority_weights (id, payload)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
