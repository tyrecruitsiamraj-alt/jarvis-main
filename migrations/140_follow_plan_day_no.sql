-- ═══ "ติดตามครั้งที่" เลือกรายวัน (เจ้าของสั่ง 8 ต.ค. 2569) ═══
-- > "ย้ายให้มันอยู่ตรงหน้าของวันที่เลือกติดตามได้มั้ย · พฤหัส เลือกติดตามครั้งที่ 1 · ศุกร์ ครั้งที่ 2 · เสาร์ ครั้งที่ 3 ไปเรื่อยๆ จนถึงครั้งที่ 7"
--
-- follow_entries.plan_day_no — เลข "ติดตามครั้งที่" ของวันของสายนี้ (ตั้งตรง ๆ จากตารางหลายวัน)
-- มีค่า = เลขวันบนจอใช้ค่านี้เลย · null = คิดแบบเดิม (plan_day_start + วันนับจากวันแรกของชุด · 137)
-- คิดที่ src/lib/followDayCall.ts

alter table follow_entries
  add column if not exists plan_day_no smallint;

alter table follow_entries
  drop constraint if exists follow_entries_plan_day_no_range;
alter table follow_entries
  add constraint follow_entries_plan_day_no_range check (plan_day_no is null or plan_day_no between 1 and 99);

comment on column follow_entries.plan_day_no is
  'ติดตามครั้งที่ของวันของสายนี้ (ตารางหลายวัน เลือกรายวัน) — null = คิดจาก plan_day_start · 8 ต.ค. 2569';
