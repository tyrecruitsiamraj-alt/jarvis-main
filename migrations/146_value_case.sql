-- ═══ หน้าความคุ้มค่าระบบ (เจ้าของสั่ง 15 ต.ค. 2569) ═══
-- "ขอสักหน้าเอาไว้ดูคนเดียว เพื่อเอาไว้ Defend ผู้บริหาร ... เดิมใช้คนเท่าไหร่ โอทีเท่าไหร่ ระบบนี้ค่าใช้จ่ายเท่าไหร่"
-- เก็บตัวเลขที่เจ้าของกรอกเอง แถวละบัญชี (user_sub) — คนอื่นเปิดหน้านี้ไม่ได้ (ด่านที่ API) และไม่เห็นของกันเอง
-- payload = ValueCaseInputs (src/lib/valueCase.ts) · ตัวเลขฝั่งระบบคำนวณสดทุกครั้ง ไม่เก็บ

CREATE TABLE IF NOT EXISTS app_value_case (
  user_sub text PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
