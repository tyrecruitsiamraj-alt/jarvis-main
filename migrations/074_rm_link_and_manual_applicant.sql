-- งานสรรหา (RM) — เติมข้อมูลที่ระบบเดิมมีแต่ฝั่งเรายังไม่มี
--
-- เจ้าของสั่ง 11 ส.ค. 2569 พร้อม HTML ของระบบเดิม 2 ฟอร์ม:
--   1) "สร้างลิงก์" ต้องเก็บ: ช่องทางรับสมัคร (มีแล้ว) · จังหวัด · ตำแหน่งงาน
--      · ผู้รับผิดชอบ · ข้อมูลเจาะจง · ประเภทฟอร์มการสมัคร (ทั่วไป / แนบเอกสารได้)
--   2) "เพิ่มข้อมูลผู้สมัคร" ให้เจ้าหน้าที่คีย์เอง — ต้องเก็บ LINE ID ·
--      ประเภทเจาะจง · ผู้รับผิดชอบ · ช่องทางรับสมัคร (จาก master) · ประเภทใบขับขี่
--
-- ⚠️ เพิ่มคอลัมน์อย่างเดียว ไม่แก้/ไม่ลบของเดิม — ใบสมัครและประกาศที่มีอยู่ยังใช้ได้ปกติ
-- ทุกคอลัมน์ nullable และไม่ผูก CHECK ที่ hardcode ค่า (บทเรียนเดิมจาก 039/053/054/056)
-- ค่าที่รับได้ตรวจที่ API จาก constant ชุดเดียวใน `src/lib/recruitRmMasters.ts`

-- ── 1) ประกาศรับสมัคร: ข้อมูลที่ใช้ตอนสร้างลิงก์ ──────────────────────────
alter table recruit_postings
  add column if not exists position_name text null;

alter table recruit_postings
  add column if not exists province text null;

alter table recruit_postings
  add column if not exists responsible_name text null;

alter table recruit_postings
  add column if not exists responsible_user_id uuid null;

/** ข้อมูลเจาะจง เช่น "เจาะจง (ฟรี)" · "พนักงานทดแทน WL (เสียเงิน)" · "Lost Lead" */
alter table recruit_postings
  add column if not exists specific_type text null;

/**
 * ประเภทฟอร์มการสมัครที่ลิงก์นี้จะเปิด
 *   'rm'     = ทั่วไป (ไม่ต้องแนบเอกสาร)
 *   'global' = แนบเอกสารได้
 * default 'rm' ให้ประกาศเดิมทั้งหมดอ่านเป็น "ทั่วไป" เหมือนพฤติกรรมที่เป็นอยู่วันนี้
 */
alter table recruit_postings
  add column if not exists form_type text not null default 'rm';

-- ค้น/รายงานตามตำแหน่ง+จังหวัด เป็นสิ่งที่เจ้าหน้าที่ทำบ่อยสุดในระบบเดิม
create index if not exists recruit_postings_position_province_idx
  on recruit_postings (position_name, province);

-- ── 2) ใบสมัคร: ช่องที่ระบบเดิมเก็บแต่เรายังไม่มี ────────────────────────
alter table public_job_applications
  add column if not exists line_id text null;

alter table public_job_applications
  add column if not exists specific_type text null;

alter table public_job_applications
  add column if not exists responsible_name text null;

/**
 * ช่องทางรับสมัครจาก master (recruit_channels) — แม่นกว่า referral_source เดิม
 * ที่ผู้สมัครเลือกเอง 5 ค่ากว้าง ๆ · on delete set null: ลบช่องทางแล้วใบสมัครยังอยู่
 */
alter table public_job_applications
  add column if not exists channel_id uuid null references recruit_channels (id) on delete set null;

/** ป้ายช่องทางตอนบันทึก — กันชื่อ master เปลี่ยนแล้วรายงานย้อนหลังเพี้ยน (แพตเทิร์นเดียวกับ recruit_posting_links) */
alter table public_job_applications
  add column if not exists channel_label text null;

/** ประเภทใบขับขี่ที่มี — หลายใบต่อคน (ท.2 + ท.3 พร้อมกันได้) */
alter table public_job_applications
  add column if not exists license_types text[] null;

/** เจ้าหน้าที่ที่คีย์ใบนี้เข้ามาเอง — null = ผู้สมัครกรอกเองผ่านลิงก์ */
alter table public_job_applications
  add column if not exists created_by_name text null;

create index if not exists public_job_applications_channel_idx
  on public_job_applications (channel_id);
