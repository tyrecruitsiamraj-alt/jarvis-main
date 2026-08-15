-- เส้นส่งใบสมัครเข้าคิว AI โทร (S8 · เจ้าของเคาะ 15 ส.ค. 2569: ส่งอัตโนมัติตอนกรอก)
--
-- ⚠️ **ไม่มีการเปลี่ยน schema** — เส้นนี้ reuse ของเดิมทั้งหมด:
--   - lumos_dispatch_queue.person_ref เป็น text อยู่แล้ว → prefix ใหม่ `app-<uuid>`
--     ไม่ต้องแก้คอลัมน์ (ต่างจาก card-<id>/ir-<id>/follow-<id> ที่เป็น text เหมือนกัน)
--   - candidate_call_holds.source รับ 'application' แล้วตั้งแต่ migration 077
--   - unique (channel, job_ref, person_ref) เดิมกันซ้ำ + revive ได้เหมือนช่องอื่น
--
-- migration นี้เป็น **หมุดบอกลำดับ** (marker) ให้ schema_migrations เดินต่อเป็น 090
-- และเป็นที่บันทึกว่าฟีเจอร์นี้เปิดใช้ที่ระดับโค้ด — คุมด้วย env
-- APPLICATION_AUTO_DISPATCH_ENABLED (default ปิด — fail-safe ไปทาง manual)
--
-- ไม่มี DDL โดยตั้งใจ · ถ้าอนาคตต้อง index person_ref แบบ app-% ค่อยเพิ่มที่ migration ใหม่

select 1;
