-- ═══ หน้าติดตาม: "ยังไม่ชัวร์เวลา" + ผลปิดงาน "จำวันผิด" (เจ้าของไล่ Journey 3 ต.ค. 2569) ═══
--
-- 1) follow_entries.time_tbd — สายที่รู้วันแต่ **ยังไม่กำหนดเวลา** (Journey ข้อ 5)
--    แถวถือเวลาแทน (เที่ยงคืนของวันนั้น) ไว้ให้ปฏิทินจัดวันได้ · จอโชว์ "ยังไม่ระบุเวลา" แทนเวลา
--    🔴 สายแบบนี้เป็นคนโทรเสมอ (API บังคับ) — ห้ามส่งให้ AI จนกว่าจะตั้งเวลาจริง
--    ตั้งเวลาจริงเมื่อไหร่ (แก้ไข/แก้ตารางทั้งชุด) ธงนี้ถูกล้างเป็น false
-- 2) ผลปิดงานเพิ่ม 'wrong_date' = จำวันผิด (เจ้าหน้าที่ลงวันผิดเอง — Journey ข้อ 10)
--    กับดักเดิม: เพิ่มค่าใน CHECK ต้อง drop แล้วสร้างใหม่ + แก้ src/lib/followOutcome.ts พร้อมกัน
--    (เทสต์ parity อ่านไฟล์นี้: tests/api/followOutcome.test.ts)

alter table follow_entries
  add column if not exists time_tbd boolean;

comment on column follow_entries.time_tbd is
  'ยังไม่กำหนดเวลาโทร — true = เวลาใน scheduled_at เป็นค่าแทน (เที่ยงคืน) จอโชว์ "ยังไม่ระบุเวลา" · ตั้งเวลาจริงแล้วล้างเป็น false · 3 ต.ค. 2569';

alter table follow_entries drop constraint if exists follow_entries_outcome_code_check;

alter table follow_entries
  add constraint follow_entries_outcome_code_check
  check (outcome_code is null or outcome_code in (
    -- ชุดที่หน้าเว็บให้เลือกตอนนี้ (101 + wrong_date จาก 134)
    'went', 'arrived', 'cancelled', 'leave', 'postponed', 'wrong_date',
    -- ชุดเก่า (095) — รายการที่ปิดไปแล้วยังใช้รหัสเหล่านี้
    'done', 'job_cancelled', 'no_show_start', 'other'
  ));

comment on column follow_entries.outcome_code is
  'จบแบบไหน — ชุดที่ใช้ตอนนี้: went=ไปแล้ว · arrived=ถึงแล้ว · cancelled=ยกเลิก · leave=ลา · postponed=เลื่อน · wrong_date=จำวันผิด (ฝั่งเรา) '
  '| ชุดเก่ายังอ่านได้: done=เสร็จสิ้น · job_cancelled=ยกเลิกงาน · no_show_start=ไม่ไปเริ่มงาน · other=อื่น ๆ';
