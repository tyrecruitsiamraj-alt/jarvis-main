-- คนที่เคยบอก AI ว่าไม่สนใจ (สายเสนองาน) = ไม่โทรอีกทุกใบขอ จนกว่าคนปลดที่ ตั้งค่า › บัญชีห้ามโทร
-- เจ้าของ 18 พ.ย. 2569 "ไม่โทรเลยถ้าเขาบอกไม่สนใจ" · "ทำไมต้องมีปุ่มหยุด ทำไมไม่หยุดเองเลย"
-- ผลโทรใหม่ลงบัญชีเองแล้ว (applyCallFollowupToQueueRow) · ไฟล์นี้เติมคนที่ปฏิเสธไปก่อนหน้า (~495 เบอร์ ณ 18 พ.ย. 2569)
-- เพิ่มอย่างเดียว: เบอร์ที่มีในบัญชีอยู่แล้วไม่แตะ (on conflict do nothing) · สายติดตามเริ่มงานไม่นับเหตุผลนี้ (listSuppressedPhones forFollow)
-- สายเสนองานที่ยังรอของเบอร์เหล่านี้ ตัวส่งซ้ำ (lumosPushRetryWorker ขั้น 0a) ยกเลิกให้เองทั้งในฐานและที่ Lumos
insert into candidate_call_suppression (phone_e164, suppressed_until, reason, note, created_by_name)
select distinct coalesce(q.payload->>'recipient_phone', q.payload->>'phone'),
       timestamptz '2099-12-31 00:00:00+07',
       'declined',
       'บอก AI ว่าไม่สนใจ (ย้อนหลัง)',
       'ระบบ'
  from lumos_dispatch_queue q
 where q.channel = 'interview'
   and q.last_outcome = 'declined'
   and coalesce(q.payload->>'recipient_phone', q.payload->>'phone') ~ '^\+66[0-9]{8,9}$'
on conflict (phone_e164) do nothing;
