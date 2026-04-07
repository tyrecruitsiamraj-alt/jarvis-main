-- แยกประเภทเป็น: regular = พนักงานประจำ, wl = WL, ex = EX
-- ค่าเดิม 'ex' (รวมความหมายพนักงานประจำ+Ex) ย้ายเป็น 'regular'

alter table candidates drop constraint if exists candidates_staffing_track_check;

update candidates set staffing_track = 'regular' where staffing_track = 'ex';

alter table candidates alter column staffing_track set default 'regular';

alter table candidates
  add constraint candidates_staffing_track_check
  check (staffing_track in ('regular', 'wl', 'ex'));
