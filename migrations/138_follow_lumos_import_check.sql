-- ═══ เช็กว่า Lumos นำแผนติดตามเข้าระบบจริง + เตือนเมื่อสาย AI เลยเวลาไม่มีผล (เจ้าของ 8 ต.ค. 2569) ═══
-- > "ครบหมดเมื่อวานก็ครบหมด แต่ไม่โทรแล้วมันจะเกิดอีกไหมหล่ะ" → Choice "ทำทั้งสองชั้น"
--
-- ที่มา: แผนของอิทธิชัย 8 ต.ค. Lumos ตอบรับคำขอ (push_accepted_at) แต่ไม่โทร — คำตอบรับ = "ได้รับคำขอแล้ว"
-- ยังไม่ใช่ "นำเข้าสำเร็จ" · Lumos มี GET /events/{id} บอก imported / failed / discarded แต่เราไม่เคยถาม
--
-- ชั้น 1 (แถวหัวขบวนของแผน): lumos_import_status = ค่าที่ Lumos ตอบล่าสุด (pending · processing · imported · failed · discarded)
--   ล้ม/ถูกทิ้ง = ส่งแผนใหม่ 1 ครั้ง (lumos_import_retries) · ยังไม่ผ่าน = follow_entries.dispatch_state 'not_imported' + แจ้งเตือน
-- ชั้น 2 (ทุกแถว AI): overdue_alerted_at = แจ้งทีมแล้วว่าเลยเวลา 15 นาทีไม่มีผล (แจ้งครั้งเดียว · ไม่สลับเป็นคนโทรเอง)
-- ⚠️ ไม่ใส่ CHECK (กับดักซ้ำของโปรเจกต์) — ค่าคุมในโค้ด api/_lib/followLumosWatch.ts

alter table lumos_dispatch_queue add column if not exists lumos_import_status text null;
alter table lumos_dispatch_queue add column if not exists lumos_import_checked_at timestamptz null;
alter table lumos_dispatch_queue add column if not exists lumos_import_error text null;
alter table lumos_dispatch_queue add column if not exists lumos_import_retries integer not null default 0;
alter table lumos_dispatch_queue add column if not exists overdue_alerted_at timestamptz null;

comment on column lumos_dispatch_queue.lumos_import_status is
  'สถานะนำเข้าแผนที่ Lumos ตอบล่าสุด (เฉพาะแถวหัวขบวนงานติดตาม): pending · processing · imported · failed · discarded · NULL = ยังไม่เคยถาม';
comment on column lumos_dispatch_queue.lumos_import_retries is 'ส่งแผนใหม่เพราะ Lumos นำเข้าไม่สำเร็จไปกี่ครั้ง (เพดาน 1)';
comment on column lumos_dispatch_queue.overdue_alerted_at is 'แจ้งทีมแล้วว่าสาย AI เลยเวลานัด 15 นาทียังไม่มีผล (ครั้งเดียวต่อสาย)';
