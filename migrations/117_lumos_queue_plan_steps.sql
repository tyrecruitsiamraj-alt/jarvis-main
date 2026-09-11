-- หลายสายของคนเดียวกัน = **แผนเดียวหลาย step** (เจ้าของสั่ง 11 ก.ย. 2569)
--
-- 🔴 ปัญหาเดิม: ตั้งโทร 2 รอบ ⇒ เราสร้าง **2 แผนแยกกัน** ไปที่เบอร์เดียวกัน
-- วัดจริง 11 ก.ย.: ชุดที่สร้างพร้อมกันบนเบอร์เดียวกัน สายที่นัดทีหลังได้ผล 7/16
-- ส่วนสายที่นัดก่อนได้ผลแค่ 1/16 ⇒ แผนหลังไปทับแผนแรก สายแรกจึงไม่ได้โทร
--
-- Lumos ออกแบบมาให้ **1 แผนมีได้หลาย step** อยู่แล้ว (`steps[]`) และมี `stop_early`
-- หยุด step ที่เหลือเองเมื่อได้คำตอบชัด (ไม่ไป/ยกเลิก) — ตรงกับที่เจ้าของต้องการเป๊ะ
--
-- แต่ผลที่ส่งกลับผูกด้วย `client_contact_id` ของ**แผน** ไม่ใช่ของแต่ละ step
-- ⇒ ถ้ารวมแผนโดยไม่ทำอะไร ผลของ step หลังจะทับ step แรก แล้ว "บอกผลทุกรอบ" พัง
-- สองคอลัมน์นี้คือตัวผูกผลกลับเข้า **แถวของรอบนั้น ๆ**:
--   plan_ref      = client_contact_id ของแผน (ของแถวหัวขบวน) — ทุกแถวในแผนเดียวกันค่าเท่ากัน
--   step_position = ลำดับ step ในแผน (0-based) ตรงกับที่ Lumos ส่งกลับมา
--
-- ใครใช้: api/_lib/lumosDispatch.ts (เขียนตอน enqueue · อ่านตอน applyLumosResult)
-- ⚠️ แถวเก่าที่เป็นแผนเดี่ยวมีค่าเป็น null ทั้งคู่ — ตัวจับผลต้องถอยไปจับด้วย
--    `payload->>'client_contact_id'` แบบเดิมเสมอ (ห้ามบังคับให้มีค่า)

alter table lumos_dispatch_queue
  add column if not exists plan_ref text,
  add column if not exists step_position smallint;

create index if not exists lumos_dispatch_queue_plan_ref_idx
  on lumos_dispatch_queue (plan_ref, step_position);

comment on column lumos_dispatch_queue.plan_ref is
  'client_contact_id ของแผนที่แถวนี้อยู่ (แผนเดียวมีได้หลายแถว = หลายรอบโทร) · null = แผนเดี่ยวแบบเดิม';
comment on column lumos_dispatch_queue.step_position is
  'ลำดับ step ในแผน (0-based) ตรงกับค่าที่ Lumos ส่งกลับ · ใช้ผูกผลเข้าแถวของรอบนั้น';
