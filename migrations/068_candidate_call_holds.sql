-- "รับไปโทรเอง" — ล็อกสิทธิ์โทรผู้สมัครทีละคน กันเจ้าหน้าที่ 6 คนโทรชนกัน และกัน AI โทรซ้ำ
--
-- ล็อกผูกกับ **เบอร์โทร (E.164)** ไม่ใช่ candidate_ref
-- เพราะคนคนเดียวมีหลายรหัสได้ (บอร์ดใช้ card_id · iRecruit ใช้ id · Follow ใช้ follow-<id>)
-- แต่เบอร์ที่ดังมีเบอร์เดียว — ล็อกที่ ref จะกันไม่อยู่จริง
--
-- อายุล็อก 1 วัน (เจ้าของกำหนด 6 ส.ค. 2569) ครบแล้วคายคืนถังกลางเอง
-- ผลโทรใช้ศัพท์ชุดเดียวกับที่ Lumos ส่งกลับ (confirmed/declined/no_answer/...)
-- เพื่อให้ funnel นับรวม "ผลจากคน" กับ "ผลจาก AI" เป็นชุดเดียว ไม่ต้องแยกไซโล

CREATE TABLE IF NOT EXISTS candidate_call_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- กุญแจล็อก
  phone_e164 text NOT NULL,

  -- ใครถูกถือ (เก็บไว้โชว์ ไม่ใช่กุญแจ)
  source text NOT NULL CHECK (source IN ('board', 'irecruit')),
  candidate_ref text NOT NULL,
  candidate_name text NULL,

  -- ถือมาจากใบขอไหน (บริบทตอนโทร + ใช้จัดคิวในหน้า "โทรของฉัน")
  job_id text NOT NULL,
  request_no text NULL,

  -- ใครถือ
  held_by_user_id uuid NULL,
  held_by_name text NULL,

  held_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 day',

  -- ปล่อยแล้วหรือยัง · null = ยังถืออยู่
  released_at timestamptz NULL,
  release_reason text NULL CHECK (release_reason IN ('result', 'manual', 'expired', 'transferred', 'to_ai')),

  -- ผลโทรที่คนบันทึก — ศัพท์เดียวกับ Lumos outcome
  result_outcome text NULL CHECK (result_outcome IN (
    'confirmed', 'declined', 'reschedule_requested', 'no_answer', 'wrong_person'
  )),
  -- ปฏิเสธแบบไหน: job = ไม่เอางานนี้ (AI เสนองานอื่นต่อได้) · all = ไม่หางานแล้ว (พักเบอร์)
  result_scope text NULL CHECK (result_scope IN ('job', 'all')),
  result_note text NULL,
  -- ข้อมูลต่อท้ายตามชนิดผล (เวลานัดใหม่ · ค่าจ้างที่ตกลง · เบอร์ใหม่)
  result_detail jsonb NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- หัวใจของการกันชน: หนึ่งเบอร์มีล็อกที่ยังไม่ปล่อยได้ทีเดียวเท่านั้น
-- (partial unique — แถวที่ปล่อยแล้วเก็บเป็นประวัติได้ไม่จำกัด)
CREATE UNIQUE INDEX IF NOT EXISTS candidate_call_holds_one_active_per_phone
  ON candidate_call_holds (phone_e164)
  WHERE released_at IS NULL;

-- อ่านล็อกของหลายเบอร์พร้อมกันตอนวาดการ์ดในหน้า Matching
CREATE INDEX IF NOT EXISTS candidate_call_holds_active_lookup_idx
  ON candidate_call_holds (phone_e164, released_at);

-- หน้า "โทรของฉัน" + บอร์ดหัวหน้า
CREATE INDEX IF NOT EXISTS candidate_call_holds_holder_idx
  ON candidate_call_holds (held_by_user_id, released_at, expires_at);

-- กวาดล็อกหมดอายุ
CREATE INDEX IF NOT EXISTS candidate_call_holds_expiry_idx
  ON candidate_call_holds (released_at, expires_at);
