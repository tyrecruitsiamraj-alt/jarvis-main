-- Master "สถานะทำงาน" ของใบขอ — ย้ายจากที่ hardcode ไว้ในโค้ด/CHECK constraint มาเก็บใน DB
-- เพื่อให้ Admin เพิ่ม/ปิดใช้งานสถานะได้เองจากหน้าตั้งค่า ไม่ต้องเขียน migration ใหม่ทุกครั้ง
-- (ก่อนหน้านี้ต้องมี migration 039/053/054/056 แค่เพื่อเพิ่มสถานะทีละตัว)
--
-- กติกา: ค่า built-in 9 ตัวลบไม่ได้ (โค้ด/dashboard/KPI อ้างชื่อเหล่านี้ตรง ๆ) แต่ปิดใช้งานได้
-- ค่าที่ Admin เพิ่มเองลบได้ ถ้ายังไม่มีใบขอไหนใช้อยู่ (FK กันลบทิ้งทั้งที่มีคนใช้)

create table if not exists work_status_master (
  code text primary key,
  label text not null,
  /** ป้ายกำกับช่องวันที่ของสถานะนี้ (เช่น 'วันนัดสัมภาษณ์') */
  date_label text not null default 'วันที่',
  sort_order integer not null default 100,
  /** true = ค่าที่ระบบใช้อ้างในโค้ด ลบไม่ได้ */
  is_builtin boolean not null default false,
  /** false = ซ่อนจาก dropdown (ใบขอเก่าที่ใช้ค่านี้ยังแสดงได้ปกติ) */
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_status_master_active_idx
  on work_status_master (is_active, sort_order);

-- Seed ค่าเดิมทั้ง 9 ตัวเป็น built-in (ต้องมีให้ครบก่อนผูก FK ข้างล่าง)
insert into work_status_master (code, label, date_label, sort_order, is_builtin) values
  ('in_progress',       'ดำเนินการ',      'วันที่',                 10, true),
  ('on_hold',           'ชะลอ',           'วันที่ชะลอ',             20, true),
  ('evaluating',        'เริ่มประเมิน',    'วันที่เริ่มประเมิน',       30, true),
  ('waiting_inform',    'รอแจ้งเข้า',      'วันที่แจ้งเข้า',          40, true),
  ('waiting_interview', 'รอสัมภาษณ์',      'วันนัดสัมภาษณ์',         50, true),
  ('waiting_result',    'รอผลสัมภาษณ์',    'วันที่สัมภาษณ์',          60, true),
  ('waiting_start',     'รอเริ่มงาน',      'วันที่เริ่มงาน',          70, true),
  ('daily_work',        'งานรายวัน',       'วันที่เริ่มงานรายวัน',     80, true),
  ('daily_pay',         'จ่ายรายวัน',      'วันที่จ่ายรายวัน',        90, true)
on conflict (code) do nothing;

-- เผื่อมีใบขอเก่าที่ status ไม่อยู่ใน 9 ค่าข้างบน (ข้อมูลหลุดจาก constraint รุ่นเก่า):
-- ยกขึ้นมาเป็นแถวใน master ก่อน ไม่ให้ผูก FK แล้วพัง และไม่ทำให้ข้อมูลใบขอหาย
insert into work_status_master (code, label, date_label, sort_order, is_builtin, is_active)
select distinct w.status, w.status, 'วันที่', 900, false, false
  from siamraj_unit_work_status w
 where w.status is not null
   and not exists (select 1 from work_status_master m where m.code = w.status)
on conflict (code) do nothing;

-- เปลี่ยนจาก CHECK ที่ hardcode ค่า → FK ไป master
-- (FK ทำหน้าที่กันสถานะเถื่อนเหมือนเดิม แต่ชุดค่าที่ยอมรับมาจากตารางที่แก้ได้)
alter table siamraj_unit_work_status
  drop constraint if exists siamraj_unit_work_status_status_check;

alter table siamraj_unit_work_status
  drop constraint if exists siamraj_unit_work_status_status_fkey;

alter table siamraj_unit_work_status
  add constraint siamraj_unit_work_status_status_fkey
  foreign key (status) references work_status_master (code)
  on update cascade
  on delete restrict;
