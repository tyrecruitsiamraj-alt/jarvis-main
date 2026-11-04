-- ═══ ลิงก์สมัครของกลุ่ม Facebook ผูกกับรหัสกลุ่ม ไม่ใช่ชื่อกลุ่ม (เจ้าของ 4 พ.ย. 2569) ═══
-- เดิมแยกลิงก์ด้วยชื่อลิงก์ ("Facebook · Facebook Group · <ชื่อกลุ่ม>") — 2 กลุ่มชื่อ "หางานขับรถผู้บริหาร" เป็นคนละกลุ่ม
-- (423954682082863 · 553130514463865) ได้ลิงก์เดียวกัน แยกไม่ออกว่าคนสมัครมาจากกลุ่มไหน
-- fb_group_id = รหัสกลุ่มท้าย /groups/ ใน URL (เลข หรือชื่ออังกฤษ) ตาม So Scraping · ลิงก์เก่าว่าง · เพิ่มอย่างเดียว
alter table if exists recruit_posting_links add column if not exists fb_group_id text null;
create index if not exists recruit_posting_links_posting_fb_group_idx
  on recruit_posting_links (posting_id, fb_group_id) where fb_group_id is not null;
