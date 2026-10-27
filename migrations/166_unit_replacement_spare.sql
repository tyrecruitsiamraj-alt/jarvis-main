-- ═══ ส่งคนแทนแบบ Spare (หน้าใบขอ · เจ้าของ 27 ต.ค. 2569 "ช่องส่งคนแทนเพิ่ม spare" · Choice "ตัวเลือกที่ 4 นับเป็นต้องส่งคนแทน") ═══
-- ใบ Spare = send_replacement true + replacement_spare true ⇒ ตัวกรอง/ตัวเลข "ต้องส่งคนแทน" นับรวมเองโดยไม่ต้องแก้
alter table if exists siamraj_unit_notes add column if not exists replacement_spare boolean not null default false;
