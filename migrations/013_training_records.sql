create table if not exists training_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  training_name text not null,
  training_date date not null,
  result text not null check (result in ('passed', 'failed', 'pending')),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists training_records_emp_idx on training_records (employee_id, training_date desc);
