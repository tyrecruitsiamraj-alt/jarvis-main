-- ช่องทางรับสมัคร — เตรียมยกของจริงจาก iRecruit (หลัก 43 · ย่อย 4,347)
--
-- ที่มา: `recruit_master_channel` → `recruit_master_sub_channel` บน iRecruit SQL Server
-- โครง 2 ระดับตรงกับ `recruit_channels` ที่มีอยู่แล้ว จึงไม่ต้องเปลี่ยนโครง แค่เติม 2 อย่าง:
--   1) ที่มา (`source` + `source_id`) เพื่อให้ยกซ้ำได้โดยไม่เกิดของซ้ำ (upsert ตาม id เดิม)
--      และเพื่อให้ตอนยกใบสมัคร 156,446 ใบทีหลัง แปลง `recruit_register.channel_id`
--      กลับมาเป็น uuid ฝั่งเราได้ตรงตัว
--   2) ผ่อนกฎ "ชื่อห้ามซ้ำ" ให้เหลือเฉพาะช่องทางที่คนคีย์เอง
--
-- ⚠️ เหตุผลของข้อ 2 (วัดจากข้อมูลจริง 11 ส.ค. 2569 — ไม่ใช่การเผื่อไว้):
--   · ช่องทางหลักชื่อซ้ำกันจริง — "Facebook Group" มี 2 แถว (id=60 ลูก 4,187 · id=84 ลูก 36)
--   · ชื่อช่องย่อยซ้ำในพ่อเดียวกัน 53 คู่
--   ยกดิบ ๆ เข้ามาจะชน `recruit_channels_parent_name_idx` แล้วตกหล่นเงียบ ๆ
--   ทางเลือกคือ "ยุบชื่อซ้ำ" กับ "ยกตามจริง" — เจ้าของเคาะ "ยกทั้งหมด" จึงยกตามจริง
--   ของที่คนคีย์เองยังกันซ้ำเหมือนเดิมทุกอย่าง (สร้าง/แก้ชื่อ ยังได้ error เดิม)

alter table recruit_channels
  add column if not exists source text null;

/** id ฝั่งระบบต้นทาง เก็บเป็น text เพราะ iRecruit ใช้ bigint แต่ระบบอื่นอาจไม่ใช่ */
alter table recruit_channels
  add column if not exists source_id text null;

-- ยกซ้ำได้: หนึ่ง id ต้นทาง = หนึ่งแถวฝั่งเรา (ตัว upsert อาศัย index นี้)
create unique index if not exists recruit_channels_source_idx
  on recruit_channels (source, source_id)
  where source is not null;

-- ชื่อห้ามซ้ำ — เหลือเฉพาะแถวที่คนคีย์เอง (source is null)
drop index if exists recruit_channels_parent_name_idx;

create unique index if not exists recruit_channels_manual_parent_name_idx
  on recruit_channels (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)))
  where source is null;

-- ค้นหาด้วย q: ตารางระดับ 4 พันแถว ILIKE ยังเร็วพอ แต่ต้องมี index ให้ list ตามพ่อ
create index if not exists recruit_channels_parent_idx
  on recruit_channels (parent_id, sort_order);
