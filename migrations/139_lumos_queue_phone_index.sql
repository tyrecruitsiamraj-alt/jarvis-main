-- ═══ ดัชนีเบอร์ + person_ref ของคิวโทร (8 ต.ค. 2569 · เจ้าของ "แก้ให้เร็วขึ้นเลย") ═══
--
-- ปัญหา: คิวรีภาพรวมผู้สมัคร (`buildOverviewSql` · แท็บภาพรวมของกล่องงาน) ใช้ ~17 วิ ทั้งที่ใบสมัคร 341 · คิว 2,145 แถว
-- EXPLAIN ANALYZE: ทุกใบไล่หา "ผลบนเบอร์เดียวกัน" ด้วย Seq Scan ทั้งคิว (~7 ms × 341 ใบ × หลายสิบ subquery)
--   เงื่อนไข `coalesce(payload->>'recipient_phone', payload->>'phone') = a.phone_e164` ไม่มีดัชนีให้ใช้
--   และ `person_ref = 'app-' || a.id` ใช้ดัชนี (channel, job_ref, person_ref) ไม่ได้เพราะไม่ได้ระบุ channel
-- แก้ที่ดัชนี — ไม่แตะนิยามใด ๆ (เลขเดิมทุกตัว · ตัวตรวจเลขหน้าหลัก + เทสต์ parity คุม)
-- 🔴 นิพจน์ต้องเหมือน `QUEUE_PHONE` ใน api/_lib/applicantOverviewSql.ts ทุกตัวอักษร ไม่งั้นตัววางแผนไม่หยิบ

create index if not exists lumos_dispatch_queue_phone_expr_idx
  on lumos_dispatch_queue ((coalesce(payload->>'recipient_phone', payload->>'phone')));

create index if not exists lumos_dispatch_queue_person_ref_idx
  on lumos_dispatch_queue (person_ref);
