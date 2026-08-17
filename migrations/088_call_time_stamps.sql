-- เวลาแบบเขียนครั้งเดียวห้ามแก้ (immutable stamps) บนสองตารางผลโทร
-- (เจ้าของสั่ง 15 ส.ค. 2569 — Dashboard visual control: "โทรแล้วเมื่อไหร่" / "เวลารอโทร")
--
-- ทำไมต้องมี: สถานะปัจจุบันของคิว **ถูก reset ได้** — ตั้งโทรซ้ำล้าง result/delivered_at
-- (callFollowup.ts) · revive แถวยกเลิกล้างถึง last_outcome (REVIVE_CANCELLED_SET ใน
-- lumosDispatch.ts) · updated_at ขยับทุกครั้งที่แตะแถว → นับ "โทรแล้ว" จากสถานะปัจจุบัน
-- = เลขถอยหลังได้เองเงียบ ๆ · สามคอลัมน์นี้เขียนแบบ coalesce(first_*, now()) แล้ว
-- **ห้ามอยู่ในรายการ reset ใด ๆ** (มีเทสต์ guard คุม — tests/api/callStampsGuard.test.ts)
--
--   first_delivered_at = Lumos ดึงงานไปครั้งแรก (delivered ≠ โทรแล้ว — แค่รับไป)
--   first_result_at    = มีผลกลับครั้งแรก → หลักฐาน "ถูกโทรแล้ว" ของ metric ทุกตัว
--   last_result_at     = ผลกลับล่าสุด (ใช้เทียบเวลาข้ามแหล่งแทน updated_at ที่ขยับมั่ว)
--   result_at (holds)  = เวลาบันทึกผลของคนโทร (updated_at ของ holds ก็ขยับมั่วเหมือนกัน)

alter table lumos_dispatch_queue
  add column if not exists first_delivered_at timestamptz null,
  add column if not exists first_result_at   timestamptz null,
  add column if not exists last_result_at    timestamptz null;

-- backfill แถวเก่าที่มีผลค้างอยู่ = **ค่าประมาณ** (updated_at เคยขยับหลังได้ผล)
-- dashboard ติดธง partial-history "แม่นตั้งแต่วันรัน 088" — ห้ามเอาไปอ้างเป็นเวลาเป๊ะ
update lumos_dispatch_queue
   set first_result_at = updated_at, last_result_at = updated_at
 where coalesce(last_outcome, result->>'outcome') is not null
   and first_result_at is null;

update lumos_dispatch_queue
   set first_delivered_at = coalesce(delivered_at, updated_at)
 where first_delivered_at is null
   and (delivered_at is not null or status in ('delivered', 'completed', 'failed'));

alter table candidate_call_holds
  add column if not exists result_at timestamptz null;

update candidate_call_holds
   set result_at = coalesce(updated_at, released_at, held_at)
 where result_outcome is not null and result_at is null;
