-- บัญชี Facebook ที่ Autopost ส่งผ่าน phone-box (มือถือ) แทน So Scraping (RM009)
-- เจ้าของ 18 พ.ย. 2569: "ยิงไป Phone box เลย สำหรับ 4 บัญชีนั้น และไม่ปนไปกับ Rm009 แล้วเพื่อลดโอกาสถูกปิด"
-- ติ๊ก/ถอนได้ที่ ตั้งค่า › เชื่อมระบบภายนอก › phone-box · ชื่อบัญชีใช้จับคู่กับบัญชีที่เลือกใน Autopost
-- ตั้งต้น 4 บัญชีที่เจ้าของเลือก (Thom Blake อยู่ใน phone-box แต่เจ้าของไม่ได้เลือก = ยังไม่ติ๊ก)

create table if not exists phone_box_post_accounts (
  account_id text primary key,
  account_name text not null,
  enabled boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into phone_box_post_accounts (account_id, account_name, enabled, updated_by) values
  ('fb-usb-210969483d037ece', 'Tarris Mcreynolds', true, 'ระบบ'),
  ('fb-usb-21a14a10d20d7ece', 'Clarissa Glady', true, 'ระบบ'),
  ('fb-usb-22096b2c20017ece', 'Gring Magail', true, 'ระบบ'),
  ('fb-usb-2259433130047ece', 'Jannie Penelope', true, 'ระบบ')
on conflict (account_id) do nothing;
