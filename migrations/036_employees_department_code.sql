-- แผนก / BU สำหรับแยกพนักงาน WL (เช่น LBD, LBA)
alter table jarvis_rm.employees
  add column if not exists department_code text null;

alter table employees
  add column if not exists department_code text null;

create index if not exists employees_department_code_idx on jarvis_rm.employees (department_code);
