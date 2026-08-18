-- สมุดรายชื่อ+เบอร์เจ้าหน้าที่ผู้ติดตาม (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ):
-- ช่อง "เบอร์เจ้าหน้าที่" บนหน้า Follow เปลี่ยนจากพิมพ์เองทุกครั้ง → เลือกจากรายชื่อกลาง
-- เพิ่มชื่อใหม่ได้เฉพาะ supervisor ขึ้นไป — **คุมที่ API (rbac)** ตารางไม่ผูก CHECK role
-- (บทเรียน CHECK constraint 035/097: ค่าตายตัวในฐานคือกับดักตอนเพิ่มบทบาทใหม่)
--
-- ⚠️ เบอร์ในนี้คือ "เบอร์ที่ AI บอกให้ผู้สมัครโทรกลับ" — ไม่ใช่เบอร์ที่ระบบโทรออก
-- เบอร์บ้าน/เบอร์ต่อภายใน ("021234567 ต่อ 101") ใช้ได้ จึงเก็บเป็น text ตามที่คนพิมพ์

create table if not exists follow_staff_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  created_by uuid null,
  created_by_name text null,
  created_at timestamptz not null default now()
);

comment on table follow_staff_contacts is
  'รายชื่อเจ้าหน้าที่ผู้ติดตาม (ชื่อ+เบอร์โทรกลับ) — dropdown บนหน้า Follow · เพิ่มได้เฉพาะ supervisor+';

-- กันคีย์ซ้ำ: ชื่อเดียวกัน (ไม่สนตัวพิมพ์/ช่องว่างหัวท้าย) + เบอร์เดียวกัน (เทียบเฉพาะตัวเลข)
-- = แถวเดียว · ชื่อเดิมแต่เบอร์ใหม่ยังเพิ่มได้ (คนเดียวมีหลายเบอร์ได้จริง)
create unique index if not exists follow_staff_contacts_name_phone_idx
  on follow_staff_contacts (lower(trim(name)), regexp_replace(phone, '\D', '', 'g'));
