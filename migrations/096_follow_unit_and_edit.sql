-- หน่วยงาน + รหัสไซต์ บนรายการ Follow (เจ้าของสั่ง 17 ส.ค. 2569)
--
-- *"เพิ่มชื่อหน่วยงาน โดยเลือกจากใบงานได้เลย · Code site ถ้าเลือกหน่วยงานก็ให้ขึ้นมาเลย"*
--
-- ทำไมเก็บเป็น **ข้อความ ไม่ใช่ FK ไปใบขอ**:
--   - ใบขออยู่คนละฐาน (ERP SQL Server) FK ข้ามฐานทำไม่ได้
--   - ต่อให้อ้างด้วยเลขที่ใบ ก็ยัง**ซ้ำกันได้ระหว่างใบขอปกติกับใบขอล่วงหน้า** (วัดจริง 23 ใบ)
--     และเลขท้ายยังชนกันข้าม BU อีก 234 ใบ — อ้างผิดใบคือโชว์ชื่อลูกค้าผิดบริษัท
--   - งาน Follow ต้องการแค่ "ตอนนั้นตามเรื่องของหน่วยงานไหน" = snapshot ณ วันที่กรอก
--     ใบขอปิดไปแล้วรายการ Follow ก็ยังต้องอ่านรู้เรื่อง
--
-- ⚠️ ทั้งสองคอลัมน์เป็น null ได้ — Follow หลายเคสไม่ได้ผูกกับใบขอใด (ตามเรื่องทั่วไป)
--    null = "ไม่ได้ระบุ" ห้ามตีความว่าไม่มีหน่วยงาน

alter table follow_entries
  add column if not exists unit_name text null,
  add column if not exists site_code text null;

comment on column follow_entries.unit_name is
  'ชื่อหน่วยงานที่ตามเรื่องให้ — snapshot ตอนกรอก (เลือกจากใบขอ หรือพิมพ์เอง)';
comment on column follow_entries.site_code is
  'รหัสไซต์ของหน่วยงานนั้น — เติมอัตโนมัติเมื่อเลือกจากใบขอ';

-- ค้นตามหน่วยงานบนหน้า Follow
create index if not exists follow_entries_site_code_idx
  on follow_entries (site_code) where site_code is not null;

-- ร่องรอยการแก้ไข (เจ้าของสั่ง: *"เพิ่มให้แก้ไขได้"*)
-- ⚠️ **ไม่แตะ `created_by` / `created_by_name`** — เจ้าของข้อมูลคือคนที่กรอกครั้งแรกเสมอ
--    คนแก้ทีหลังไม่ใช่เจ้าของ (ถ้าทับ = ประวัติว่าใครเป็นคนลงงานนี้หายไปเงียบ ๆ)
alter table follow_entries
  add column if not exists updated_at timestamptz null,
  add column if not exists updated_by uuid null,
  add column if not exists updated_by_name text null;

comment on column follow_entries.updated_by_name is
  'คนแก้ไขล่าสุด — คนละคนกับ created_by_name (เจ้าของข้อมูล) ได้';
