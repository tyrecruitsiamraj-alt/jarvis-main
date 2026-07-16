-- แผนกของผู้ใช้แอป (เช่น LBD, LBA) — ใช้ล็อกสิทธิ์เห็นใบขอหน่วยงาน
alter table jarvis_rm.users
  add column if not exists department_code text null;

alter table users
  add column if not exists department_code text null;

create index if not exists users_department_code_idx on jarvis_rm.users (department_code);
