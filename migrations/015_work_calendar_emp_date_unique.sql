-- One primary assignment per employee per calendar day (Daily / Monthly planner)
create unique index if not exists work_calendar_unique_employee_work_date
  on work_calendar (employee_id, work_date);
