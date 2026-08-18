-- คำปิดงานติดตามชุดใหม่ (เจ้าของสั่ง 18 ส.ค. 2569:
-- *"ปุ่มเสร็จสิ้นเมื่อกดแล้วมีให้เลือกว่าเสร็จสิ้นเพราะไปแล้ว ถึงแล้ว หรือ ยกเลิก ลา เลื่อน"*
-- และเลือกให้ **ใช้ชุดใหม่แทน ของเก่าคงเดิม** ไม่แปลงข้อมูลย้อนหลัง)
--
-- ชุดใหม่ที่หน้าเว็บให้เลือก: went=ไปแล้ว · arrived=ถึงแล้ว · cancelled=ยกเลิก ·
--                            leave=ลา (รหัสเดิม ใช้ต่อ) · postponed=เลื่อน
--
-- 🔴 **CHECK ต้องรับทั้งคำเก่าและคำใหม่** — รายการที่ปิดไปแล้วยังถือรหัสเก่าอยู่จริง
-- (วัดเมื่อ 18 ส.ค. 2569: มีรายการปิดแล้วในฐาน) ตัดคำเก่าออกจาก CHECK เมื่อไหร่
-- = แถวเก่ากลายเป็นข้อมูลผิดกติกา และ UPDATE ใด ๆ บนแถวนั้นจะตกทันที
--
-- ⚠️ กับดักเดิมของโปรเจกต์นี้ (035 OPL · 097 online · source/result_scope):
-- เพิ่มค่าใหม่ต้อง **drop แล้วสร้าง CHECK ใหม่เสมอ** ไม่ใช่ add ทับ
-- ⚠️ และต้องกรอง schema — ฐานนี้มี schema `car_stamp` ของอีกแอปปนอยู่ ชื่อ constraint ซ้ำกันได้

alter table follow_entries drop constraint if exists follow_entries_outcome_code_check;

alter table follow_entries
  add constraint follow_entries_outcome_code_check
  check (outcome_code is null or outcome_code in (
    -- ชุดใหม่ที่หน้าเว็บให้เลือกตอนนี้
    'went', 'arrived', 'cancelled', 'leave', 'postponed',
    -- ชุดเก่า (095) — เก็บไว้เพราะรายการที่ปิดไปแล้วยังใช้รหัสเหล่านี้
    'done', 'job_cancelled', 'no_show_start', 'other'
  ));

comment on column follow_entries.outcome_code is
  'จบแบบไหน — ชุดที่ใช้ตอนนี้: went=ไปแล้ว · arrived=ถึงแล้ว · cancelled=ยกเลิก · leave=ลา · postponed=เลื่อน '
  '| ชุดเก่ายังอ่านได้: done=เสร็จสิ้น · job_cancelled=ยกเลิกงาน · no_show_start=ไม่ไปเริ่มงาน · other=อื่น ๆ';
