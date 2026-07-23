-- เพิ่มสถานะทำงาน: ชะลอ (on_hold)

alter table siamraj_unit_work_status
  drop constraint if exists siamraj_unit_work_status_status_check;

alter table siamraj_unit_work_status
  add constraint siamraj_unit_work_status_status_check
  check (status in (
    'in_progress',
    'on_hold',
    'evaluating',
    'waiting_inform',
    'waiting_interview',
    'waiting_result',
    'waiting_start',
    'daily_work',
    'daily_pay'
  ));
