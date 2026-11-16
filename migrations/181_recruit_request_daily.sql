-- ยอดใบขอเหลือหารายวัน (เจ้าของ 16 พ.ย. 2569 Choice "เพิ่ม จดทุกคืน") — ภาพรวมเรื่องใบขอเหลือหา / เริ่มหาแล้ว เทียบย้อนหลังได้
-- ตัวจด `api/_lib/requestDailySnapshot.ts` เขียนทับยอดของวันนี้ทุกชั่วโมง · ตารางใหม่ เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
create table if not exists recruit_request_daily (
  day date not null,
  bu text not null,
  phase text not null,
  started boolean not null,
  requests integer not null default 0,
  positions integer not null default 0,
  recorded_at timestamptz not null default now(),
  primary key (day, bu, phase, started)
);
