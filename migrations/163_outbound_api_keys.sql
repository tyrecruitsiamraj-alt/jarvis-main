-- ═══ key ที่ระบบภายนอกออกให้ Jarvis ใช้เรียกเขา (เจ้าของ 26 ต.ค. 2569 — So Scraping options API) ═══
-- ใส่/เปลี่ยน/ลบผ่านหน้า ตั้งค่า › เชื่อมระบบภายนอก · เก็บแบบเข้ารหัส (AES-256-GCM ตัวเดียวกับ ai_connections)
-- ต่างจาก app_integration_keys (key ที่ Jarvis ออกให้คนอื่นเรียกเข้ามา · เก็บแค่แฮช)
create table if not exists app_outbound_api_keys (
  name text primary key,
  base_url text not null,
  key_enc text,
  key_hint text,
  updated_by text,
  updated_at timestamptz not null default now()
);
