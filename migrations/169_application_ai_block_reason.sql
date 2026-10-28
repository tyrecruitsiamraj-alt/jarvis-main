-- ═══ เหตุที่ตัวส่งอัตโนมัติยังไม่ส่งใบนี้ให้ AI (เจ้าของ 28 ต.ค. 2569 "ทำไมไม่โทร") ═══
-- เคสคุณหนึ่ง: คีย์เองเลือก AI แล้ว แต่ใบขอยังไม่ตั้งรายได้ ⇒ ตัวส่งข้ามทุก 5 นาที แต่จอบอก "ยังไม่กดส่ง AI"
-- ตัวส่ง (applicationDispatchRetry) จดเหตุล่าสุด · จอโชว์ในบรรทัดเหตุผล · เพิ่มอย่างเดียว
alter table if exists public_job_applications add column if not exists ai_block_reason text null;
alter table if exists public_job_applications add column if not exists ai_block_at timestamptz null;
