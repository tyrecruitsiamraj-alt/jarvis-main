-- key ของระบบภายนอก: ใช้ล่าสุดเมื่อไหร่ — หน้า ตั้งค่า › เชื่อมระบบภายนอก (เจ้าของ 22 ต.ค. 2569 "ทุกอย่างต้องทำผ่าน UI ได้")
alter table if exists app_integration_keys add column if not exists last_used_at timestamptz;
