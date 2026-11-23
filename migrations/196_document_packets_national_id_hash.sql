-- ═══ iRecruit ดึงเอกสารด้วยเลขบัตรประชาชน (เจ้าของ 23 พ.ย. 2569 "เฉพาะคนที่บัตรประชาชนตรงกับ irecruit") ═══
-- แฮชเลขบัตร (HMAC ด้วยกุญแจระบบ — ย้อนเป็นเลขบัตรไม่ได้) ไว้ค้นชุดเอกสาร · เพิ่มอย่างเดียว
-- ชุดก่อนมีคอลัมน์นี้ = null (โค้ดถอดรหัสเทียบทีละชุด อ่านอย่างเดียว) · ล้างตาม PDPA = ล้างค่านี้ด้วย
alter table document_packets add column if not exists national_id_hash text null;
create index if not exists document_packets_national_id_hash_idx
  on document_packets (national_id_hash, submitted_at desc) where erased_at is null;
