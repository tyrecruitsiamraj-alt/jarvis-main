-- ═══ บอร์ดรายชื่อรอลงงาน: ปุ่มบนบอร์ดเก็บฝั่ง Jarvis (เจ้าของ 3 พ.ย. 2569 "ถ้าแค่ดึงขึ้นมาแล้วเปลี่ยนสถานะหล่ะ" → Choice "ทุกปุ่มบนบอร์ด") ═══
-- บัญชี ERP ของ Jarvis (team.dashboard) อ่านอย่างเดียว ⇒ ชื่อ/ประวัติ/การ์ดใหม่ยังดึงจาก ERP · การกดบน Jarvis จดที่นี่
-- 1 แถว = 1 ครั้งที่กด (เพิ่มอย่างเดียว ห้ามแก้แถวเก่า) · ตัวรวมกับ ERP = api/_lib/erpBoardMerge.ts
-- ชนกัน: "อันที่เปลี่ยนล่าสุดชนะ" เทียบเวลากับ ERP ทีละเรื่อง (ช่อง · ใบขอ · ผู้ดูแล · ข้อตรวจ) — คนย้ายมาใช้ Jarvis หมด = Jarvis ชนะเอง
create table if not exists erp_board_events (
  id bigserial primary key,
  card_id integer not null,
  -- move · step · link · unlink · check · uncheck · assign · unassign · tag · untag · call · comment · comment_delete
  kind text not null,
  column_id integer null,
  from_column_id integer null,
  step_id integer null,
  outcome_id integer null,
  scheduled_at timestamptz null,
  request_no text null,
  item_id integer null,
  staff_id text null,
  staff_name text null,
  tag_id integer null,
  body text null,
  ref_event_id bigint null,
  actor_user_id uuid null,
  actor_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists erp_board_events_card_idx on erp_board_events (card_id, created_at);
