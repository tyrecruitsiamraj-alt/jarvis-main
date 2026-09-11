-- หลักฐานว่า Lumos **รับของเราไปแล้วจริง** (11 ก.ย. 2569)
--
-- 🔴 ปัญหา: ตอนนี้เรารู้แค่ "ยิงออกไปแล้วไม่ error" (`dispatch_state = 'queued'`)
-- แต่พิสูจน์ไม่ได้ว่าฝั่งเขารับไว้จริงไหม · เวลาไม่มีผลกลับมาจึงเถียงกันไม่จบว่า
-- ของไม่ถึงเขา หรือถึงแล้วแต่เขาไม่โทร — ต้องไปไล่ log บนเซิร์ฟเวอร์ทุกครั้ง
--
-- Lumos ตอบ `{ accepted, results: [{ event_id, status }] }` ตอนรับ push
-- เก็บ `event_id` ไว้ = มีเลขอ้างอิงเดียวกับเขา ถามได้ตรง ๆ ว่า event นี้ไปถึงไหน
-- (และมี `getLumosEventStatus()` ไว้เช็คสถานะทีหลังได้ด้วย)
--
-- ใครใช้: api/_lib/lumosDispatch.ts (เขียนตอน push สำเร็จ)
-- ⚠️ null = ยังไม่เคย push สำเร็จ หรือเป็นแถวเก่าก่อน migration นี้
--    **ห้ามตีความ null ว่า "เขาไม่รับ"**

alter table lumos_dispatch_queue
  add column if not exists push_event_id text,
  add column if not exists push_accepted_at timestamptz;

comment on column lumos_dispatch_queue.push_event_id is
  'event_id ที่ Lumos ตอบกลับตอนรับ push — เลขอ้างอิงร่วมกับฝั่งเขา · null = ยังไม่เคย push สำเร็จ';
comment on column lumos_dispatch_queue.push_accepted_at is
  'เวลาที่ Lumos ตอบรับ push ครั้งล่าสุด (ไม่ใช่เวลาที่โทร)';
