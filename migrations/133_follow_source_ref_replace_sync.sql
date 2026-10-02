-- ═══ ดึงรายชื่อส่งคนแทนจาก iRecruit เข้าแท็บติดตามส่งคนแทน (2 ต.ค. 2569) ═══
--
-- เจ้าของส่ง SQL ของหน้า "จัดเวรติดตาม" (iRecruit) มาเอง และเคาะ: ดึงเองทุกเช้า · เวลาโทรตั้งได้ · AI โทรเลย
--
-- 1) follow_entries.source_ref — คีย์ต้นทางของสายที่ระบบดึงมาเอง (`irecruit-replace:<job_id>`)
--    🔴 unique (เฉพาะที่มีค่า) = ดึงซ้ำกี่รอบก็ไม่สร้างสายซ้ำ ไม่โทรซ้ำ — ฐานเป็นคนตัดสิน ไม่ใช่ลำดับโค้ด
--    สายที่คนกรอกเอง = null (ของเดิมไม่กระทบ)
-- 2) app_irecruit_replace_sync — กติกาเวลาโทร + ผลการดึงรอบล่าสุด (รูปเดียวกับ app_lumos_dispatch_mode)
--    payload: { "rule": { "dayOffset": -1, "time": "18:00" }, "lastRun": { ...ReplaceSyncSummary } }
--    ไม่มีแถว/ไม่มีตาราง = กติกาค่าเริ่มต้น (18:00 ของวันก่อนเข้างาน) · โค้ดขึ้นก่อน migration ⇒ เส้นตอบว่า "ฐานยังไม่พร้อม" ไม่สร้างสาย

alter table follow_entries
  add column if not exists source_ref text;

create unique index if not exists follow_entries_source_ref_uq
  on follow_entries (source_ref)
  where source_ref is not null;

comment on column follow_entries.source_ref is
  'ต้นทางของสายที่ระบบดึงมาเอง เช่น irecruit-replace:<job_id> — unique กันดึงซ้ำ · null = คนกรอกเอง · 2 ต.ค. 2569';

create table if not exists app_irecruit_replace_sync (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by_name text null
);

comment on table app_irecruit_replace_sync is
  'กติกาเวลาโทร + ผลดึงรอบล่าสุดของการดึงส่งคนแทนจาก iRecruit — แถวเดียว id=default · 2 ต.ค. 2569';
