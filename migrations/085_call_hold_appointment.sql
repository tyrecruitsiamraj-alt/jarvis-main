-- ผลโทร "สนใจ" แยกเป็น นัดได้ / ยังนัดไม่ได้ + เก็บวันนัดจริง
--
-- เจ้าของสั่ง 14 ส.ค. 2569: "สนใจก็ยังมีสนใจแล้วนัดได้ กับยังนัดไม่ได้อะ"
-- แพตเทิร์นเดียวกับ "ไม่สนใจ" ที่แยก job/all อยู่แล้ว จึงใช้คอลัมน์ result_scope ตัวเดิม
-- **ไม่เพิ่ม outcome ใหม่** เพราะศัพท์ outcome ต้องเป็นค่าที่ Lumos ส่งกลับได้จริง
-- (funnel เอาผลของคนกับของ AI มานับรวมกันด้วยคีย์ชุดนั้น)
--
-- ⚠️ migration 068 ใส่ CHECK ไว้ที่คอลัมน์ result_scope — เพิ่มค่าใหม่โดยไม่ผ่อน CHECK
-- = บันทึกผลโทร 500 ทั้งที่โค้ดผ่านหมด (กับดักเดิมเป๊ะกับ source ในรอบ 077)
-- ตัวตรวจค่าจริงอยู่ที่ `resolveAppointment()` ใน src/lib/callAppointment.ts
-- CHECK นี้เป็นแค่รั้วชั้นฐาน — เพิ่ม scope ใหม่ครั้งหน้าต้องแก้ทั้งสองที่

alter table candidate_call_holds
  drop constraint if exists candidate_call_holds_result_scope_check;

alter table candidate_call_holds
  add constraint candidate_call_holds_result_scope_check
  check (result_scope in ('job', 'all', 'scheduled', 'unscheduled'));

-- วันนัดสัมภาษณ์ที่ตกลงกันได้ตอนโทร
--
-- ⚠️ **จงใจเก็บที่แถวผลโทร ไม่ใช่ตาราง candidate_interviews เดิม** — ตารางนั้นผูกด้วย
-- `candidate_id` (ตาราง candidates ซึ่งบนฐานมีแถวเดียว) ส่วนแถวที่แท็บติดตามนัดหมาย
-- แสดงคือ **ใบสมัคร** (public_job_applications) ที่ไม่มีคอลัมน์ candidate_id เลย
-- ต่อสองอันนั้นเข้าหากันไม่ได้ · แถวล็อกโทรมี (source, candidate_ref) อยู่แล้ว
-- ซึ่ง source='application' → candidate_ref = id ของใบสมัครตรง ๆ
alter table candidate_call_holds
  add column if not exists appointment_at timestamptz null;

-- แท็บติดตามนัดหมายอ่านด้วย (source, candidate_ref) — เอาเฉพาะแถวที่มีวันนัดจริง
create index if not exists candidate_call_holds_appointment_idx
  on candidate_call_holds (source, candidate_ref, appointment_at)
  where appointment_at is not null;
