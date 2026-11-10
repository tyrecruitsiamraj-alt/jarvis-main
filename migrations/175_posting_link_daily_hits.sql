-- ═══ คลิกลิงก์สมัครรายวัน (เจ้าของ 10 พ.ย. 2569) ═══
-- "Tracking link หน่อยว่าคนคลิกเข้ามาเท่าไหร่ จะได้รู้ด้วยกลุ่มไหนคนเข้ามาดูงานเราเยอะ ต่อไปเวลาเลือกกลุ่ม Auto post ได้เลือกกลุ่มถูก"
-- เดิมมีแต่ `recruit_posting_links.hit_count` (ยอดสะสม ไม่รู้ว่าวันไหน) ⇒ เลือกช่วงวันที่ไม่ได้
-- ตารางนี้นับต่อ (ลิงก์ · วันไทย) · เก็บแค่ยอด ไม่มี IP/อุปกรณ์/คุกกี้ (กติกาเดียวกับ 115) · เริ่มนับวันที่ขึ้นเว็บ ของเก่าไม่มีรายวัน
-- เพิ่มอย่างเดียว · ไม่แตะข้อมูลเดิม
create table if not exists recruit_posting_link_hits (
  link_id uuid not null,
  day date not null,
  hits integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (link_id, day)
);
create index if not exists recruit_posting_link_hits_day_idx on recruit_posting_link_hits (day);
