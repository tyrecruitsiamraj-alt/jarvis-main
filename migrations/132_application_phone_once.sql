-- ═══ เบอร์เดียวเข้าระบบได้ครั้งเดียว (1 ต.ค. 2569) ═══
--
-- เจ้าของ (Choice): "แจ้งเลยว่าเคยสมัครไปแล้ว ไม่เอาเบอร์ซ้ำเข้าระบบ" · ขอบเขต "เบอร์เดิม ไม่ว่างานไหน"
-- ใช้กับทุกทางเข้า: หน้าสมัคร (`/api/public/apply`) · ปุ่มเพิ่มผู้สมัคร · นำเข้า Excel · แก้เบอร์
--
-- ที่มา (วัดจากฐาน 1 ต.ค. 2569): 134 ใบ · 5 เบอร์กรอกงานเดิมซ้ำ เกินมา 6 ใบ (4 ใบภายใน 24 ชม. · 2 ใบภายใน 10 นาที)
-- และ **ทั้ง 5 คนโดน AI โทรเรื่องงานเดิม 2 สาย** (คิว AI กันซ้ำด้วยรหัสใบ ไม่ใช่เบอร์)
--
-- 🔴 DB ตัดสินว่าใครชนะ ไม่ใช่ลำดับโค้ด — partial unique index + API อ่าน unique violation
--    (เช็คก่อนแล้วค่อย insert = กดส่งรัว ๆ สองครั้งยังหลุดเข้าทั้งคู่ · ของจริง 2 ใบภายใน 10 นาที)
-- ⚠️ ใบซ้ำที่มีอยู่ก่อนกติกานี้ **ไม่ลบ** (เป็นใบของคนจริง มีผลโทร/ประวัติผูกอยู่) — ชี้ไปใบแรกของเบอร์นั้น
--    ด้วย `phone_dup_of` แล้วตัดออกจาก index · ใบแรก (เก่าสุด) ของแต่ละเบอร์คือใบหลัก
-- ⚠️ `phone_e164` เป็น generated column (087) — เบอร์ที่แปลง E.164 ไม่ได้ (null) ไม่อยู่ในกติกานี้

alter table public_job_applications
  add column if not exists phone_dup_of uuid null;

with ranked as (
  select id,
         first_value(id) over (partition by phone_e164 order by created_at, id) as first_id
    from public_job_applications
   where phone_e164 is not null
)
update public_job_applications a
   set phone_dup_of = r.first_id
  from ranked r
 where a.id = r.id
   and r.id <> r.first_id
   and a.phone_dup_of is null;

create unique index if not exists public_job_applications_phone_once_uidx
  on public_job_applications (phone_e164)
  where phone_e164 is not null and phone_dup_of is null;

comment on column public_job_applications.phone_dup_of is
  'ใบซ้ำที่เข้ามาก่อนกติกาเบอร์เดียว (132 · 1 ต.ค. 2569) — ชี้ไปใบแรกของเบอร์นั้น · null = ใบหลัก · ใบใหม่ต้อง null เสมอ';
