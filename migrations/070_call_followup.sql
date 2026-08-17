-- ลูปโทรซ้ำ + นัดโทรใหม่อัตโนมัติจากผลโทร
--
-- ปัญหาเดิม: Lumos ส่งผลกลับมาครบทุกแบบอยู่แล้ว (confirmed / declined /
-- reschedule_requested / no_answer / busy / unresponsive / wrong_person)
-- แต่ระบบเอามาแค่ "โชว์" ไม่มีใครทำอะไรต่อ → งานตายคาที่
-- คนไม่รับสาย 1 ครั้งก็จบเลย ทั้งที่ควรโทรซ้ำ · ขอเลื่อนก็ไม่มีใครนัดใหม่ให้
--
-- ตารางคิวเดิมมี unique (channel, job_ref, person_ref) จึง insert แถวใหม่เพื่อโทรซ้ำไม่ได้
-- วิธีที่ใช้: ตั้งแถวเดิมกลับเป็น pending + นับ attempt + กำหนดเวลาโทรครั้งถัดไป
-- (takePendingLumosItems จะข้ามแถวที่ยังไม่ถึงเวลา)

ALTER TABLE lumos_dispatch_queue
  -- โทรไปกี่ครั้งแล้ว (ครั้งแรกที่ส่งเข้าคิว = 1)
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  -- ยังไม่ถึงเวลานี้ = ห้ามเสิร์ฟให้ Lumos · null = พร้อมเสิร์ฟทันที
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NULL,
  -- ผลโทรครั้งล่าสุด (ศัพท์เดียวกับ Lumos outcome)
  ADD COLUMN IF NOT EXISTS last_outcome text NULL,
  -- สถานะการตามงานหลังได้ผล — null = ยังไม่มีผล
  --   retry_scheduled = นัดโทรซ้ำแล้ว · needs_human = AI เอาไม่อยู่ ต้องคนตาม
  --   closed = จบแล้ว (สนใจ/ปฏิเสธ/เบอร์ผิด)
  ADD COLUMN IF NOT EXISTS followup_state text NULL
    CHECK (followup_state IS NULL OR followup_state IN ('retry_scheduled', 'needs_human', 'closed'));

-- เสิร์ฟคิว: ต้องกรองด้วย next_attempt_at ทุกครั้ง
CREATE INDEX IF NOT EXISTS lumos_dispatch_queue_next_attempt_idx
  ON lumos_dispatch_queue (channel, status, next_attempt_at);

-- ถัง "ต้องคนตาม" ในหน้า Follow อ่านจากนี่
CREATE INDEX IF NOT EXISTS lumos_dispatch_queue_followup_idx
  ON lumos_dispatch_queue (followup_state, updated_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- พักเบอร์ — "ไม่หางานแล้ว" ต้องไม่ถูกโทรอีกไม่ว่าจากใบขอไหน
-- ผูกกับเบอร์ (E.164) ด้วยเหตุผลเดียวกับ candidate_call_holds:
-- คนเดียวมีหลายรหัส แต่เบอร์ที่ดังมีเบอร์เดียว
CREATE TABLE IF NOT EXISTS candidate_call_suppression (
  phone_e164 text PRIMARY KEY,
  suppressed_until timestamptz NOT NULL,
  reason text NOT NULL CHECK (reason IN ('not_looking', 'wrong_number', 'manual')),
  note text NULL,
  created_by_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_call_suppression_until_idx
  ON candidate_call_suppression (suppressed_until);
