-- บทพูดของ AI ที่เจ้าหน้าที่แก้เองจากหน้าตั้งค่า (เจ้าของสั่ง 27 ส.ค. 2569:
-- "เพิ่มที่ให้สร้าง Script ไว้หน่อยสิ ฉันแก้ Script การพูดจากฝั่งฉันแล้วให้มันส่งไป
--  พร้อมกันให้ Lumos เลย สร้างไว้หน้าตั้งค่าก็ได้")
--
-- เดิมบทอยู่ในไฟล์โค้ด (lumosCallScript.templates.ts) แก้ทีต้อง commit + deploy
-- ตารางนี้เก็บ "ฉบับแก้" — ระบบใช้ฉบับแก้ก่อน ไม่มีค่อยถอยไปใช้ฉบับในไฟล์
-- ⇒ ลบแถวทิ้ง = กลับเป็นบทมาตรฐานทันที (ทางถอยไม่ต้อง deploy)
--
-- หนึ่งแถวต่อหนึ่งบท: interview (สัมภาษณ์เบื้องต้น) · offer (เสนองาน) · follow (ติดตาม)
-- lines = ["ประโยคที่ 1", ...] รูปเดียวกับ array ในไฟล์บทเป๊ะ

create table if not exists call_script_overrides (
  script_key text primary key,
  lines jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

comment on table call_script_overrides is
  'บทพูด AI ฉบับที่เจ้าหน้าที่แก้จากหน้าตั้งค่า — มีแถว = ใช้แทนบทในไฟล์ · ลบแถว = กลับเป็นบทมาตรฐาน';
