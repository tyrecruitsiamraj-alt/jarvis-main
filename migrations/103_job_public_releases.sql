-- "ปล่อยใบขอขึ้นหน้าสาธารณะ" — ทะเบียนใบที่ทีมกดปล่อยแล้ว
--
-- 🔴 เจ้าของเคาะ 22 ส.ค. 2569: **กลับด้านหมด — ทุกใบต้องกดปล่อย**
-- ของเดิม: ใบขอที่ status เปิดอยู่ **ขึ้นหน้า /apply เองอัตโนมัติทุกใบ** (วัดจริง 283 ใบ)
-- ทีมไม่มีทางเลือกว่าใบไหนจะให้คนนอกเห็น และไม่มีจังหวะแก้รายได้/สวัสดิการก่อนปล่อย
-- ของใหม่: ใบขอขึ้นหน้าสาธารณะ **เฉพาะใบที่มีแถวในตารางนี้** (ถอนได้ด้วยการลบแถว)
--
-- ⚠️ วันเปลี่ยนผ่าน: ตารางนี้ว่าง = /apply ว่าง — เป็นพฤติกรรมที่เจ้าของสั่งเอง
-- มีเครื่องมือ bulk release บนบอร์ดให้ทีมกดปล่อยชุดแรกได้เอง (ห้าม seed ข้อมูลให้เงียบ ๆ)
--
-- ⚠️ `job_id` เป็น text เพราะใบขอมาจาก ERP (MSSQL) ไม่ใช่ตารางใน pg นี้
-- รูปแบบคือ `siamraj-sql:OPL6908001` / `siamraj-pre:LBM6908001` (ดูกับดัก pre/sql ใน editing-map)
-- จึงไม่มี FK — และ **ต้องเก็บ id เต็ม** ไม่ใช่เลขที่ใบขอเปล่า ๆ

create table if not exists job_public_releases (
  job_id text primary key,
  released_at timestamptz not null default now(),
  released_by uuid null,
  released_by_name text null,
  /** เลขที่ใบขอ (สำหรับอ่านง่าย/ตรวจย้อน — ไม่ใช้ join) */
  request_no text null,
  note text null
);

create index if not exists job_public_releases_released_at_idx
  on job_public_releases (released_at desc);

comment on table job_public_releases is
  'ใบขอที่ทีมกดปล่อยขึ้นหน้าสาธารณะ /apply — ไม่มีแถว = ไม่ขึ้นหน้าสาธารณะ '
  '(เจ้าของเคาะ 22 ส.ค. 2569 ให้กลับด้านจากเดิมที่ขึ้นเองทุกใบ)';
comment on column job_public_releases.job_id is
  'id เต็มของใบขอจาก ERP เช่น siamraj-sql:OPL6908001 — ห้ามเก็บเลขที่ใบขอเปล่า ๆ';
