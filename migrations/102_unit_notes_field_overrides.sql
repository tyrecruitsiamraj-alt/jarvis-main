-- ค่าที่ทีมแก้เองก่อนปล่อยประกาศ (รายได้ · พื้นที่ · สวัสดิการ) ของใบขอฝั่งเรา
--
-- 🔴 ทำไมต้องมี migration นี้: คอลัมน์ `field_overrides` **มีอยู่บนฐานจริงแล้ว** แต่ถูกสร้าง
-- ด้วยสคริปต์มือ `scripts/migrate-field-overrides.mjs` ไม่ได้อยู่ในลำดับ migration
-- ผลคือ:
--   1. ฐานใหม่ (เครื่องคนอื่น / staging) รัน `npm run db:migrate` แล้ว **ไม่ได้คอลัมน์นี้**
--      โค้ดจึงตกลงไปใช้ทาง `hasColumn()` fallback ใน api/_lib/siamrajUnitNotes.ts
--      → ค่าที่ทีมแก้ไว้ "หายเงียบ" โดยไม่มี error ให้เห็น
--   2. ไม่มีที่ไหนอธิบายว่าคอลัมน์นี้เก็บอะไร ใครอ่าน
-- migration นี้จึงเป็นการ "รับหนี้" ให้ลำดับ migration ตรงกับของจริง — บนฐาน production
-- คำสั่งนี้ไม่เปลี่ยนอะไรเลย (IF NOT EXISTS) แต่บนฐานใหม่จะได้คอลัมน์ตรงกัน
--
-- ⚠️ ห้ามลบ fallback `hasColumn()` ในโค้ดออกในรอบเดียวกัน — ฐานที่ยังไม่ได้รัน migration
--    ถึง 102 ต้องใช้งานได้ต่อ (เส้นเดียวกันนี้ /apply ก็เรียก)
--
-- ใครใช้: api/_handlers/public/jobs.ts (รายได้/สวัสดิการที่ขึ้นหน้าสาธารณะ — override ชนะ ERP)
--        · api/_lib/siamrajUnitNotes.ts (อ่าน/เขียน) · EditPublicJobFieldsDialog.tsx (ฟอร์ม)

alter table siamraj_unit_notes
  add column if not exists field_overrides jsonb;

comment on column siamraj_unit_notes.field_overrides is
  'ค่าที่ทีมแก้เองก่อนปล่อยประกาศ (jsonb) — total_income, income (breakdown), province/district/subdistrict, '
  'benefits ฯลฯ · override ชนะค่าจาก ERP เสมอตอนขึ้นหน้าสาธารณะ · ไม่มีคีย์ = ใช้ค่า ERP';
