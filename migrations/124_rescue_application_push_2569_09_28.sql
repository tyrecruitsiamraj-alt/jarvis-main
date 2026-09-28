-- ═══ กู้ใบสมัคร 3 ใบที่ส่งไม่ถึง Lumos — OPL6909083 (24 ก.ย. ×2 · 26 ก.ย. 2569) ═══
--
-- ไล่พบ 28 ก.ย. 2569 (อ่านอย่างเดียว): เข้าคิววินาทีเดียวกับที่กรอก · payload ปกติเหมือนใบข้าง ๆ ทุกอย่าง ·
-- ไม่มีเบอร์ซ้ำ · ไม่มีใครรับไปโทร/บันทึกผลเลย · ไม่เคยได้ผลโทร ⇒ push ตอนกรอกไม่ถึง Lumos แล้วไม่มีใครส่งซ้ำ
--
-- เจ้าของเลือก Choice 28 ก.ย. 2569: **"ส่งให้ Lumos โทรพรุ่งนี้ 9 โมง"**
-- ⇒ ตั้งเป็น push_failed + นัด 29 ก.ย. 2569 09:00 น. (เวลาไทย) ให้ตัวส่งซ้ำ (migration 123) หยิบไปยิง
--   ตัวส่งซ้ำยิงหลังพ้นช่วงห้ามโทร (08:00) · นัดเวลาโทร 09:00 · Idempotency-Key + client_interview_id เดิม
--   ⇒ ถ้า Lumos เคยได้ไปแล้วจะตัดซ้ำเอง ไม่เกิดสายที่สอง
--
-- 🔴 แตะเฉพาะ 3 id นี้ และเฉพาะตอนที่ยังค้างจริง (pending · ยังไม่มีผล · ยังไม่เคยจดผลส่ง)
--    ผลโทรกลับมาก่อน deploy / มีคนแก้ไปแล้ว = ไม่แตะ

update lumos_dispatch_queue
   set push_state = 'push_failed',
       push_failed_at = coalesce(push_failed_at, now()),
       push_error = 'ส่งไม่ถึง Lumos ตอนกรอกใบสมัคร (ไล่พบ 28 ก.ย. 2569) · เจ้าของสั่งส่งใหม่ให้โทร 29 ก.ย. 09:00',
       next_attempt_at = timestamptz '2026-09-29 09:00:00+07'
 where id in (17628, 17630, 17690)
   and channel = 'interview'
   and person_ref like 'app-%'
   and status = 'pending'
   and result is null
   and last_outcome is null
   and push_state is null;
