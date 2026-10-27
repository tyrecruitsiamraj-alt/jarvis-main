-- ═══ ตำแหน่งของคนที่ไปแทน (แท็บติดตามส่งคนแทน · เจ้าของ 27 ต.ค. 2569 "ช่องส่งคนแทนเพิ่มตำแหน่ง Spare") ═══
-- ตัวเลือกบนจอ = ไม่ระบุ / Spare (รายการอยู่ src/lib/followReplacement.ts) · null = ไม่ระบุ
alter table if exists follow_entries add column if not exists replace_position text;
