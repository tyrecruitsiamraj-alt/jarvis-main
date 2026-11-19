-- ใบสมัครจาก LINE ได้ผู้รับผิดชอบ = เจ้าหน้าที่สรรหาของใบขอ (เจ้าของ 19 พ.ย. 2569 "ทำไมพอเข้ามาทาง Line มันไม่ระบุเจ้าหน้าที่สรรหา"
-- · Choice "เจ้าหน้าที่สรรหาของใบขอ" · "แก้ข้อมูลจาก line ด้วย")
-- ใบจาก LINE = มี line_user_id / referral line_oa / ช่องทาง "… Line AI …" · ไม่มีลิงก์ ไม่มีคนคีย์ ยังไม่มีผู้รับผิดชอบ · ผูกใบขอที่ตั้งเจ้าหน้าที่สรรหาแล้ว
-- วัด 19 พ.ย. 2569 (อ่านอย่างเดียว): ใบจาก LINE 91 · เข้าเงื่อนไข 89
-- เก็บค่าเดิมก่อนแก้ — ย้อนกลับได้ด้วย update ... from application_responsible_fix_192 · เพิ่มอย่างเดียว ไม่ลบแถว · รันซ้ำไม่แก้ซ้ำ

create table if not exists application_responsible_fix_192 (
  application_id uuid primary key,
  old_responsible_name text,
  new_responsible_name text not null,
  fixed_at timestamptz not null default now()
);

with line_apps as (
  select a.id, a.responsible_name,
         (select nullif(btrim(u.recruiter_name), '')
            from siamraj_unit_assignments u
           where u.request_no in (split_part(a.job_id, ':', 2), a.job_id)
             and nullif(btrim(u.recruiter_name), '') is not null
           order by (u.request_no = a.job_id) desc
           limit 1) as recruiter
    from public_job_applications a
   where a.job_id is not null
     and a.link_id is null
     and nullif(btrim(a.created_by_name), '') is null
     and nullif(btrim(a.responsible_name), '') is null
     and (a.line_user_id is not null or a.referral_source = 'line_oa' or a.channel_label ilike '%Line AI%')
)
insert into application_responsible_fix_192 (application_id, old_responsible_name, new_responsible_name)
select id, responsible_name, recruiter from line_apps where recruiter is not null
on conflict (application_id) do nothing;

update public_job_applications a
   set responsible_name = f.new_responsible_name
  from application_responsible_fix_192 f
 where f.application_id = a.id
   and nullif(btrim(a.responsible_name), '') is null;
