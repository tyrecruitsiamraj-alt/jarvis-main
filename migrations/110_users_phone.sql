-- เบอร์โทรผู้ใช้ระบบ (เจ้าของสั่ง 26 ส.ค. 2569):
-- ใช้เป็น admin_phone ส่งให้ Lumos ตอนส่งคิวสัมภาษณ์ — AI โทรกลับเบอร์นี้เมื่อโทรหา
-- ผู้สมัครไม่สำเร็จ ให้ผู้รับผิดชอบใบขอ (หรือ supervisor เมื่อหาผู้รับผิดชอบไม่ได้) รับแทน
--
-- เก็บเป็น E.164 (+66...) เสมอ — normalize ตอนบันทึกที่ API (toE164Thai) เหมือนเบอร์อื่นในระบบ

alter table users add column if not exists phone text;

comment on column users.phone is
  'เบอร์โทรผู้ใช้ (E.164) — ใช้เป็น admin_phone ส่งให้ Lumos ตอน AI โทรผู้สมัครสัมภาษณ์ไม่สำเร็จ';
