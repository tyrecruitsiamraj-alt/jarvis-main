-- ประกาศรับสมัคร + ลิงก์ต่อช่องทาง
--
-- หลักการที่เจ้าของวางไว้: "ทำที่เดียวแล้วไหลไปเรื่อย ๆ"
-- เจ้าหน้าที่กดเข้ากล่องงาน → สร้างลิงก์ (กรอกรายละเอียด + เลือกช่องทาง) → ส่งลิงก์ออกไป
-- → ผู้สมัครกรอกผ่านลิงก์ → ใบสมัครตกเข้ากล่องของประกาศนั้น → เจ้าหน้าที่โทร
--
-- ของที่ได้เพิ่มมาเอง: ลิงก์ผูกช่องทาง → ตอบได้ว่า "ลงประกาศที่ไหนแล้วได้คนจริง"
-- (เดิม referral_source มาจากที่ผู้สมัครเลือกเอง ซึ่งเชื่อไม่ได้)

-- ── ช่องทาง (master 2 ระดับ: หลัก → รอง) ────────────────────────────────
-- ใช้แพตเทิร์นเดียวกับ work_status_master คือให้ admin แก้เองได้จากหน้าเว็บ
-- ไม่ผูก CHECK ที่ hardcode ค่า เพื่อไม่ต้องเขียน migration ใหม่ทุกครั้งที่เพิ่มช่องทาง
create table if not exists recruit_channels (
  id uuid primary key default gen_random_uuid(),
  /** null = ช่องทางหลัก · มีค่า = ช่องทางรองของ id นั้น */
  parent_id uuid null references recruit_channels (id) on delete cascade,
  name text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ชื่อห้ามซ้ำภายใต้พ่อเดียวกัน (ระดับบนสุดใช้ค่าคงที่แทน null เพราะ null ไม่ชนกันเองใน unique index)
create unique index if not exists recruit_channels_parent_name_idx
  on recruit_channels (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)));

create index if not exists recruit_channels_active_idx
  on recruit_channels (is_active, sort_order);

-- ── ประกาศรับสมัคร ────────────────────────────────────────────────────
create table if not exists recruit_postings (
  id uuid primary key default gen_random_uuid(),
  /** ใบขอที่ผูก — null = "ประกาศลอย" ที่ไม่ได้มาจากใบขอ */
  job_id text null,
  /**
   * ประเภทกล่องลอย (ผู้บริหารคนไทย/ต่างชาติ/ส่วนกลาง/Valet/ราชการ)
   * ไม่ผูก CHECK constraint ไว้ตั้งใจ — ตรวจที่ API จาก constant ชุดเดียว
   * เพื่อไม่ให้ต้องเขียน migration ใหม่ตอนเพิ่มประเภท (บทเรียนจาก 039/053/054/056)
   */
  standalone_kind text null,
  /** BU — ประกาศลอยต้องระบุเอง ไม่งั้น scope ตาม BU รั่ว */
  department_code text null,
  title text not null,
  /** รายละเอียดที่ผู้สมัครเห็นบนหน้าสมัคร */
  detail text null,
  location_text text null,
  salary_text text null,
  contact_name text null,
  contact_phone text null,
  /** open = รับสมัครอยู่ · closed = ปิดรับ (กดเอง ไม่มีหมดอายุอัตโนมัติ) */
  status text not null default 'open',
  created_by_user_id uuid null,
  created_by_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruit_postings_job_id_idx on recruit_postings (job_id);
create index if not exists recruit_postings_standalone_idx
  on recruit_postings (standalone_kind, status);
create index if not exists recruit_postings_dept_idx on recruit_postings (department_code);

-- ── ลิงก์ต่อช่องทาง (1 ประกาศ → หลายลิงก์) ──────────────────────────────
create table if not exists recruit_posting_links (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references recruit_postings (id) on delete cascade,
  /** ช่องทางรอง (หรือช่องทางหลักถ้าไม่มีรอง) · set null เมื่อช่องทางถูกลบ ลิงก์ยังใช้ได้ */
  channel_id uuid null references recruit_channels (id) on delete set null,
  /** ป้ายช่องทางตอนสร้าง — เก็บซ้ำไว้กันชื่อ master เปลี่ยนทีหลังแล้วรายงานย้อนหลังเพี้ยน */
  channel_label text null,
  /** โค้ดใน URL: /apply/p/<code> */
  code text not null unique,
  note text null,
  hit_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists recruit_posting_links_posting_idx on recruit_posting_links (posting_id);

-- ── ใบสมัครรู้ว่ามาจากประกาศไหน / ลิงก์ไหน ──────────────────────────────
-- nullable ทั้งคู่ — ใบสมัครเดิมที่เข้ามาทาง /apply?job= ไม่กระทบ
alter table public_job_applications
  add column if not exists posting_id uuid null;

alter table public_job_applications
  add column if not exists link_id uuid null;

create index if not exists public_job_applications_posting_idx
  on public_job_applications (posting_id);
