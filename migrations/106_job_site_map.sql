-- แมป "ใบขอ → หน่วยงาน (ไซต์)" เพื่อกันเสนอซ้ำ **ระดับหน่วยงาน** (Phase 6.8)
--
-- 🔴 โจทย์: *"กันหน่วยงานที่เคยปฏิเสธระดับหน่วยงาน (วันนี้กันแค่ใบเดิมด้วยเบอร์+job_ref)"*
-- ปัญหา: `lumos_dispatch_queue` และ `candidate_call_holds` เก็บแค่ `job_ref`/`job_id`
-- (ระดับ**ใบขอ**) ไม่มีคอลัมน์หน่วยงานเลย · หน่วยงานจริงอยู่บน ERP (MSSQL) ซึ่งช้าและ
-- เรียกตอน enqueue ไม่ได้ (คอขวดเข้าคิวต้องเร็วและไม่พึ่ง ERP)
--
-- วิธี: จำ `site_code` ของแต่ละใบขอไว้ฝั่งเราตอนที่ระบบ **ดึง feed ใบขออยู่แล้ว**
-- (ราคาถูก: upsert เป็นชุด) แล้วตอนกันซ้ำก็ถามจากตารางนี้ ไม่ต้องแตะ ERP
--
-- ⚠️ ไม่มี FK — ใบขออยู่คนละฐาน (แพตเทิร์นเดียวกับ `job_public_releases` 103)
-- ⚠️ **fail-safe**: ไม่มีแถว/ไม่มี site_code → ถอยไปกันระดับใบขอเหมือนเดิม
--    (พฤติกรรมเดิมไม่แย่ลง ไม่ใช่หยุดกันทั้งหมด)

create table if not exists job_site_map (
  /** id เต็มของใบขอ เช่น `siamraj-sql:OPL6908001` */
  job_id text primary key,
  /** รหัสไซต์ = คีย์จริงของ "หน่วยงาน" ในระบบนี้ (เดียวกับ boardUnitPicker) */
  site_code text null,
  /** ชื่อหน่วยงาน — ไว้อ่าน/อธิบายเหตุผลบนจอ ไม่ใช้ join */
  unit_name text null,
  updated_at timestamptz not null default now()
);

-- ถามกลับทาง: "ใบขออะไรอยู่ไซต์นี้" (ใช้ตอนกันซ้ำระดับหน่วยงาน)
create index if not exists job_site_map_site_idx
  on job_site_map (site_code)
  where site_code is not null;

comment on table job_site_map is
  'จำหน่วยงาน (site_code) ของใบขอไว้ฝั่งเรา เพื่อกันเสนอคนซ้ำระดับหน่วยงานโดยไม่ต้องแตะ ERP '
  '(Phase 6.8) — เติมอัตโนมัติตอนระบบดึง feed ใบขอ · ไม่มีแถว = ถอยไปกันระดับใบขอ';
