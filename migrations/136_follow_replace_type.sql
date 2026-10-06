-- ═══ ติดตามส่งคนแทน: เก็บประเภทจาก iRecruit ลงแถว (เจ้าของสั่ง 6 ต.ค. 2569) ═══
-- > "งั้นต้องแยก Ex กับ คนในให้หน่อยแล้วกันหน้านี้ เพิ่ม Filter มา"
--
-- follow_entries.replace_type — ค่า replace_type ของใบส่งคนแทนใน iRecruit (EX = คนนอก · อื่น ๆ = คนใน)
-- รอบดึง iRecruit (api/_lib/irecruitReplaceSync.ts ขั้น 3.5) เติม/อัปเดตทุกรอบตาม source_ref
-- แถวที่คีย์เองหรือแถวเก่านอกช่วงที่ดึง = null (หน้าจอขึ้น "ไม่ระบุ")

alter table follow_entries
  add column if not exists replace_type text;

comment on column follow_entries.replace_type is
  'ประเภทใบส่งคนแทนจาก iRecruit (EX = คนนอก ให้ AI โทร · อื่น ๆ = คนใน ให้คนโทร) — รอบดึงเติมให้ · null = ไม่ได้มาจาก iRecruit/ยังไม่รู้ · 6 ต.ค. 2569';
