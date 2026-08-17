-- เบอร์ E.164 บนใบสมัคร (เจ้าของสั่ง 15 ส.ค. 2569 — Dashboard visual control กล่อง "เบอร์โทรผิด")
--
-- ปัญหาเดิม: เบอร์เก็บรูปไทย (0XXXXXXXXX) แต่ระบบโทร/ล็อก/ผลโทรคีย์ด้วย E.164
-- ผ่าน toE164Thai() ซึ่งรับเฉพาะมือถือ 10 หลัก → ใบที่เบอร์ 9 หลัก (เบอร์บ้าน —
-- intake รับ) เข้าฐานได้แต่ **ตายเงียบตลอดไป**: จับผลโทรไม่ได้ เก็บไปโทรไม่ได้
-- ส่ง Lumos ไม่ได้ และไม่มีอะไรบอกใครเลยว่าใบนี้มีปัญหา
--
-- ⚠️ เป็น **generated column** โดยตั้งใจ — คอลัมน์ธรรมดา + backfill มีหน้าต่างโกหก
-- 2 แบบ: โค้ดเก่า insert โดยไม่ set (null = อ่านผิดเป็น "เบอร์ผิด") และแก้ phone
-- แล้วลืมแก้ e164 · generated ตัดทั้งสองทาง Postgres คำนวณให้เองทุกแถวทุกการแก้
--
-- ⚠️ ฟังก์ชัน SQL นี้ต้องให้ผล **เท่ากับ toE164Thai() ใน api/_lib/thaiPhone.ts เป๊ะ**
-- (ที่นั่นห้ามก๊อปสูตร — ที่นี่คือข้อยกเว้นเดียวเพราะ generated column ต้องเป็น SQL
-- ล้วน) มีเทสต์ parity ยิง fixture ชุดเดียวกันผ่านทั้งสองทางที่
-- tests/api/phoneE164Parity.test.ts — แก้สูตรฝั่งไหนต้องแก้อีกฝั่ง + เทสต์ต้องผ่าน
--
-- null = "เบอร์ใช้กับระบบโทรไม่ได้" → กล่อง "เบอร์โทรผิด" บน dashboard นับจากตรงนี้

create or replace function jarvis_phone_e164_thai(raw text) returns text
  language sql immutable returns null on null input as $$
    select case
      when d like '66%' and length(d) = 11 then '+' || d
      when d like '0%'  and length(d) = 10 then '+66' || substr(d, 2)
      else null
    end
    from (select regexp_replace(raw, '\D', '', 'g') as d) t
  $$;

alter table public_job_applications
  add column if not exists phone_e164 text
    generated always as (jarvis_phone_e164_thai(phone)) stored;

-- คีย์จับคู่ผลโทร/ล็อกข้ามตาราง — dashboard และ drill-down join ด้วยคอลัมน์นี้
create index if not exists public_job_applications_phone_e164_idx
  on public_job_applications (phone_e164);
