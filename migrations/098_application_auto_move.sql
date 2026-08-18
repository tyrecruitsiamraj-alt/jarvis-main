-- ย้ายใบสมัครอัตโนมัติเมื่อใบขอที่เขาสมัครไว้ถูกปิด (เจ้าของสั่ง 17 ส.ค. 2569:
-- *"ถ้าเขากรอกมาจากหน้าสาธารณะแล้วถ้าใบขอนั้นถูกปิดไปชื่อไปไหน สามารถย้ายไปงานที่
-- พื้นที่ใกล้เคียงกันได้ไหม ย้ายแบบ auto นะ"*)
--
-- ปัญหาเดิม: ใบสมัครยังชี้ `job_id` ของใบที่ปิดแล้ว สถานะยังเป็น 'new' แต่ใบขอหลุดจาก
-- บอร์ดไปแล้ว → **ไม่มีใครหยิบไปทำ** คนนั้นหายจากกระบวนการเงียบ ๆ
--
-- 🔴 **ไม่ทับ `job_id` ทิ้ง** — เก็บใบเดิมไว้ที่ `moved_from_job_id` เสมอ
-- ย้ายผิด = ต้องย้อนกลับได้ และต้องตอบได้ว่า "ทำไมคนนี้มาโผล่ในใบนี้"
-- (ระบบเดินเองแล้วไม่มีร่องรอย = ตรวจสอบไม่ได้ ซึ่งอันตรายกว่าปัญหาที่กำลังแก้)

alter table public_job_applications
  add column if not exists moved_from_job_id text null,
  add column if not exists moved_at timestamptz null,
  add column if not exists moved_reason text null;

comment on column public_job_applications.moved_from_job_id is
  'ใบขอเดิมก่อนถูกย้ายอัตโนมัติ — ไว้ย้อนกลับและตอบว่าคนนี้มาจากใบไหน';
comment on column public_job_applications.moved_reason is
  'เหตุผลที่ย้าย เช่น closed_request:same_district — เก็บเป็นข้อความอ่านออก';

-- ตามรอยใบที่ถูกย้ายได้เร็ว (หน้าจอมีถัง "ย้ายมาอัตโนมัติ")
create index if not exists public_job_applications_moved_at_idx
  on public_job_applications (moved_at desc) where moved_at is not null;
