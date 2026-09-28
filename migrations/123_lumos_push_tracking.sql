-- ═══ บันทึกผลการส่งเข้า Lumos (push) ต่อแถวคิว — ให้สายใบสมัครที่ส่งไม่ถึงถูกส่งซ้ำได้ (28 ก.ย. 2569) ═══
--
-- 🔴 ปัญหาที่วัดเจอ (28 ก.ย. 2569 · อ่านอย่างเดียว):
--   Lumos **ไม่มาดึงคิวเราแล้ว** (`delivery_count` = 0 · `first_delivered_at` null ทุกแถว ~700 แถว)
--   ทุกสายไปถึงเขาทาง push เท่านั้น ⇒ push ตอนกรอกใบสมัครล้มครั้งเดียว = สายค้าง `pending` ถาวร
--   (ใบสมัคร OPL6909083 3 ใบ ค้าง 2–4 วัน ไม่มีใครโทรเลย · ระบบยังนับว่า "อยู่ในคิว AI")
--   งานติดตามเคยเจอแบบเดียวกัน 11 ก.ย. และมีตัวส่งซ้ำแล้ว (`follow_entries.dispatch_state`) — ใบสมัครยังไม่มี
--
-- ⇒ จด "ส่งถึงหรือยัง" ไว้ที่แถวคิวเอง ให้ตัวส่งซ้ำ (`applicationPushRetryWorker`) หยิบแถวที่ล้มไปยิงใหม่
-- ⚠️ ห้ามใช้สถานะ `pending` แทน — ในโหมด push แถวที่ส่งถึงแล้วก็ยัง `pending` จนกว่าผลโทรจะกลับ
-- ⚠️ ไม่ใส่ CHECK (กับดักซ้ำของโปรเจกต์) — ค่าที่ใช้คุมในโค้ด: push_pending · pushed · push_failed ·
--    push_skipped · push_gave_up · แถวเก่าก่อน migration นี้ = NULL (ตัวส่งซ้ำไม่แตะ)

alter table lumos_dispatch_queue add column if not exists push_state text null;
alter table lumos_dispatch_queue add column if not exists push_attempts integer not null default 0;
alter table lumos_dispatch_queue add column if not exists push_started_at timestamptz null;
alter table lumos_dispatch_queue add column if not exists pushed_at timestamptz null;
alter table lumos_dispatch_queue add column if not exists push_failed_at timestamptz null;
alter table lumos_dispatch_queue add column if not exists push_error text null;

-- ตัวส่งซ้ำอ่านเฉพาะแถวที่ยังต้องตาม — index บางเฉพาะกลุ่มนั้น
create index if not exists lumos_dispatch_queue_push_retry_idx
  on lumos_dispatch_queue (push_state, push_started_at)
  where push_state in ('push_failed', 'push_pending');

comment on column lumos_dispatch_queue.push_state is
  'ผลการส่งเข้า Lumos (push): push_pending กำลังส่ง · pushed ถึงแล้ว · push_failed ส่งไม่ถึง รอส่งซ้ำ · '
  'push_skipped ไม่ส่งแล้ว (มีคนรับไป/เบอร์ถูกพัก) · push_gave_up ส่งไม่ถึงเกินเพดาน โยนให้เจ้าหน้าที่ · NULL = แถวเก่า';
comment on column lumos_dispatch_queue.push_attempts is 'ยิง push ไปกี่ครั้งแล้ว (รวมครั้งแรกตอนเข้าคิว)';
comment on column lumos_dispatch_queue.push_started_at is 'เริ่มยิงครั้งล่าสุดเมื่อไหร่ — push_pending ค้างเกิน 10 นาที = ถือว่าล้ม (เครื่องรีสตาร์ตกลางทาง)';
comment on column lumos_dispatch_queue.pushed_at is 'ส่งถึง Lumos ครั้งแรกเมื่อไหร่ (เขียนครั้งเดียว)';
comment on column lumos_dispatch_queue.push_failed_at is 'ส่งไม่ถึงครั้งแรกเมื่อไหร่ (เขียนครั้งเดียว)';
comment on column lumos_dispatch_queue.push_error is 'เหตุล่าสุดที่ส่งไม่ถึง/ไม่ส่ง — ไว้อ่านตอนไล่ปัญหา';
