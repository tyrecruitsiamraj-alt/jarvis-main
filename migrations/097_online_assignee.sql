-- ทีม online เป็นผู้รับผิดชอบใบขออีกบทบาทหนึ่ง (เจ้าของสั่ง 17 ส.ค. 2569:
-- *"ผู้รับผิดชอบ จะต้องเป็นทีม online ดังนั้น [สรรหา / คัดสรร / OPL] เพิ่มชื่อ online ที"*)
--
-- ⚠️ **กับดักที่เคยโดนมาแล้วสองรอบ: CHECK constraint ของ role**
-- `job_staff_roster.role` และ `job_staff_picker_excluded.role` มี CHECK ที่ระบุค่าไว้ตายตัว
-- เพิ่มบทบาทใหม่โดยไม่ผ่อน CHECK = insert ตกเงียบ ๆ (หรือ 500) โดยหน้าจอไม่บอกอะไร
-- ต้อง drop แล้วสร้างใหม่ให้ครบทุกค่าเสมอ — แบบเดียวกับที่ migration 035 ทำตอนเพิ่ม OPL

alter table job_staff_roster drop constraint if exists job_staff_roster_role_check;
alter table job_staff_roster add constraint job_staff_roster_role_check
  check (role in ('recruiter', 'screener', 'opl', 'online'));

alter table job_staff_picker_excluded drop constraint if exists job_staff_picker_excluded_role_check;
alter table job_staff_picker_excluded add constraint job_staff_picker_excluded_role_check
  check (role in ('recruiter', 'screener', 'opl', 'online'));

-- ชื่อผู้รับผิดชอบฝั่ง online ต่อใบขอ — คอลัมน์ใหม่ ไม่ทับของเดิม
-- (สี่บทบาทอยู่คู่กันได้ ใบเดียวมีได้ทั้งสรรหา คัดสรร OPL และ online)
alter table siamraj_unit_assignments
  add column if not exists online_name text null;

comment on column siamraj_unit_assignments.online_name is
  'เจ้าหน้าที่ทีม online ที่รับผิดชอบใบขอนี้ — คนละช่องกับสรรหา/คัดสรร/OPL';
