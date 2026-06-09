-- คำนำหน้า + ฐานเงินเดือน สำหรับแสดงใน Monthly Work Planner
alter table jarvis_rm.employees
  add column if not exists title_prefix text null,
  add column if not exists base_salary integer null check (base_salary is null or base_salary >= 0);

-- รองรับกรณีรัน migration โดยไม่มี schema prefix
alter table employees
  add column if not exists title_prefix text null,
  add column if not exists base_salary integer null check (base_salary is null or base_salary >= 0);
