-- Driver Care: retention early warning for outsourced drivers
create extension if not exists pgcrypto;

create table if not exists driver_income_monthly (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  income_month date not null,
  base_salary numeric(12, 2) not null default 0,
  ot_hours numeric(10, 2) not null default 0,
  ot_amount numeric(12, 2) not null default 0,
  allowance_amount numeric(12, 2) not null default 0,
  incentive_amount numeric(12, 2) not null default 0,
  deduction_amount numeric(12, 2) not null default 0,
  total_income numeric(12, 2) not null default 0,
  paid_days integer not null default 0,
  payroll_status text not null default 'paid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, income_month)
);

create index if not exists driver_income_monthly_emp_idx on driver_income_monthly (employee_id);
create index if not exists driver_income_monthly_month_idx on driver_income_monthly (income_month);

create table if not exists driver_resignation_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid null references employees(id) on delete set null,
  employee_code text null,
  employee_name text null,
  notice_date date null,
  resignation_date date not null,
  last_working_date date null,
  resignation_reason_group text not null
    check (resignation_reason_group in ('income', 'workload', 'client', 'supervisor', 'location', 'new_job', 'personal', 'unknown')),
  resignation_reason_text text null,
  voluntary_flag boolean not null default true,
  exit_interview_score integer null,
  rehire_eligible boolean null,
  created_at timestamptz not null default now()
);

create index if not exists driver_resignation_history_emp_idx on driver_resignation_history (employee_id);
create index if not exists driver_resignation_history_date_idx on driver_resignation_history (resignation_date);
create index if not exists driver_resignation_history_reason_idx on driver_resignation_history (resignation_reason_group);

create table if not exists driver_complaint_event (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  event_date date not null,
  event_source text not null
    check (event_source in ('client', 'driver', 'supervisor', 'operation', 'hr')),
  event_type text not null
    check (event_type in ('client_complaint', 'driver_complaint', 'request_transfer', 'request_change_driver', 'safety_issue', 'other')),
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high')),
  site_name text null,
  client_name text null,
  description text null,
  resolved_flag boolean not null default false,
  resolved_date date null,
  owner text null,
  created_at timestamptz not null default now()
);

create index if not exists driver_complaint_event_emp_idx on driver_complaint_event (employee_id);
create index if not exists driver_complaint_event_date_idx on driver_complaint_event (event_date);
create index if not exists driver_complaint_event_type_idx on driver_complaint_event (event_type);

create table if not exists driver_risk_score (
  id uuid primary key default gen_random_uuid(),
  score_date date not null default current_date,
  employee_id uuid not null references employees(id) on delete cascade,
  income_risk_score integer not null default 0,
  leave_risk_score integer not null default 0,
  attendance_risk_score integer not null default 0,
  assignment_risk_score integer not null default 0,
  complaint_risk_score integer not null default 0,
  pattern_risk_score integer not null default 0,
  total_risk_score integer not null default 0,
  risk_level text not null
    check (risk_level in ('low', 'watch', 'medium', 'high')),
  main_reason text not null,
  recommended_action text not null,
  rule_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, score_date)
);

create index if not exists driver_risk_score_date_idx on driver_risk_score (score_date);
create index if not exists driver_risk_score_emp_idx on driver_risk_score (employee_id);
create index if not exists driver_risk_score_level_idx on driver_risk_score (risk_level);
create index if not exists driver_risk_score_total_idx on driver_risk_score (total_risk_score desc);

create table if not exists driver_action_log (
  id uuid primary key default gen_random_uuid(),
  risk_score_id uuid null references driver_risk_score(id) on delete set null,
  employee_id uuid not null references employees(id) on delete cascade,
  action_date timestamptz not null default now(),
  action_by uuid null,
  action_by_name text null,
  action_type text not null,
  contact_status text not null default 'contacted',
  issue_found text not null,
  action_taken text not null,
  result text not null,
  next_follow_up_date date null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'closed')),
  closed_date timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_action_log_emp_idx on driver_action_log (employee_id);
create index if not exists driver_action_log_date_idx on driver_action_log (action_date);
create index if not exists driver_action_log_status_idx on driver_action_log (status);
create index if not exists driver_action_log_followup_idx on driver_action_log (next_follow_up_date);
