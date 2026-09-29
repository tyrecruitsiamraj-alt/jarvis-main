-- ═══ ดึง 81 ใบขอลงจากหน้าสาธารณะ — ปล่อยตอนทดลองโดยไม่มี Gen link (เจ้าของเคาะ 29 ก.ย. 2569) ═══
--
-- วัดจริง 29 ก.ย. 2569 (อ่านอย่างเดียว · ตรรกะเดียวกับหัวกล่องงาน): ใบเปิดที่ปล่อยแล้ว 88 ใบ มี Gen link แค่ 7
-- ⇒ 81 ใบไม่มีลิงก์สมัคร — 79 ใบปล่อยเป็นชุดวันเดียว 25 ส.ค. (note "ปล่อยเป็นชุดจากบอร์ดรับสมัคร") · อีก 2 ใบ 26–27 ส.ค.
-- · ไม่มีใครสมัครเลยสักใบ (ใบสมัครตั้งแต่ 25 ส.ค. 95 ใบ เข้าทางลิงก์ประกาศทั้งหมด — ไม่มีลิงก์ = สมัครไม่ได้)
-- เจ้าของ: *"เอากลับมา แปลว่ามันน่าจะทำเมื่อตอนทดลอง"* → Choice **"ดึงลงทั้ง 81 ใบตอนนี้"**
--
-- ผลที่ตามมา (ตั้งใจ · นิยามเดียวของ "คนนอกเห็นได้ไหม" `jobPublicReleases.ts`):
--   หายจากหน้า /apply + รายการตำแหน่งที่ Lumos ใช้ · ใบขอในระบบหลังบ้านไม่แตะ · กล่องงานกลับเป็น "ยังไม่ปล่อย"
--   อยากปล่อยใหม่ = ทำขั้น 3 Gen link → ขั้น 4 ปล่อย ตามปกติ
--
-- 🔴 แตะเฉพาะ 81 id นี้ (id เต็ม ไม่ใช่เลขที่ใบ) และเฉพาะใบที่ **ยังไม่มีประกาศ** ตอนรัน
--    (มีคน Gen link ระหว่างนี้ = คงไว้ ไม่ดึงลง)
-- 🔴 สำรองแถวก่อนลบที่ `job_public_releases_backup_126` — คืนกลับทั้งชุด:
--    insert into job_public_releases (job_id, released_at, released_by, released_by_name, request_no, note)
--    select job_id, released_at, released_by, released_by_name, request_no, note
--      from job_public_releases_backup_126 on conflict (job_id) do nothing;

create table if not exists job_public_releases_backup_126 as
  select r.*, now() as withdrawn_at from job_public_releases r where false;

with target(job_id) as (
  values
    ('siamraj-sql:LAO6908009'),
    ('siamraj-sql:LBM6903001'),
    ('siamraj-sql:LBM6903002'),
    ('siamraj-sql:OPL6808001'),
    ('siamraj-sql:OPL6902120'),
    ('siamraj-sql:OPL6903067'),
    ('siamraj-sql:OPL6903130'),
    ('siamraj-sql:OPL6904029'),
    ('siamraj-sql:OPL6904054'),
    ('siamraj-sql:OPL6905022'),
    ('siamraj-sql:OPL6905033'),
    ('siamraj-sql:OPL6905039'),
    ('siamraj-sql:OPL6905041'),
    ('siamraj-sql:OPL6905091'),
    ('siamraj-sql:OPL6905127'),
    ('siamraj-sql:OPL6906009'),
    ('siamraj-sql:OPL6906014'),
    ('siamraj-sql:OPL6906030'),
    ('siamraj-sql:OPL6906090'),
    ('siamraj-sql:OPL6906091'),
    ('siamraj-sql:OPL6906096'),
    ('siamraj-sql:OPL6906113'),
    ('siamraj-sql:OPL6907006'),
    ('siamraj-sql:OPL6907021'),
    ('siamraj-sql:OPL6907043'),
    ('siamraj-sql:OPL6907052'),
    ('siamraj-sql:OPL6907053'),
    ('siamraj-sql:OPL6907058'),
    ('siamraj-sql:OPL6907077'),
    ('siamraj-sql:OPL6907081'),
    ('siamraj-sql:OPL6907082'),
    ('siamraj-sql:OPL6907085'),
    ('siamraj-sql:OPL6907091'),
    ('siamraj-sql:OPL6907103'),
    ('siamraj-sql:OPL6907116'),
    ('siamraj-sql:OPL6907119'),
    ('siamraj-sql:OPL6907123'),
    ('siamraj-sql:OPL6907126'),
    ('siamraj-sql:OPL6907133'),
    ('siamraj-sql:OPL6907134'),
    ('siamraj-sql:OPL6907137'),
    ('siamraj-sql:OPL6907145'),
    ('siamraj-sql:OPL6907146'),
    ('siamraj-sql:OPL6907149'),
    ('siamraj-sql:OPL6908002'),
    ('siamraj-sql:OPL6908005'),
    ('siamraj-sql:OPL6908008'),
    ('siamraj-sql:OPL6908010'),
    ('siamraj-sql:OPL6908011'),
    ('siamraj-sql:OPL6908026'),
    ('siamraj-sql:OPL6908027'),
    ('siamraj-sql:OPL6908028'),
    ('siamraj-sql:OPL6908033'),
    ('siamraj-sql:OPL6908037'),
    ('siamraj-sql:OPL6908039'),
    ('siamraj-sql:OPL6908042'),
    ('siamraj-sql:OPL6908044'),
    ('siamraj-sql:OPL6908045'),
    ('siamraj-sql:OPL6908049'),
    ('siamraj-sql:OPL6908050'),
    ('siamraj-sql:OPL6908053'),
    ('siamraj-sql:OPL6908054'),
    ('siamraj-sql:OPL6908055'),
    ('siamraj-sql:OPL6908060'),
    ('siamraj-sql:OPL6908061'),
    ('siamraj-sql:OPL6908063'),
    ('siamraj-sql:OPL6908065'),
    ('siamraj-sql:OPL6908066'),
    ('siamraj-sql:OPL6908070'),
    ('siamraj-sql:OPL6908084'),
    ('siamraj-sql:OPL6908094'),
    ('siamraj-sql:OPL6908095'),
    ('siamraj-sql:OPL6908097'),
    ('siamraj-sql:OPL6908098'),
    ('siamraj-sql:OPL6908101'),
    ('siamraj-sql:OPL6908102'),
    ('siamraj-sql:OPL6908103'),
    ('siamraj-sql:OPL6908104'),
    ('siamraj-sql:OPL6908105'),
    ('siamraj-sql:OPL6908106'),
    ('siamraj-sql:SQ6908001')
),
gone as (
  delete from job_public_releases r
   using target t
   where r.job_id = t.job_id
     and not exists (select 1 from recruit_postings p where p.job_id = r.job_id)
  returning r.*
)
insert into job_public_releases_backup_126
select g.*, now() from gone g;
