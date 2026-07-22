-- แยกสถานะ "รอเริ่มงาน/รอผลสัมภาษณ์" เป็นสองสถานะ:
-- waiting_result = รอผลสัมภาษณ์ (ใหม่) · waiting_start = รอเริ่มงาน (ความหมายแคบลง ข้อมูลเดิมคงไว้)

alter table siamraj_unit_work_status
  drop constraint if exists siamraj_unit_work_status_status_check;

alter table siamraj_unit_work_status
  add constraint siamraj_unit_work_status_status_check
  check (status in (
    'in_progress',
    'evaluating',
    'waiting_inform',
    'waiting_interview',
    'waiting_result',
    'waiting_start'
  ));
