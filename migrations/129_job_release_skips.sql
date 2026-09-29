-- 129 · "ไม่ปล่อย + เหตุผล" — ทะเบียนใบขอที่ทีม Online ตัดสินว่าไม่ปล่อยประกาศ พร้อมเหตุผล
--
-- เจ้าของสั่ง 29 ก.ย. 2569 (หน้าทีม Online รอบ 5): อัตราที่ขอเข้ามาต้องแยก
-- *"Approve แล้ว · รอดำเนินการ · ไม่อนุมัติ … พอเอาเม้าไปจี้ขึ้นบอกว่า ไม่อนุมัติเพราะอะไร"*
-- ระบบไม่เคยมีข้อมูลนี้ (ใบขอจาก ERP เป็นสถานะอนุมัติทั้งหมด · ไม่มีช่องเหตุผล)
-- → Choice **"เพิ่มปุ่ม ไม่ปล่อย + เหตุผล ที่กล่องงาน"** ⇒ ตัวเลข "ไม่อนุมัติ" เริ่มนับตั้งแต่วันที่เริ่มกด
--
-- แพตเทิร์นเดียวกับ `job_public_releases` (103): หนึ่งใบหนึ่งแถว · ยกเลิก "ไม่ปล่อย" = ลบแถว
-- ⚠️ `job_id` เป็น text (ใบขอมาจาก ERP ไม่ใช่ตารางใน pg นี้) · ต้องเก็บ **id เต็ม**
--    (`siamraj-sql:OPL6908001` / `siamraj-pre:LBM6908001`) — ไม่มี FK
-- ⚠️ **ไม่ใส่ CHECK บน reason** — บ้านนี้โดน CHECK ล็อกค่าใหม่มาสองรอบแล้ว (source / result_scope)
--    ค่าที่ใช้ได้อยู่ที่ `src/lib/jobReleaseSkips.ts` (`RELEASE_SKIP_REASONS`) · ตรวจที่ handler

create table if not exists job_release_skips (
  job_id text primary key,
  request_no text null,
  reason text not null,
  note text null,
  skipped_at timestamptz not null default now(),
  skipped_by uuid null,
  skipped_by_name text null
);

create index if not exists job_release_skips_skipped_at_idx
  on job_release_skips (skipped_at desc);

comment on table job_release_skips is
  'ใบขอที่ทีม Online ตั้งว่า "ไม่ปล่อย" พร้อมเหตุผล — ไม่มีแถว = ยังไม่ได้ตัดสิน '
  '(เจ้าของสั่ง 29 ก.ย. 2569 · หน้าทีม Online ก้อน "ไม่อนุมัติ")';
comment on column job_release_skips.job_id is
  'id เต็มของใบขอจาก ERP เช่น siamraj-sql:OPL6908001 — ห้ามเก็บเลขที่ใบขอเปล่า ๆ';
comment on column job_release_skips.reason is
  'คีย์เหตุผล: incomplete / unit_hold / filled / other (ป้ายอยู่ที่ src/lib/jobReleaseSkips.ts)';
