-- กล่องรับผลดิบจาก Lumos — **เก็บทุกใบที่เขายิงเข้ามา ไม่ว่าจะจับคู่ได้หรือไม่**
-- (เจ้าของถาม 11 ก.ย. 2569: *"งงเพราะอะไรผลรอบแรกไม่ขึ้น ต่อให้บอกว่า completed
--  มันก็ต้องขึ้นนะ"*)
--
-- 🔴 ปัญหา: ของเดิม `applyLumosResult()` คืน `false` เมื่อจับคู่ไม่ได้ แล้ว**ทิ้งเงียบ**
-- ตัวเลข `matched` ไปอยู่ใน response กับ log บนเซิร์ฟเวอร์เท่านั้น ⇒ เวลา "ผลไม่ขึ้น"
-- เราแยกไม่ออกเลยระหว่าง
--    (ก) Lumos ไม่เคยส่งมา        → เรื่องของเขา
--    (ข) ส่งมาแล้วแต่เราจับคู่ไม่ได้ → เรื่องของเรา
-- ต้องมีหลักฐานขาเข้าถึงจะตอบได้ · เรามี log ขาออกละเอียดแล้ว ขาเข้ายังไม่มี
--
-- เก็บ **ทุกใบ** ไม่ใช่เฉพาะใบที่จับคู่ไม่ได้ เพราะคำถามที่เจอบ่อยคือ "เขาส่งมากี่ใบ"
-- ซึ่งตอบได้ก็ต่อเมื่อเก็บครบ
--
-- ใครใช้: api/_handlers/lumos-reminder.ts (เขียน) · ไว้ query ตอนไล่ปัญหา
-- ⚠️ ตารางนี้โตเรื่อย ๆ — ลบของเก่าทิ้งได้ตามสบาย ไม่มีใครอ้างอิง (ไม่มี FK)

create table if not exists lumos_result_inbox (
  id              bigserial primary key,
  channel         text        not null,
  /** ค่าที่เขาส่งมาในใบนั้น — แกะไว้เป็นคอลัมน์ให้ค้นง่าย (ของจริงอยู่ใน payload) */
  client_ref      text        null,
  plan_id         text        null,
  step_id         text        null,
  step_position   smallint    null,
  status          text        null,
  outcome         text        null,
  /** จับคู่เข้าคิวได้ไหม — false = ผลนี้ไม่ได้ขึ้นจอที่ไหนเลย ต้องมีคนดู */
  matched         boolean     not null,
  /** เหตุที่จับคู่ไม่ได้ (null เมื่อจับคู่ได้) */
  unmatched_reason text       null,
  payload         jsonb       not null,
  received_at     timestamptz not null default now()
);

create index if not exists lumos_result_inbox_received_idx
  on lumos_result_inbox (received_at desc);
create index if not exists lumos_result_inbox_unmatched_idx
  on lumos_result_inbox (matched, received_at desc);
create index if not exists lumos_result_inbox_client_idx
  on lumos_result_inbox (client_ref, step_position);

comment on table lumos_result_inbox is
  'ผลดิบทุกใบที่ Lumos ยิงเข้ามา (จับคู่ได้/ไม่ได้ก็เก็บ) — ไว้พิสูจน์ว่า "ผลไม่ขึ้น" '
  'เป็นเพราะเขาไม่ส่ง หรือเราจับคู่ไม่ได้ · ลบของเก่าทิ้งได้ ไม่มีใครอ้างอิง';
