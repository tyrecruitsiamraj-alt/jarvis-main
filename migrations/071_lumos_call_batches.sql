-- ชุดส่งงานโทร + อนุมัติ + ช่วงถอนคำ
--
-- โจทย์จากเจ้าของ: "อนุมัติไปแล้วแล้วอยากยกเลิกมีปรับแก้อะไรจะได้ทำได้"
-- ทางแก้: อนุมัติแล้วยัง **ไม่เข้าคิวจริงทันที** — ตั้งเวลาปล่อย (release_at) ไว้ข้างหน้า
-- ระหว่างนั้นยกเลิก/ถอนคนออกได้ทั้งชุด · พ้นเวลาแล้วค่อยเข้าคิว Lumos
--
-- ชั้นนี้ทำให้โหมด assist เป็นไปได้ (ระบบจัดชุดให้ คนกดยืนยันทีเดียว)
-- และเป็นเส้นทางเดียวกับ auto ในอนาคต — auto = ระบบสร้างชุดแล้วข้ามไป approved เอง
--
-- ไม่มี cron: ปล่อยชุดที่ถึงเวลาแบบ lazy (เรียกก่อนอ่านรายการ และก่อนเสิร์ฟคิวให้ Lumos)

CREATE TABLE IF NOT EXISTS lumos_call_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('reminder', 'interview')),

  -- ชุดนี้ของใบขอไหน
  job_id text NOT NULL,
  request_no text NULL,

  -- draft            = ยังแก้รายชื่อได้ ไม่มีใครเห็นว่าต้องอนุมัติ
  -- pending_approval = รออนุมัติ
  -- approved         = อนุมัติแล้ว แต่ยังไม่ถึงเวลาปล่อย (ยกเลิกได้ในช่วงนี้)
  -- dispatched       = เข้าคิว Lumos แล้ว (ยกเลิกรายคนได้เท่าที่ Lumos ยังไม่ดึงไป)
  -- cancelled        = ยกเลิกทั้งชุด
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'dispatched', 'cancelled')),

  -- ถึงเวลานี้แล้วค่อยเข้าคิวจริง (ช่วงถอนคำ) · null = ยังไม่อนุมัติ
  release_at timestamptz NULL,

  created_by_user_id uuid NULL,
  created_by_name text NULL,
  approved_by_user_id uuid NULL,
  approved_by_name text NULL,
  approved_at timestamptz NULL,
  dispatched_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  cancelled_by_name text NULL,
  cancel_reason text NULL,

  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- รายชื่อในชุด — เก็บแค่ตัวชี้ (source + ref) ตัว payload สร้างตอนปล่อยเข้าคิว
-- เพื่อให้ชื่อ/เบอร์เป็นค่าล่าสุดตอนโทรจริง ไม่ใช่ snapshot ตอนกดเลือก
CREATE TABLE IF NOT EXISTS lumos_call_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES lumos_call_batches(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('board', 'irecruit')),
  candidate_ref text NOT NULL,
  candidate_name text NULL,
  -- ถอนคนออกจากชุดระหว่างรออนุมัติ/รอปล่อย (ไม่ลบแถว เก็บไว้ดูว่าใครถอนออก)
  removed_at timestamptz NULL,
  removed_by_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, source, candidate_ref)
);

CREATE INDEX IF NOT EXISTS lumos_call_batches_status_idx
  ON lumos_call_batches (status, release_at);
CREATE INDEX IF NOT EXISTS lumos_call_batches_job_idx
  ON lumos_call_batches (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lumos_call_batch_items_batch_idx
  ON lumos_call_batch_items (batch_id, removed_at);
