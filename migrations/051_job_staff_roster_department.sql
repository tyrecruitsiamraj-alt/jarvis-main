-- BU (department) dimension for the job-staff roster.
-- The roster tab locks to the logged-in user's department (like Login); new
-- names are tagged with that BU. Legacy rows keep department_code = NULL and
-- stay visible in every BU so already-assigned names are never lost.

alter table job_staff_roster add column if not exists department_code text;
alter table job_staff_picker_excluded add column if not exists department_code text;

-- roster uniqueness is now per (role, department_code, name); coalesce keeps the
-- legacy NULL rows grouped so they remain unique per (role, name).
drop index if exists job_staff_roster_role_name_norm_idx;
create unique index if not exists job_staff_roster_role_dept_name_norm_idx
  on job_staff_roster (role, coalesce(department_code, ''), lower(trim(display_name)));

-- excluded: replace the (role, name_norm) primary key with a BU-scoped unique index.
alter table job_staff_picker_excluded drop constraint if exists job_staff_picker_excluded_pkey;
create unique index if not exists job_staff_picker_excluded_role_dept_name_idx
  on job_staff_picker_excluded (role, coalesce(department_code, ''), name_norm);
