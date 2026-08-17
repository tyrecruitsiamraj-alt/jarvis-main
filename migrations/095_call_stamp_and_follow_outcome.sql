-- 095 · จดเวลาโทรของคน + ปิดงานในหน้า Follow (เจ้าของสั่ง 17 ส.ค. 2569 "ของที่ยังขาดเติมให้ครบ")
--
-- 1) เวลาที่ **กดโทร** ของใบสมัคร — เดิมไม่มีที่เก็บเลย
--    ที่มีอยู่คือ `claimed_at` (เวลาเก็บเข้าถัง) กับเวลาที่บันทึกผลใน application_contact_logs
--    คนที่โทรแล้วไม่ติดจึงไม่มีร่องรอยว่าเคยโทร และวัด "เวลารอโทร" ไม่ได้จริง
--    ⚠️ ห้ามตั้งชื่อว่า last_call_at — ชื่อนั้นถูกใช้เป็นฟิลด์ derived ที่ API แนบมาให้แล้ว
--       (ผลโทรล่าสุดของเบอร์ จากคิว AI + ถังคนโทร) ชนกันเมื่อไหร่ตัวเลขสองความหมายปนกัน
alter table public_job_applications
  add column if not exists dialed_first_at timestamptz,
  add column if not exists dialed_last_at  timestamptz,
  add column if not exists dial_count      integer not null default 0;

comment on column public_job_applications.dialed_first_at is
  'เวลาที่กดโทรครั้งแรก — เขียนครั้งเดียว (coalesce) ห้ามมี reset ที่ไหนล้าง';
comment on column public_job_applications.dialed_last_at is
  'เวลาที่กดโทรครั้งล่าสุด';
comment on column public_job_applications.dial_count is
  'กดโทรไปแล้วกี่ครั้ง — คนละเรื่องกับจำนวนครั้งที่ AI โทร (อยู่ในคิว)';

-- ดึง "ใบที่กดโทรแล้วแต่ยังไม่บันทึกผล" ขึ้นมาก่อนได้เร็ว
create index if not exists idx_public_job_applications_dialed_last
  on public_job_applications (dialed_last_at desc nulls last);

-- 2) ปิดงานในหน้า Follow — เดิมทำได้อย่างเดียวคือยกเลิก (มีแค่ cancelled_at)
--    ไม่มีปุ่ม "เสร็จสิ้น" และไม่มีที่เก็บว่าจบแบบไหน จึงตอบไม่ได้ว่าคนหลุดเพราะอะไร
alter table follow_entries
  add column if not exists completed_at      timestamptz,
  add column if not exists outcome_code      text,
  add column if not exists outcome_note      text,
  add column if not exists completed_by      uuid,
  add column if not exists completed_by_name text;

-- ⚠️ ค่าที่รับได้ต้องตรงกับ FOLLOW_OUTCOMES ใน src/lib/followOutcome.ts (มีเทสต์ parity คุม)
--    เพิ่มค่าใหม่ต้องแก้ทั้งสองที่พร้อมกัน ไม่งั้นหน้าเว็บส่งค่าที่ฐานไม่รับ = 500
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'follow_entries_outcome_code_check'
  ) then
    alter table follow_entries
      add constraint follow_entries_outcome_code_check
      check (outcome_code is null or outcome_code in (
        'done', 'job_cancelled', 'no_show_start', 'leave', 'other'
      ));
  end if;
end $$;

comment on column follow_entries.completed_at is
  'ปิดงานเมื่อไหร่ — null = ยังไม่ปิด · คนละช่องกับ cancelled_at (ยกเลิกก่อนถึงวัน)';
comment on column follow_entries.outcome_code is
  'จบแบบไหน: done=เสร็จสิ้น · job_cancelled=ยกเลิกงาน · no_show_start=ไม่ไปเริ่มงาน · leave=ลา · other=อื่น ๆ';

create index if not exists idx_follow_entries_outcome
  on follow_entries (outcome_code) where outcome_code is not null;
