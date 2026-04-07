create table if not exists work_calendar (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  client_id uuid null references client_workplaces(id) on delete set null,
  client_name text null,
  shift text null,
  status text not null default 'normal_work'
    check (status in (
      'normal_work', 'cancel_by_employee', 'late', 'cancel_by_client',
      'no_show', 'day_off', 'available'
    )),
  income integer null,
  cost integer null,
  issue_reason text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_calendar_emp_date_idx on work_calendar (employee_id, work_date);
create index if not exists work_calendar_date_idx on work_calendar (work_date);
