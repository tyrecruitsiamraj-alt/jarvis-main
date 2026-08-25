-- "ดูแลหลังเริ่มงาน" — ทะเบียนคนที่ผ่านการติดตามแล้วและเข้าสู่ช่วงดูแลหลังเริ่มงาน
-- (Phase 7.2-7.5 · เจ้าของเคาะชื่อหน้าเอง: **"ดูแลหลังเริ่มงาน"**)
--
-- 🔴 ทำไมต้องมีตารางใหม่: ธง "แจ้งเข้าแล้ว" (`is_inform`) อยู่บน **ERP (MSSQL) ซึ่งอ่านอย่างเดียว**
-- ฝั่งเราจึงไม่มีที่จดว่า "คนนี้ถูกย้ายมาดูแลหลังเริ่มงานแล้ว" · ถ้าไม่จด กดปุ่มย้ายแล้ว
-- รีเฟรชก็หายไป และไม่มีทางรู้ว่าใครถูกดูแลอยู่/ดูแลจบแล้ว
--
-- ⚠️ คีย์ = **เบอร์ E.164** (เหมือน `selection_progress` 105 และล็อกโทร 068)
-- คนเดียวมีหลายรหัส/หลายใบสมัคร แต่เบอร์มีเบอร์เดียว · ไม่ผูก FK กับใบขอ (อยู่ ERP)
--
-- ⚠️ **ไม่แตะ `follow_entries`** — การติดตามก่อนเริ่มงานกับการดูแลหลังเริ่มงานเป็น
-- คนละงวดของคนเดียวกัน · รอบโทร "ถามความเป็นอยู่" ยังใช้โครง follow เดิม (topic ใหม่)
-- ตารางนี้เก็บแค่ "ใครอยู่ในความดูแล + เริ่มงานวันไหน" ไม่ทำระบบโทรซ้อนขึ้นมาใหม่

create table if not exists aftercare_people (
  phone_e164 text primary key,
  full_name text not null,
  /** หน่วยงาน/ไซต์ที่ไปเริ่มงาน — snapshot ข้อความ (แพตเทิร์นเดียวกับ follow_entries 096) */
  unit_name text null,
  site_code text null,
  /**
   * วันเริ่มงาน — ฐานของ preset รอบโทร 3/7/30 วัน (Phase 7.4)
   * ⚠️ อาจไม่รู้ (ย้ายมาก่อนรู้วันจริง) → null ได้ · หน้าเว็บต้องบอกว่า "ยังไม่ระบุ"
   *    ไม่ใช่เดาเอาวันที่ย้ายเป็นวันเริ่มงาน
   */
  start_date date null,
  /** ที่มาของการย้าย — 'follow_done' = ย้ายจากกล่องโทรครบ · 'manual' = เพิ่มเอง */
  source text not null default 'follow_done',
  /** รายการติดตามต้นทาง (follow_entries.id) ถ้าย้ายมาจากกล่องโทรครบ */
  from_follow_id uuid null,
  note text null,
  moved_by uuid null,
  moved_by_name text null,
  /** ปิดการดูแล (ผ่านช่วงดูแลแล้ว/ลาออก) — null = ยังดูแลอยู่ */
  closed_at timestamptz null,
  closed_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- หน้ารายการเปิดค้างไว้ = ถามบ่อยสุด
create index if not exists aftercare_people_open_idx
  on aftercare_people (created_at desc)
  where closed_at is null;

create index if not exists aftercare_people_site_idx
  on aftercare_people (site_code)
  where site_code is not null;

comment on table aftercare_people is
  'คนที่อยู่ในช่วง "ดูแลหลังเริ่มงาน" (Phase 7) — คีย์ด้วยเบอร์ E.164 · '
  'ERP อ่านอย่างเดียวจึงต้องจดฝั่งเราเอง · รอบโทรถามความเป็นอยู่ใช้โครง follow เดิม';
comment on column aftercare_people.start_date is
  'วันเริ่มงานจริง — ฐานของ preset 3/7/30 วัน · null = ยังไม่ระบุ (ห้ามเดาจากวันย้าย)';
