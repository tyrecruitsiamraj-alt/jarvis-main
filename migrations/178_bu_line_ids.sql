-- ═══ แอดไลน์ประจำ BU ในข้อความประกาศ (เจ้าของ 13 พ.ย. 2569) ═══
-- "ในแคปชั่นต้องใส่ id line ด้วย" · Choice "ID LINE กลางของบริษัท แต่แยก Bu" · บรรทัด "แอดไลน์ : xxx"
-- ตั้งที่ ตั้งค่า › แอดไลน์ประจำ BU (admin) · ไม่มีแถว = ไม่มีบรรทัดแอดไลน์ · เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
create table if not exists bu_line_ids (
  bu text primary key,
  line_id text not null,
  updated_by text null,
  updated_at timestamptz not null default now()
);
