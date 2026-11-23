-- ═══ ส่งเอกสารผ่าน LINE (เจ้าของ 22 พ.ย. 2569) ═══
-- เจ้าหน้าที่กด "ส่งเอกสาร" → ได้ลิงก์เฉพาะผู้สมัคร คัดลอกไปส่ง LINE เอง → ผู้สมัครเปิดลิงก์ (LINE ยืนยันบัญชี)
-- ถ่าย/แนบบัตร ใบขับขี่ ทะเบียนบ้าน → ตรวจแก้ข้อมูล → ตอบเอกสาร 5 ฉบับ → เซ็น → ส่ง → HR เห็นชุดที่ส่ง + กระดิ่งแจ้งคนสร้างลิงก์
--
-- เพิ่มอย่างเดียว ไม่แตะตารางเดิม · ไฟล์แนบเดิมของใบสมัคร (public_job_applications.document_*) อยู่ที่เดิม ไม่เกี่ยวกัน
-- ไม่ผูก FK ไปตาราง users — หน้าผู้ใช้งานลบบัญชีได้จริง จึงเก็บชื่อคนทำไว้ข้างรหัสแทน
-- ใบสมัครไม่ถูกลบแถว (คำขอ PDPA ล้างข้อมูลในแถว) จึงผูก FK แบบ restrict ได้

-- ค่าที่ตั้งจากหน้าจอ: เปิดใช้ · LINE Login channel · LIFF (ไม่มีแถว = ยังปิด)
create table if not exists document_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid null,
  updated_by_name text null,
  updated_at timestamptz not null default now()
);

-- ต้นฉบับเอกสารของบริษัท 5 ประเภท — อัปโหลดจากหน้าตั้งค่า เก็บหลังสิทธิ์ (repo เป็น public จึงไม่เก็บเป็นไฟล์ในโค้ด)
-- แก้ต้นฉบับ = รุ่นใหม่ · ชุดที่ส่งแล้วจำรุ่น + แฮชที่ผู้สมัครอ่านไว้
create table if not exists document_templates (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null,
  version integer not null,
  page_count integer not null,
  sha256 text not null,
  is_active boolean not null default true,
  created_by uuid null,
  created_by_name text null,
  created_at timestamptz not null default now(),
  unique (doc_type, version)
);
create unique index if not exists document_templates_active_idx
  on document_templates (doc_type) where is_active;

create table if not exists document_template_pages (
  template_id uuid not null references document_templates (id) on delete restrict,
  page_no integer not null,
  mime text not null,
  size integer not null,
  sha256 text not null,
  width integer null,
  height integer null,
  bytes bytea not null,
  primary key (template_id, page_no)
);

-- ลิงก์ส่งเอกสาร 1 แถว = 1 ลิงก์ของใบสมัคร 1 ใบ · เก็บแฮชของรหัสลิงก์ ไม่เก็บรหัสจริง
-- บัญชี LINE ที่เปิดลิงก์ผูกครั้งแรกที่นี่ (claimed_line_user_id) และอยู่ถาวร ไม่ขึ้นกับอายุ session
create table if not exists document_invitations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public_job_applications (id) on delete restrict,
  job_id text null,
  job_label text null,
  department_code text null,
  applicant_name text not null,
  revision integer not null,
  token_hash text not null unique,
  created_by uuid not null,
  created_by_name text null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  revoked_by uuid null,
  revoked_by_name text null,
  claimed_line_user_id text null,
  line_display_name text null,
  line_picture_url text null,
  line_verified_at timestamptz null,
  first_opened_at timestamptz null,
  last_opened_at timestamptz null,
  open_count integer not null default 0,
  unique (application_id, revision)
);
create index if not exists document_invitations_application_idx
  on document_invitations (application_id, created_at desc);
create index if not exists document_invitations_creator_idx
  on document_invitations (created_by, created_at desc);

