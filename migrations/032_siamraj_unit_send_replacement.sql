-- ส่งคนแทน / ไม่ส่งคนแทน ต่อใบขอ Siamraj (เก็บคู่กับหมายเหตุ)
alter table siamraj_unit_notes
  add column if not exists send_replacement boolean null;
