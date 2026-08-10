-- นโยบายการโทรตาม (call followup policy) — ตั้งค่าได้จากหน้า Follow
--
-- ที่มา: เดิมค่าพวกนี้ hardcode ใน src/lib/callFollowupPolicy.ts
-- (โทรซ้ำสูงสุด 3 ครั้ง · เว้น 24 ชม. · ห้ามโทร 20:00–08:00 · พักเบอร์ 30 วัน)
-- เจ้าของขอปรับได้เองว่า "คนนึงจะโทรกี่ครั้ง และโทรช่วงเวลากี่โมงบ้าง"
-- โดยไม่ต้องแก้โค้ด ไม่ต้อง deploy — แพตเทิร์นเดียวกับ 069 (app_lumos_dispatch_mode)
--
-- payload รูปแบบ (ความหมาย + การ normalize อยู่ที่ src/lib/callFollowupPolicy.ts ที่เดียว):
--   { "maxAttempts": 3, "retryGapHours": 24, "rescheduleDefaultHours": 4,
--     "quietFromHour": 20, "quietToHour": 8, "suppressDays": 30 }
--
-- payload ว่าง / ไม่มีตาราง = ค่าเริ่มต้นในโค้ด (พฤติกรรม production ปัจจุบันเป๊ะ)

CREATE TABLE IF NOT EXISTS app_call_followup_policy (
  id text PRIMARY KEY DEFAULT 'default',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_name text NULL
);

-- เริ่มด้วยค่าเดียวกับที่ hardcode อยู่ = deploy แล้วไม่มีอะไรเปลี่ยน
INSERT INTO app_call_followup_policy (id, payload)
VALUES ('default', '{"maxAttempts":3,"retryGapHours":24,"rescheduleDefaultHours":4,"quietFromHour":20,"quietToHour":8,"suppressDays":30}'::jsonb)
ON CONFLICT (id) DO NOTHING;
