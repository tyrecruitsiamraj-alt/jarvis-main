-- เลือก AI ที่ใช้คิดงานจากหน้าตั้งค่า (เจ้าของสั่ง 17 ต.ค. 2569)
-- > "ตอนนี้เรามีใช้ Ai แต่หน้า UI ไม่มีให้เลือกพวก Model … อนาคตอยากจะเปลี่ยน … ต้องเปลี่ยนจากหน้า Ui ได้"
-- Choice: Ollama + เจ้าแบบ OpenAI + Claude · เลือกแยกได้ต่องาน · admin เท่านั้น
--
-- ไม่มีแถว = ทุกงานใช้ Ollama จากไฟล์ตั้งค่าเซิร์ฟเวอร์ (OLLAMA_BASE_URL/OLLAMA_MODEL) แบบเดิม — ทางถอย
-- ⚠️ ไม่ผูก CHECK ที่ hardcode ชนิด/งาน — คุมที่ API (src/lib/aiSettings.ts) ที่เดียว (บทเรียน 035/095/097)
-- ⚠️ api_key_enc เข้ารหัส AES-256-GCM ฝั่ง API · ห้ามส่งกลับหน้าจอ (โชว์แค่ api_key_hint 4 ตัวท้าย)

create table if not exists ai_connections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null,
  base_url text not null,
  model text not null default '',
  api_key_enc text null,
  api_key_hint text null,
  updated_by text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table ai_connections is
  'การเชื่อมต่อ AI ที่ใช้คิดงาน (Ollama / แบบ OpenAI / Claude) — ตั้งที่ ตั้งค่า › AI ที่ใช้คิดงาน (admin)';

create table if not exists ai_task_routes (
  task text primary key,
  connection_id uuid null references ai_connections(id) on delete set null,
  model text null,
  updated_by text null,
  updated_at timestamptz not null default now()
);

comment on table ai_task_routes is
  'งานไหนใช้ AI ตัวไหน — connection_id null = ใช้ Ollama จากไฟล์ตั้งค่าเซิร์ฟเวอร์';
