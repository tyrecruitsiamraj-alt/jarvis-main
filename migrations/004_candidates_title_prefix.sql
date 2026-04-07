-- เพิ่มคำนำหน้าชื่อผู้สมัคร (รันคู่กับโค้ดที่อัปเดต API)

alter table candidates
  add column if not exists title_prefix text null;
