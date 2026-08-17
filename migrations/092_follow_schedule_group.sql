-- Follow แบบตั้งตารางโทรหลายวันหลายรอบ (เจ้าของสั่ง 16 ส.ค. 2569:
-- "Follow ตั้งแต่วันที่ 1-7 วันละ 2 รอบ รอบแรก 7 โมง รอบ 2 8 โมง")
--
-- โมเดล: **1 วัน = 1 แถว = 1 plan** (ไม่ใช่ 1 แถวหลายวัน) เพราะ:
--   - Lumos `stop_early` หยุด step ที่เหลือ**ของ plan** → plan=วัน = "รับสายยืนยันแล้ว
--     หยุดรอบที่เหลือของวันนั้น วันถัดไปโทรต่อ" ตรงคำเคาะ
--   - ถ้ายัด 14 step ในแถวเดียว bumpScheduledAtForward จะยุบ step ที่เลยเวลามากอง
--     พร้อมกัน (คนโดนโทรรัว) + ผลกลับ match ด้วย client_contact_id ตัวเดียว ทับกัน
--
-- group_id = ผูกทั้งชุด (7 วัน) เข้าด้วยกัน → ยกเลิกทั้งชุด/สรุปผลรายชุด/ปฏิเสธหยุดหมด
-- call_times = รอบเวลาของวันนั้น (เช่น {'07:00','08:00'}) → payload สร้าง steps ตามนี้
--
-- ⚠️ แถวเก่า (รอบเดี่ยว) group_id/call_times = null → พฤติกรรมเดิมทุกอย่าง (retry ปกติ)

alter table follow_entries
  add column if not exists group_id uuid null,
  add column if not exists call_times text[] null;

create index if not exists follow_entries_group_idx
  on follow_entries (group_id) where group_id is not null;

comment on column follow_entries.group_id is
  'ผูกหลายแถว (หลายวัน) เป็นชุดตารางเดียว — ยกเลิก/สรุปผลรายชุด · null = รอบเดี่ยวแบบเดิม';
comment on column follow_entries.call_times is
  'รอบเวลาของวันนั้น (HH:MM) — payload สร้าง steps ตามนี้ · null = ใช้ scheduled_at รอบเดียว';
