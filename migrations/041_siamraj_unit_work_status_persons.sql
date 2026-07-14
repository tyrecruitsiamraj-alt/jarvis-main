-- รองรับหลายคนต่อใบในสถานะทำงาน
alter table siamraj_unit_work_status
  add column if not exists persons jsonb not null default '[]'::jsonb;

alter table siamraj_unit_work_status_history
  add column if not exists persons jsonb null;

alter table siamraj_unit_work_status_history
  add column if not exists previous_persons jsonb null;

-- sync จากคอลัมน์เดิมถ้ามีข้อมูลคนเดียวและ persons ยังว่าง
update siamraj_unit_work_status
set persons = jsonb_build_array(
  jsonb_build_object(
    'first_name', person_first_name,
    'last_name', person_last_name,
    'status_date', status_date
  )
)
where coalesce(jsonb_array_length(persons), 0) = 0
  and nullif(trim(coalesce(person_first_name, '')), '') is not null
  and nullif(trim(coalesce(person_last_name, '')), '') is not null;
