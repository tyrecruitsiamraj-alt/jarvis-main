-- ผลคัดกรองผู้สมัครที่ Jarvis เก็บเอง — เหล้า/บุหรี่ + ประวัติคดี
--
-- ทำไมต้องมีตารางนี้: เกณฑ์เรียงผู้สมัคร (src/lib/candidatePriority.ts) มีข้อ "เหล้า/บุหรี่"
-- กับ "ประวัติคดี" ตามที่เจ้าของกำหนด แต่บอร์ด iRecruit (SQL Server ของ ERP) ไม่มีสองฟิลด์นี้
-- และเราไปเพิ่มคอลัมน์ในฐานของ ERP ไม่ได้ จึงเก็บเป็น "ชั้นทับ" ฝั่ง Jarvis
-- ผูกด้วยคู่ (source, candidate_ref) แบบเดียวกับ candidate_proposals (migration 044)
--
-- ค่า unknown = ยังไม่ได้ถาม (ต่างจาก 'no' ที่ยืนยันแล้วว่าไม่)
-- เกณฑ์เรียงไม่นับ unknown ทั้งตัวตั้งและตัวหาร — คนที่ยังไม่ถูกคัดกรองจึงไม่ถูกลงโทษ

CREATE TABLE IF NOT EXISTS candidate_screening (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('board', 'irecruit')),
  candidate_ref text NOT NULL,
  candidate_name text NULL,

  drinking text NOT NULL DEFAULT 'unknown' CHECK (drinking IN ('yes', 'no', 'unknown')),
  smoking text NOT NULL DEFAULT 'unknown' CHECK (smoking IN ('yes', 'no', 'unknown')),
  criminal_record text NOT NULL DEFAULT 'unknown' CHECK (criminal_record IN ('yes', 'no', 'unknown')),
  -- รายละเอียดคดี (ถ้ามี) — ข้อมูลอ่อนไหว เก็บเป็นบันทึกของเจ้าหน้าที่ ไม่เอาไปคิดคะแนนอัตโนมัติ
  criminal_note text NULL,

  screened_by_user_id uuid NULL,
  screened_by_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source, candidate_ref)
);

-- อ่านทีเดียวหลายคนตอนเปิดใบขอ (WHERE source = $1 AND candidate_ref = ANY($2))
CREATE INDEX IF NOT EXISTS candidate_screening_lookup_idx
  ON candidate_screening (source, candidate_ref);