-- เหตุการณ์ของงานเอกสาร (สร้างลิงก์ · เปิด · บัญชีไม่ตรง · แนบ · ส่ง · HR ทำอะไร) — เพิ่มอย่างเดียว เป็นประวัติให้ HR ดู
create table if not exists document_events (
  id bigserial primary key,
  invitation_id uuid null references document_invitations (id) on delete restrict,
  application_id uuid not null,
  packet_id uuid null,
  event_type text not null,
  actor_type text not null,
  actor_id text null,
  actor_name text null,
  detail jsonb null,
  event_at timestamptz not null default now()
);
create index if not exists document_events_application_idx
  on document_events (application_id, event_at desc);
create index if not exists document_events_invitation_idx
  on document_events (invitation_id, event_at desc);

-- สิทธิ์เข้าฟอร์มของผู้สมัคร (คุกกี้) — ล้างได้เมื่อหมดอายุ ประวัติการเปิดอยู่ที่ตารางข้างบน ไม่หายตาม
create table if not exists document_sessions (
  token_hash text primary key,
  invitation_id uuid not null references document_invitations (id) on delete cascade,
  line_user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null
);
create index if not exists document_sessions_expiry_idx on document_sessions (expires_at);

-- ภาพที่ผู้สมัครแนบ: draft (ยังไม่ส่ง) → committed (อยู่ในชุดที่ส่ง) · discarded (ถูกแทนด้วยภาพใหม่)
create table if not exists document_files (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references document_invitations (id) on delete restrict,
  application_id uuid not null,
  kind text not null,
  mime text not null,
  size integer not null,
  sha256 text not null,
  width integer null,
  height integer null,
  state text not null default 'draft',
  line_user_id text not null,
  uploaded_at timestamptz not null default now(),
  committed_at timestamptz null,
  discarded_at timestamptz null,
  packet_id uuid null
);
create index if not exists document_files_invitation_idx
  on document_files (invitation_id, kind, uploaded_at desc);
create index if not exists document_files_draft_idx
  on document_files (uploaded_at) where state = 'draft';
-- PDF ของเอกสารในชุด เก็บครั้งแรกที่สร้าง — ชุดละฉบับละไฟล์เดียว
create unique index if not exists document_files_packet_pdf_idx
  on document_files (packet_id, kind) where kind like 'pdf:%';

-- ตัวภาพ (เข้ารหัสก่อนเก็บ) แยกตารางจากรายการ — อ่านรายการไม่ต้องลากภาพ และย้ายที่เก็บภายหลังได้
create table if not exists document_file_blobs (
  file_id uuid primary key references document_files (id) on delete cascade,
  key_id text not null,
  bytes bytea not null
);

-- ชุดเอกสารที่ส่งแล้ว — 1 ลิงก์ส่งได้ 1 ชุด · แก้ไม่ได้ (trigger ข้างล่าง) · ส่งใหม่ = ลิงก์ใหม่ ชุดใหม่
create table if not exists document_packets (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references document_invitations (id) on delete restrict,
  application_id uuid not null references public_job_applications (id) on delete restrict,
  job_id text null,
  job_label text null,
  department_code text null,
  revision integer not null,
  form_version text not null,
  notice_version text not null,
  template_versions jsonb not null,
  person_name text not null,
  payload_enc text not null,
  payload_key_id text not null,
  payload_hash text not null,
  signature_method text not null,
  signature_hash text not null,
  attention jsonb not null default '[]'::jsonb,
  line_user_id text not null,
  line_display_name text not null,
  line_picture_url text null,
  line_verified_at timestamptz not null,
  sender_relation text not null,
  client_ip text null,
  user_agent text null,
  submitted_at timestamptz not null default now(),
  -- สิ่งที่ HR ทำหลังได้รับ (ไม่ใช่ส่วนของชุดที่ผู้สมัครยืนยัน)
  review_flag boolean not null default false,
  review_note text null,
  reviewed_by uuid null,
  reviewed_by_name text null,
  reviewed_at timestamptz null,
  -- HR รับทราบเรื่องที่ต้องดูของชุดนี้แล้ว (คุยกับผู้สมัครแล้ว) — ชุดจึงนำเข้าได้ ทั้งที่คำตอบในชุดยังเป็นของเดิม
  attention_ack_at timestamptz null,
  attention_ack_by uuid null,
  attention_ack_by_name text null,
  attention_ack_note text null,
  -- ล้างตามคำขอ PDPA (ข้อมูลในชุดถูกล้าง เหลือแถวไว้นับ)
  erased_at timestamptz null
);
create index if not exists document_packets_application_idx
  on document_packets (application_id, submitted_at desc);
