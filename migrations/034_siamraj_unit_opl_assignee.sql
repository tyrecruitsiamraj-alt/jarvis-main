-- เจ้าหน้าที่ OPL แยกจากสรรหา/คัดสรร — ผูกกับ request_no เช่นเดิม

alter table siamraj_unit_assignments
  add column if not exists opl_name text null;
