-- ขั้นของคนที่คุยแล้วสนใจ + เช็คลิสต์เตรียมเข้างาน
-- (เจ้าของสั่ง 16 ส.ค. 2569 ข้อ 5 และ 6 ของงานคัดสรร)
--
-- ข้อ 5: "หากคุยแล้วสนใจให้มีสถานะเลือกให้กับคนคนนั้นแบบ Dropdown ดังนี้
--         รอนายพิจารณา รอนัดวันสัมภาษณ์ รอผลสัมภาษณ์ รอเริ่มงาน ช่วงประเมิน รอแจ้งเข้า"
-- ข้อ 6: "มีให้ติ๊ก ลงแผนแจ้งเข้า ผลคดี ผลตรวจสุขภาพ เบิกเสื้อ แจ้งประกัน"
--
-- ⚠️ **ไม่แตะ `status` เดิม** (new/contacted/converted/rejected) — ตัวนั้นคือ
-- "ขั้นที่คนทำกับใบ" ซึ่งทั้งระบบใช้อยู่ (แท็บ RM · dashboard · ตัวนับ)
-- ตัวใหม่นี้คือ "ขั้นของคนในกระบวนการจ้าง" ซึ่งลึกกว่าและมาทีหลังเสมอ
-- เอาไปทับกันเมื่อไหร่ = ตัวเลขทุกหน้าเพี้ยนพร้อมกัน
--
-- เช็คลิสต์เก็บเป็น jsonb ไม่ใช่ 5 คอลัมน์ — เจ้าของเติมรายการเรื่อย ๆ
-- (ผลคดี/สุขภาพ/เสื้อ/ประกัน มาทีหลังทั้งนั้น) เพิ่มรายการใหม่จะได้ไม่ต้อง migrate อีก
-- คีย์ที่ระบบรู้จักอยู่ที่ src/lib/selectionProgress.ts ที่เดียว

ALTER TABLE public_job_applications
  ADD COLUMN IF NOT EXISTS selection_status text NULL,
  ADD COLUMN IF NOT EXISTS prep_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ดูรายชื่อตามขั้นได้เร็ว (หน้าคัดสรรกรองด้วยขั้นเป็นหลัก)
CREATE INDEX IF NOT EXISTS public_job_applications_selection_status_idx
  ON public_job_applications (selection_status)
  WHERE selection_status IS NOT NULL;
