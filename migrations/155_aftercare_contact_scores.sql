-- ═══ ดูแลหลังเริ่มงาน: ลงผลโทร 3 หัวข้อ (เจ้าของ 19 ต.ค. 2569) ═══
-- > "ลงผลโทร ต้องการแบ่งออกเป็น 3 หัวข้อหลัก … ผลโทร DropDown : Healthy, Warning, High Risk"
-- Choice เจ้าของ "เพิ่มสามหัวข้อ เก็บของเดิมด้วย" ⇒ ผลเดิม 4 แบบ (142) อยู่ต่อ + คะแนน 3 หัวข้อ
--   expectation = งานตรงกับที่คาดหวังหรือไม่
--   supervisor  = ได้รับการดูแลจากหัวหน้างานหรือไม่
--   escalation  = หากมีปัญหารู้หรือไม่ต้องปรึกษาใคร
-- ว่างได้ (ผลติดต่อไม่ได้/ลาออก ถามไม่ได้ · แถวเก่าก่อนวันนี้)

alter table aftercare_contacts add column if not exists expectation text null;
alter table aftercare_contacts add column if not exists supervisor text null;
alter table aftercare_contacts add column if not exists escalation text null;

alter table aftercare_contacts drop constraint if exists aftercare_contacts_scores_check;
alter table aftercare_contacts
  add constraint aftercare_contacts_scores_check check (
    (expectation is null or expectation in ('healthy', 'warning', 'high_risk'))
    and (supervisor is null or supervisor in ('healthy', 'warning', 'high_risk'))
    and (escalation is null or escalation in ('healthy', 'warning', 'high_risk'))
  );
