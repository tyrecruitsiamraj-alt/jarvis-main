-- รองรับ role OPL ใน roster เจ้าหน้าที่

alter table job_staff_roster drop constraint if exists job_staff_roster_role_check;
alter table job_staff_roster add constraint job_staff_roster_role_check
  check (role in ('recruiter', 'screener', 'opl'));

alter table job_staff_picker_excluded drop constraint if exists job_staff_picker_excluded_role_check;
alter table job_staff_picker_excluded add constraint job_staff_picker_excluded_role_check
  check (role in ('recruiter', 'screener', 'opl'));
