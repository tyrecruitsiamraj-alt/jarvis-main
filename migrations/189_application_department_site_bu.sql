-- แผนกของใบสมัคร = BU ของใบขอจากรหัสไซต์ (เจ้าของ 19 พ.ย. 2569 Choice "แก้ให้ตาม BU ของใบขอ + แก้ 286 ใบ")
-- 187 แก้เฉพาะใบขอที่มีประกาศระบุแผนก ⇒ ใบขอที่ไม่มีประกาศยังติดแผนกคนคีย์ (วัด 19 พ.ย.: LBD→LBA 225 · LBD→LM 59 · LBA→LBD 2)
-- เช่น นคร ปาระมี ใบขอ LMO6911010 (ไซต์ 69LML0022) ติด LBD ⇒ หัวหน้า LBD เห็นและเก็บไปได้
-- BU จากไซต์ = ตัวอักษร 3 ตัวหลังเลขปี แปลงเป็นรหัสแผนกชุดเดียวกับ `normalizeTrendBu` (LML→LM · DSL→DS · SNJ→SN · CRS→CR)
-- เก็บค่าเดิมก่อนแก้ — ย้อนกลับได้ด้วย update ... from application_department_fix_189 · เพิ่มอย่างเดียว ไม่ลบแถว

create table if not exists application_department_fix_189 (
  application_id uuid primary key,
  old_department_code text,
  new_department_code text not null,
  fixed_at timestamptz not null default now()
);

with site as (
  select a.id, a.department_code,
         case upper(substring(m.site_code from 3 for 3))
           when 'LML' then 'LM' when 'DSL' then 'DS' when 'SNJ' then 'SN' when 'CRS' then 'CR'
           else upper(substring(m.site_code from 3 for 3))
         end as bu
    from public_job_applications a
    join job_site_map m on m.job_id = a.job_id
   where m.site_code ~ '^[0-9]{2}[A-Za-z]{3}'
)
insert into application_department_fix_189 (application_id, old_department_code, new_department_code)
select id, department_code, bu
  from site
 where department_code is not null
   and department_code <> bu
on conflict (application_id) do nothing;

update public_job_applications a
   set department_code = f.new_department_code
  from application_department_fix_189 f
 where f.application_id = a.id
   and a.department_code is distinct from f.new_department_code;
