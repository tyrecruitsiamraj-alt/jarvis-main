-- ═══ "ติดตามครั้งที่" ตอนเพิ่มคน (เจ้าของสั่ง 6 ต.ค. 2569) ═══
-- > "ในขั้นตอนที่ 3 ตั้งเวลา เพิ่มหัวข้อ ติดตามครั้งที่ (ในระบุเวลาเองและตารางหลายวัน)"
--
-- follow_entries.plan_day_start — เลข "ติดตามครั้งที่" ของวันแรกในชุด (เช่น คนนี้เคยตามไปแล้ว 2 ครั้ง ชุดใหม่เริ่มที่ 3)
-- เลขวันบนจอ (วันที่ D · ตัวกรอง "วันที่ของแผน" · รายงาน) = plan_day_start + จำนวนวันนับจากวันแรกของชุด
-- null = นับ 1 ตามเดิม (ทุกแถวเก่าไม่เปลี่ยน) · คิดที่ src/lib/followDayCall.ts

alter table follow_entries
  add column if not exists plan_day_start smallint;

alter table follow_entries
  drop constraint if exists follow_entries_plan_day_start_range;
alter table follow_entries
  add constraint follow_entries_plan_day_start_range check (plan_day_start is null or plan_day_start between 1 and 99);

comment on column follow_entries.plan_day_start is
  'ติดตามครั้งที่ของวันแรกในชุด (ตั้งตอนเพิ่มคน ขั้น 3) — null = 1 · เลขวันบนจอ = ค่านี้ + วันนับจากวันแรกของชุด · 6 ต.ค. 2569';
