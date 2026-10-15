-- ═══ ดึงชื่อผู้สมัครจาก iRecruit เข้าแท็บผู้สมัคร (เจ้าของสั่ง 15 ต.ค. 2569) ═══
-- Choice: ย้อน 30 วันที่ยังไม่ถูกโทร · ดึงต่อเนื่องทุก 15 นาที · คนกดส่ง AI เอง · เบอร์ที่มีใน jarvis แล้วไม่ดึงซ้ำ
-- แถวละใบที่ดึงมา — กันดึงซ้ำด้วย uuid ของ iRecruit (recruit_register.uuid)

create table if not exists app_irecruit_imports (
  register_uuid text primary key,
  application_id uuid not null references public_job_applications(id) on delete cascade,
  irecruit_created_at timestamptz null,
  imported_at timestamptz not null default now()
);
create index if not exists app_irecruit_imports_application_idx on app_irecruit_imports (application_id);
