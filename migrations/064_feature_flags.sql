-- สวิตช์แม่ระดับฟีเจอร์ — คนละชั้นกับตารางสิทธิ์ (role_function_grants)
--
-- ชั้นนี้ตอบว่า "ฟีเจอร์นี้เปิดใช้งานในระบบหรือยัง"
-- ชั้นสิทธิ์ตอบว่า "เปิดแล้วใครใช้ได้บ้าง"
-- ปิดชั้นนี้ = ไม่มีใครเห็น แม้ตารางสิทธิ์จะเปิดให้ (ยกเว้น admin ที่ต้องทดสอบบนของจริง)
--
-- ใช้ตอน deploy ฟีเจอร์ขึ้นไปแล้วแต่ยังไม่พร้อมให้ทีมใช้ — เดิมต้องไปปิดสิทธิ์ทีละ role
-- ซึ่งปนกันสองเรื่องและเผลอปิดไม่ครบได้
--
-- ไม่มี CHECK ผูกรายชื่อฟีเจอร์ — ตรวจที่ API จาก constant ชุดเดียว
-- (บทเรียนเดียวกับ work_status_master / recruit_postings)

create table if not exists feature_flags (
  feature_id text primary key,
  /** false = ปิด (เห็นเฉพาะ admin) · แถวที่ไม่มีในตาราง = เปิด (ค่าเริ่มต้น) */
  enabled boolean not null default true,
  /** เหตุผลที่ปิด — ให้ admin คนอื่นรู้ว่าปิดไว้ทำไม */
  note text null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references users (id) on delete set null
);
