-- ═══ รหัสแผนที่ Lumos รู้จัก แยกจากรหัสแผนของเรา (เจ้าของ 21 ต.ค. 2569 "แก้ที่เรา + ส่งรายชื่อ") ═══
--
-- เคสจริง 21 ต.ค. 2569: กดยกเลิกแล้ว AI ยังโทร — แผนที่ส่งซ้ำด้วย client_contact_id เดิม (แก้ตาราง/ซิงก์ iRecruit)
-- DELETE ไม่ได้ผล: 4 วันล่าสุด โทรหลังยกเลิก 51 จาก 61 สาย · แผนที่ส่งครั้งเดียว 1 จาก 45 สาย
-- ⇒ ส่งแผนซ้ำใช้รหัสใหม่ทุกครั้ง `follow-<uuid>-g<เวลา>` แล้วจดไว้ตรงนี้ (แถวหัวขบวน) ให้ DELETE ยิงรหัสนี้
--
-- lumos_dispatch_queue.lumos_client_id — null = รหัสเดียวกับ person_ref (แผนที่ส่งครั้งแรก/ของเก่า)
-- ตัวใช้: api/_lib/followLumosCancel.ts · api/_lib/lumosDispatch.ts (recordPushAck) · api/_lib/followPushRetryWorker.ts

alter table lumos_dispatch_queue
  add column if not exists lumos_client_id text;

comment on column lumos_dispatch_queue.lumos_client_id is
  'client_contact_id ที่ส่งให้ Lumos จริงของแผนนี้ (ส่งซ้ำ = รหัสใหม่ -g<เวลา>) · null = person_ref · 21 ต.ค. 2569';
