-- ═══ แผนติดตามที่จบแล้วที่ Lumos — ห้ามส่งคำสั่งยกเลิกซ้ำ (เจ้าของ 9 ต.ค. 2569 "ถ้ามันผิดที่เราก็ต้องแก้ที่เรา") ═══
--
-- เคสจริง 9 ต.ค. 2569 (Lumos ขึ้น "ยกเลิก" ทั้ง 3 เคส · ฐานเรายัง "รอโทร"):
--   อิทธิชัย — 8 ต.ค. 08:39 ส่ง DELETE แผนวันที่ 8 (ตายไปแล้ว) ⇒ แผนวันที่ 9 ที่เพิ่งส่ง 08:19 ถูกยกเลิกตาม
--   ณัฐพล   — 8 ต.ค. 08:34 ส่ง DELETE แผนวันที่ 8 (ตายตั้งแต่ตอบไม่ไป 5 ต.ค.) ⇒ แผนวันที่ 9 ถูกยกเลิกตาม
--   สมชัย   — 8 ต.ค. 18:46:28 ส่ง DELETE แผนเก่าที่เพิ่งยกเลิกไป 8 วินาทีก่อน ⇒ แผน 07:00 ที่เพิ่งส่งใหม่ถูกยกเลิกตาม
-- ยกเลิกแผนที่ยังวิ่งอยู่ = ถูกต้องมาตลอด · พังเฉพาะ "สั่งยกเลิกแผนที่จบไปแล้วซ้ำ" ⇒ จำไว้ว่าแผนไหนจบแล้ว แล้วไม่ส่งอีก
--
-- lumos_dispatch_queue.lumos_plan_closed_at — ใช้ที่แถวหัวขบวน (person_ref = รหัสแผน)
--   ตั้งค่า: ส่ง DELETE สำเร็จ/404 · ตอบไม่ไป (Lumos ปิดทั้งชุดเอง)
--   ล้างค่า: ส่งแผนรหัสนี้ใหม่ (recordPushAck)
-- ตัวใช้: api/_lib/followLumosCancel.ts

alter table lumos_dispatch_queue
  add column if not exists lumos_plan_closed_at timestamptz;

comment on column lumos_dispatch_queue.lumos_plan_closed_at is
  'แผนติดตามนี้จบที่ Lumos แล้ว (ยกเลิกไปแล้ว/ตอบไม่ไป) — ห้ามส่ง DELETE ซ้ำ (ไปยกเลิกแผนอื่นของเบอร์เดียวกัน) · 9 ต.ค. 2569';

-- ── ของเดิม: ทำเครื่องหมายแผนที่รู้แน่ว่าจบแล้ว ──
-- ① ส่งยกเลิกซ้ำไปแล้ว (ตัวส่งยกเลิกซ้ำ 7 ต.ค.)
update lumos_dispatch_queue l
   set lumos_plan_closed_at = coalesce(l.updated_at, now())
 where l.channel = 'reminder' and l.job_ref = 'follow'
   and l.person_ref = coalesce(l.plan_ref, l.person_ref)
   and l.push_state = 'cancel_resent'
   and l.lumos_plan_closed_at is null;

-- ② ถึง Lumos ก่อนที่ชุดเดียวกันจะตอบไม่ไป (Lumos ปิดทั้งชุดตอนได้คำตอบไม่ไป)
update lumos_dispatch_queue l
   set lumos_plan_closed_at = d.declined_at
  from (
    select l2.id, max(coalesce(x.last_result_at, x.updated_at)) as declined_at
      from lumos_dispatch_queue l2
      join follow_entries f on l2.person_ref = 'follow-' || f.id::text
      join follow_entries g on g.group_id = f.group_id
      join lumos_dispatch_queue x
        on x.channel = 'reminder' and x.job_ref = 'follow' and x.person_ref = 'follow-' || g.id::text
     where l2.channel = 'reminder' and l2.job_ref = 'follow'
       and l2.person_ref = coalesce(l2.plan_ref, l2.person_ref)
       and l2.push_accepted_at is not null
       and f.group_id is not null
       and x.last_outcome = 'declined'
       and coalesce(x.last_result_at, x.updated_at) > l2.push_accepted_at
     group by l2.id
  ) d
 where l.id = d.id and l.lumos_plan_closed_at is null;

-- ③ ถึง Lumos แล้ว · ไม่เหลือสายรอโทร · มีสายที่เรายกเลิก (ยกเลิกไปแล้ว)
--    เว้นแผนที่ตัวส่งยกเลิกซ้ำยังต้องส่ง (แถวยกเลิก · นัดยังไม่ถึง · ยังไม่เคยส่งซ้ำ) — ให้มันส่งก่อน แล้วค่อยทำเครื่องหมายเอง
update lumos_dispatch_queue l
   set lumos_plan_closed_at = coalesce(l.updated_at, now())
 where l.channel = 'reminder' and l.job_ref = 'follow'
   and l.person_ref = coalesce(l.plan_ref, l.person_ref)
   and l.push_accepted_at is not null
   and l.lumos_plan_closed_at is null
   and not exists (
     select 1 from lumos_dispatch_queue y
      where y.channel = 'reminder' and y.job_ref = 'follow'
        and coalesce(y.plan_ref, y.person_ref) = l.person_ref and y.status = 'pending')
   and exists (
     select 1 from lumos_dispatch_queue y
      where y.channel = 'reminder' and y.job_ref = 'follow'
        and coalesce(y.plan_ref, y.person_ref) = l.person_ref and y.status = 'cancelled')
   and not exists (
     select 1 from lumos_dispatch_queue y
      join follow_entries e on y.person_ref = 'follow-' || e.id::text
      where y.channel = 'reminder' and y.job_ref = 'follow'
        and coalesce(y.plan_ref, y.person_ref) = l.person_ref
        and e.cancelled_at is not null and e.scheduled_at > now()
        and y.status = 'cancelled' and coalesce(y.push_state, '') <> 'cancel_resent');
