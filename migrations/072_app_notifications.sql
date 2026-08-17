-- แจ้งเตือนในแอป — เดิมเหตุการณ์ฝั่ง server (ผลโทรกลับ · ชุดรออนุมัติ) จบแบบเงียบ ๆ
-- ระบบดีแค่ไหนก็ช้าเท่าคนเปิดหน้าจอ · ตารางนี้คือกล่องขาเข้าของแต่ละคน
--
-- ผู้รับเป็น "รายคน" เสมอ — แจ้งทั้ง role ใช้วิธี fan-out ตอนสร้าง (ผู้ใช้ภายในหลักสิบคน)
-- เพราะสถานะอ่านแล้ว/ยัง ผูกกับคนอ่านทีละคน แชร์แถวเดียวข้าม role ไม่ได้

create table if not exists app_notifications (
  id bigserial primary key,
  recipient_user_id uuid not null,

  -- ชนิดเหตุการณ์ เช่น call_confirmed / needs_human / batch_pending
  type text not null,
  title text not null,
  body text null,
  -- path ในแอปที่กดแล้วพาไป เช่น /follow
  link text null,

  -- กันสร้างซ้ำต่อคนต่อเหตุการณ์ (เช่น ingest ผลโทรเดิมซ้ำ) — null = ไม่ต้องกัน
  dedupe_key text null,

  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create unique index if not exists app_notifications_dedupe_idx
  on app_notifications (recipient_user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists app_notifications_inbox_idx
  on app_notifications (recipient_user_id, read_at, created_at desc);
