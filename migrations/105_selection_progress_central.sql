-- ขั้นในกระบวนการจ้าง "ชุดเดียว" (Phase 6.1-6.2 · เจ้าของเคาะ 22 ส.ค. 2569)
--
-- 🔴 โจทย์: *"สถานะผู้สมัคร รวมเป็นชุดเดียว `selection_status` — **คนจาก match ใช้ด้วย**"*
--
-- ปัญหาของเดิม (สองชุดแยกกันสิ้นเชิง):
--   · `public_job_applications.selection_status` + `prep_checklist` (migration 094)
--     ใช้ได้เฉพาะคนที่ **มีใบสมัคร** — คนที่ AI จับคู่มาจากบอร์ด/iRecruit ไม่มีแถวในตารางนั้น
--     จึงตั้งขั้นให้เขาไม่ได้เลย
--   · `candidate_proposals.status` (044: proposed/reserved/contacted/placed/rejected/cancelled)
--     เป็น "สถานะการเสนอคนให้ใบขอ" คนละคำถามกับ "เขาเดินไปถึงขั้นไหนของการจ้าง"
--
-- 🔴 คีย์ = **(job_id, phone_e164)** ไม่ใช่ id ใบสมัคร/ref
--   บทเรียนเดิมของโปรเจกต์ (ล็อกโทร migration 068): *คนเดียวมีหลายรหัส แต่เบอร์มีเบอร์เดียว*
--   คนคนหนึ่งอาจโผล่ทั้งในใบสมัคร (`app-`) และในบอร์ด (`card-`) และ iRecruit (`ir-`)
--   ถ้าคีย์ด้วย ref จะได้ขั้นคนละอันของคนเดียวกัน = ตัวเลขบนจอขัดกันเอง
--   ผูก job_id ด้วยเพราะคนเดียวสมัครได้หลายใบขอ และขั้นเป็นของ "คู่ (คน, ใบขอ)"
--
-- ⚠️ **ของเดิมไม่หาย** — migration นี้ **ไม่ลบ/ไม่แก้คอลัมน์ 094**
--   ระหว่างเปลี่ยนผ่านระบบเขียนสองที่ (dual-write) และอ่านตารางกลางก่อน แล้วถอยไปคอลัมน์เดิม
--   (ตัวกลางเดียวที่ทำเรื่องนี้ = `api/_lib/selectionProgressStore.ts`)
--   ประวัติของ `candidate_proposals` ก็ไม่ถูกแตะเลย (คนละคำถาม เก็บคู่กันไป)

create table if not exists selection_progress (
  /** id เต็มของใบขอจาก ERP เช่น `siamraj-sql:OPL6908001` (ห้ามเก็บเลขที่ใบเปล่า ๆ) */
  job_id text not null,
  /** เบอร์รูป E.164 เช่น `+66812345678` — คีย์คนที่ทนต่อการมีหลายรหัส */
  phone_e164 text not null,
  /** ค่าที่ระบบรู้จักอยู่ที่ src/lib/selectionProgress.ts ที่เดียว (ไม่ผูก CHECK ที่ฐาน
      เพราะเจ้าของเติมขั้นเรื่อย ๆ — กันค่าเพี้ยนที่ชั้น normalize ฝั่งโค้ดแทน) */
  selection_status text null,
  prep_checklist jsonb not null default '{}'::jsonb,
  /** หน่วยงานที่กำลังพิจารณา (Phase 6.6) — snapshot เป็นข้อความแบบเดียวกับ follow_entries
      (ใบขออยู่ ERP คนละฐาน จึงไม่มี FK · site_code คือคีย์จริงของ "หน่วยงาน" ในระบบนี้) */
  unit_site_code text null,
  unit_name text null,
  /** ร่องรอยว่าใครขยับล่าสุด — ประวัติเต็มอยู่ audit_logs (แพตเทิร์นเดียวกับ proposals) */
  updated_by uuid null,
  updated_by_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (job_id, phone_e164)
);

-- หน้าคัดสรรกรองด้วยขั้นเป็นหลัก
create index if not exists selection_progress_status_idx
  on selection_progress (selection_status)
  where selection_status is not null;

-- "คนนี้อยู่ขั้นไหนในใบขออื่นด้วยไหม" — ถามด้วยเบอร์ข้ามใบขอ
create index if not exists selection_progress_phone_idx
  on selection_progress (phone_e164);

comment on table selection_progress is
  'ขั้นในกระบวนการจ้าง + เช็คลิสต์เตรียมเข้างาน แบบชุดเดียวที่คนจาก match ใช้ได้ด้วย '
  '(Phase 6 · 22 ส.ค. 2569) — คีย์ (job_id, phone_e164) เพราะคนเดียวมีหลายรหัสแต่เบอร์เดียว';
comment on column selection_progress.phone_e164 is
  'เบอร์ E.164 — คีย์คน · ห้ามใช้ candidate_ref/id ใบสมัครแทน (คนเดียวมีหลายรหัส)';

-- ── backfill จากคอลัมน์เดิม (094) — idempotent รันซ้ำได้ ────────────────────
-- เอาเฉพาะแถวที่ "มีของจริง" (ตั้งขั้นแล้ว หรือติ๊กเช็คลิสต์แล้ว) และเบอร์แปลง E.164 ได้
-- ⚠️ ใบเดียวกัน (job_id, เบอร์) อาจมีหลายใบสมัคร → เอาใบที่ **อัปเดตล่าสุด** เป็นตัวแทน
--    (distinct on ... order by updated_at desc) ไม่ใช่สุ่มมาใบเดียว
insert into selection_progress (job_id, phone_e164, selection_status, prep_checklist, created_at, updated_at)
select distinct on (a.job_id, a.phone_e164)
       a.job_id,
       a.phone_e164,
       a.selection_status,
       coalesce(a.prep_checklist, '{}'::jsonb),
       a.created_at,
       now()
  from public_job_applications a
 where a.job_id is not null
   and a.phone_e164 is not null
   and (a.selection_status is not null or coalesce(a.prep_checklist, '{}'::jsonb) <> '{}'::jsonb)
 order by a.job_id, a.phone_e164, a.updated_at desc nulls last, a.created_at desc
on conflict (job_id, phone_e164) do nothing;
