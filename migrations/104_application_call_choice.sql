-- วงจร "กันชื่อดอง" (Phase 5.7-5.10 · เจ้าของเคาะ 22 ส.ค. 2569)
--
-- กติกาที่เคาะแล้ว: เก็บชื่อไป (claim) เกิน 1 วันโดยไม่มี dial stamp/ความคืบหน้า
--   → worker ถอด claim อัตโนมัติ + เตือนหัวหน้า → ใบเข้ากอง "เลือกวิธีโทร"
--   → ไม่เลือกภายใน 1 วัน → worker ส่งเข้าคิว AI โทรเอง (ผ่าน insertQueueItems)
--
-- คอลัมน์ชุดนี้คือ "สถานะปัจจุบันของวงจร" ต่อใบ (เขียนทับได้เมื่อวนรอบใหม่):
--   unclaimed_at        = เวลาที่ worker ถอด claim (null = ไม่ได้อยู่ในวงจร/มีคนเก็บใหม่แล้ว)
--   unclaimed_from_name = ชื่อคนที่โดนถอด (โชว์ให้หัวหน้า — ไม่ใช่ความลับแบบ claimed_by_name
--                         เพราะการโดนถอดคือเรื่องที่หัวหน้าต้องเห็น เจ้าของสั่งให้เตือนตรง ๆ)
--   call_choice         = วิธีโทรที่ถูกเลือก: manual (คนกดเก็บไปโทรเอง) · ai (คนกดส่ง AI)
--                         · auto_ai (ครบกำหนดแล้ว worker ส่งเอง) · null = ยังรอเลือก
--
-- ถัง "รอเลือกวิธีโทร" = unclaimed_at is not null and call_choice is null and claimed_by is null
-- (นิยามจริงอยู่ที่ api/_lib/applicantOverviewSql.ts — OVERVIEW_BUCKETS.awaiting_call_choice)

alter table public_job_applications
  add column if not exists unclaimed_at timestamptz null,
  add column if not exists unclaimed_from_name text null,
  add column if not exists call_choice text null,
  add column if not exists call_choice_at timestamptz null,
  add column if not exists call_choice_by_name text null;

-- กันค่าปนเปื้อน — เลือกได้ 3 ทางเท่านั้น (null = ยังไม่เลือก)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'public_job_applications_call_choice_check'
  ) then
    alter table public_job_applications
      add constraint public_job_applications_call_choice_check
      check (call_choice is null or call_choice in ('manual', 'ai', 'auto_ai'));
  end if;
end $$;

-- worker + ถัง drill-down สแกนเฉพาะใบที่ค้างอยู่ในกอง — partial index เล็กและตรงคำถาม
create index if not exists public_job_applications_awaiting_choice_idx
  on public_job_applications (unclaimed_at)
  where unclaimed_at is not null and call_choice is null;

comment on column public_job_applications.unclaimed_at is
  'เวลาที่ worker ถอด claim เพราะดองเกิน 1 วัน (วงจรกันชื่อดอง Phase 5.7) — null = ไม่อยู่ในวงจร';
comment on column public_job_applications.call_choice is
  'วิธีโทรที่เลือกหลังถูกถอด: manual/ai/auto_ai · null = รอเลือก (เกิน 1 วัน worker ส่ง AI เอง)';