create index if not exists document_packets_submitted_idx
  on document_packets (submitted_at desc);

create or replace function document_packets_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'document_packets: ลบชุดเอกสารที่ส่งแล้วไม่ได้';
  end if;
  -- ล้างตามคำขอ PDPA ทำได้ครั้งเดียว
  if new.erased_at is not null and old.erased_at is null then
    return new;
  end if;
  if (new.id, new.invitation_id, new.application_id, new.job_id, new.job_label, new.department_code,
      new.revision, new.form_version, new.notice_version, new.template_versions, new.person_name,
      new.payload_enc, new.payload_key_id, new.payload_hash, new.signature_method, new.signature_hash,
      new.attention, new.line_user_id, new.line_display_name, new.line_picture_url, new.line_verified_at,
      new.sender_relation, new.client_ip, new.user_agent, new.submitted_at, new.erased_at)
     is distinct from
     (old.id, old.invitation_id, old.application_id, old.job_id, old.job_label, old.department_code,
      old.revision, old.form_version, old.notice_version, old.template_versions, old.person_name,
      old.payload_enc, old.payload_key_id, old.payload_hash, old.signature_method, old.signature_hash,
      old.attention, old.line_user_id, old.line_display_name, old.line_picture_url, old.line_verified_at,
      old.sender_relation, old.client_ip, old.user_agent, old.submitted_at, old.erased_at) then
    raise exception 'document_packets: ชุดเอกสารที่ส่งแล้วแก้ไม่ได้';
  end if;
  return new;
end $$;

drop trigger if exists document_packets_guard_trg on document_packets;
create trigger document_packets_guard_trg
  before update or delete on document_packets
  for each row execute function document_packets_guard();

-- คิวแจ้งเตือน: เขียนพร้อมชุดเอกสารในธุรกรรมเดียว แล้วตัวส่งค่อยเขียนลงกล่องแจ้งเตือน (app_notifications)
-- ส่งไม่สำเร็จ = ยังอยู่ในคิว ลองใหม่ได้ ไม่หาย · dedupe_key กันแจ้งซ้ำต่อชุด
create table if not exists document_notification_outbox (
  id bigserial primary key,
  event_type text not null,
  packet_id uuid not null references document_packets (id) on delete restrict,
  dedupe_key text not null unique,
  recipient_user_id uuid null,
  title text not null,
  body text null,
  link text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text null,
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz null,
  delivered_to jsonb null,
  created_at timestamptz not null default now()
);
create index if not exists document_notification_outbox_due_idx
  on document_notification_outbox (next_attempt_at) where status <> 'delivered';

-- การนำเข้า iRecruit — HR กดเองเท่านั้น · "นำเข้าแล้ว" ต้องมีเลขที่ฝั่ง iRecruit
create table if not exists document_import_attempts (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references document_packets (id) on delete restrict,
  application_id uuid not null,
  idempotency_key text not null unique,
  department text not null,
  mode text not null,
  status text not null,
  external_id text null,
  error text null,
  evidence jsonb null,
  requested_by uuid not null,
  requested_by_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists document_import_attempts_packet_idx
  on document_import_attempts (packet_id, created_at desc);
-- ชุดหนึ่งนำเข้าสำเร็จได้ครั้งเดียว · ระหว่างรอผล/ไม่รู้ผล ห้ามเปิดรอบใหม่ (กันสร้างซ้ำ)
create unique index if not exists document_import_success_idx
  on document_import_attempts (packet_id) where status = 'success';
create unique index if not exists document_import_open_idx
  on document_import_attempts (packet_id) where status in ('pending', 'unknown');

-- กระดิ่ง: นับ/ดึงแจ้งเตือนเอกสารที่ยังไม่อ่านของคนเดียวได้เร็ว (ไม่โดนเพดาน 30 แถวล่าสุด)
create index if not exists app_notifications_unread_type_idx
  on app_notifications (recipient_user_id, type, created_at desc) where read_at is null;
