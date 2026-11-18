-- แผนกของใบสมัคร = แผนกของใบขอ (เจ้าของ 18 พ.ย. 2569 Choice "ติดตามใบขอ + แก้ของเก่า")
-- เดิมใบที่เจ้าหน้าที่คีย์/นำเข้า ติดแผนกของคนคีย์เสมอ ⇒ คน LBD คีย์ให้ใบขอ LBA 515 ใบ ติด LBD หมด
-- (หัวหน้า LBD เห็น/เก็บงาน LBA ได้ · ยอด "ทุกคน" ต่างกันตามสิทธิ์ BU) · โค้ดใหม่ใช้ staffEntryDepartmentFor แล้ว
-- แผนกของใบขอ = ประกาศล่าสุดของใบขอนั้นที่ระบุแผนก (ตัวเดียวกับ resolveApplicationDepartment)
-- เก็บค่าเดิมไว้ในตารางสำรองก่อนแก้ — ย้อนกลับได้ด้วย update ... from application_department_fix_187

create table if not exists application_department_fix_187 (
  application_id uuid primary key,
  old_department_code text,
  new_department_code text not null,
  fixed_at timestamptz not null default now()
);

with pd as (
  select distinct on (job_id) job_id, department_code
    from recruit_postings
   where job_id is not null and department_code is not null
   order by job_id, created_at desc
)
insert into application_department_fix_187 (application_id, old_department_code, new_department_code)
select a.id, a.department_code, pd.department_code
  from public_job_applications a
  join pd on pd.job_id = a.job_id
 where a.department_code is not null
   and a.department_code <> pd.department_code
on conflict (application_id) do nothing;

update public_job_applications a
   set department_code = f.new_department_code
  from application_department_fix_187 f
 where f.application_id = a.id
   and a.department_code is distinct from f.new_department_code;
